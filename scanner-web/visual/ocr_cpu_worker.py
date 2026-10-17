"""Isolated CPU benchmark worker; pixels remain in pipes/RAM, never on disk."""
import base64
import contextlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".tools" / "ocr-models"
os.environ["PADDLE_PDX_CACHE_HOME"] = str(CACHE / "paddlex")
os.environ["HF_HOME"] = str(CACHE / "huggingface")
os.environ["PADDLE_PDX_MODEL_SOURCE"] = "huggingface"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = "5000000"
import cv2
import numpy as np
cv2.setNumThreads(2)


def decode(encoded):
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 3 * 1024 * 1024:
        raise ValueError("Image exceeds 3 MiB")
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.shape[0] * image.shape[1] > 5000000:
        raise ValueError("Invalid image / exceeds 5 MP")
    return image


def prepare(encoded, width):
    # Generic bottom 20%, no expected number, location annotation or card ID.
    # Does NOT reproduce the production homography; benchmark this separately.
    image = decode(encoded)
    width = min(int(width), image.shape[1], 1500)
    if width < 100:
        raise ValueError("Width too small")
    image = image[int(image.shape[0] * .8):, :]
    image = cv2.resize(image, (width, round(image.shape[0] / image.shape[1] * width)),
                       interpolation=cv2.INTER_AREA)
    image = cv2.copyMakeBorder(image, 10, 10, 10, 10, cv2.BORDER_CONSTANT,
                              value=(255, 255, 255))
    ok, png = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("Encoding failed")
    return {"image": base64.b64encode(png).decode("ascii"),
            "width": image.shape[1], "height": image.shape[0]}


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    model = None
    for line in sys.stdin:
        packet = result = image = None
        try:
            if len(line) > 4500000:
                raise ValueError("Packet too large")
            packet = json.loads(line)
            if packet["action"] == "prepare":
                result = prepare(packet["image"], packet["width"])
            elif packet["action"] == "init":
                name = packet["model"]
                if name not in ("PP-OCRv5_server_rec", "en_PP-OCRv5_mobile_rec"):
                    raise ValueError("Unsupported benchmark model")
                started = time.perf_counter()
                with contextlib.redirect_stdout(sys.stderr):
                    from paddleocr import PaddleOCR
                    import paddle
                    # Paddle 3.3.0 Windows oneDNN/PIR failed on these inputs;
                    # explicitly use the regular CPU backend for this baseline.
                    model = PaddleOCR(device="cpu", cpu_threads=4, enable_mkldnn=False,
                        use_doc_orientation_classify=False, use_doc_unwarping=False,
                        use_textline_orientation=False,
                        text_detection_model_name="PP-OCRv5_mobile_det",
                        text_recognition_model_name=name,
                        text_det_limit_side_len=1536, text_det_limit_type="max")
                result = {"initMs": round((time.perf_counter()-started)*1000),
                          "device": paddle.device.get_device(),
                          "cudaCompiled": paddle.is_compiled_with_cuda(), "mkldnn": False,
                          "versions": {p: importlib.metadata.version(p) for p in
                              ("paddleocr", "paddlepaddle", "paddlex", "numpy", "opencv-contrib-python")}}
            elif packet["action"] == "read":
                if model is None:
                    raise ValueError("Initialize first")
                image = decode(packet["image"])
                started = time.perf_counter()
                with contextlib.redirect_stdout(sys.stderr):
                    predictions = list(model.predict(image))
                elapsed = round((time.perf_counter()-started)*1000)
                result = {"ms": elapsed, "lines": [
                    {"text": text, "score": float(score)}
                    for prediction in predictions
                    for text, score in zip(prediction["rec_texts"], prediction["rec_scores"])]}
                predictions = None
            else:
                raise ValueError("Unknown action")
            print("@ocr@" + json.dumps({"id": packet["id"], "result": result}, ensure_ascii=True), flush=True)
        except Exception as error:
            import traceback
            traceback.print_exc(file=sys.stderr)
            print("@ocr@" + json.dumps({"id": packet.get("id") if packet else None,
                                       "error": str(error)}), flush=True)
        finally:
            packet = result = image = None
            line = ""


if __name__ == "__main__":
    main()
