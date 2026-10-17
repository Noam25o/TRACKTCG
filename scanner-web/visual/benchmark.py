"""Synthetic regression/compression study, public references only. No image files.

Queries come from the original, never from the compressed reference under test.
This measures regression on reference-derived queries, NOT phone accuracy.
"""
import json
import sys
import cv2
import numpy as np
from engine import Engine, ROOT, decode, prepare


def variants(image):
    card = prepare(image, reference=True)
    corners = np.float32([[0, 0], [449, 0], [449, 629], [0, 629]])
    target = np.float32([[25, 12], [434, 35], [442, 607], [10, 621]])
    angled = cv2.warpPerspective(card, cv2.getPerspectiveTransform(corners, target), (450, 630), borderValue=(85, 85, 85))
    hidden = card.copy()
    hidden[:76] = 100
    for label, view in [("aligned", card), ("perspective", angled), ("title_hidden", hidden)]:
        # Camera-like resampling/blur/JPEG, not a simulated real camera benchmark.
        view = cv2.GaussianBlur(view, (3, 3), .55)
        ok, jpeg = cv2.imencode('.jpg', view, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            raise ValueError("JPEG encoding failed")
        yield label, cv2.imdecode(jpeg, cv2.IMREAD_COLOR)


def compact(result, expected):
    candidates = result["candidates"]
    return {"top1": bool(candidates and candidates[0]["card"]["id"] == expected),
            "top3": any(c["card"]["id"] == expected for c in candidates),
            "rejected": not candidates, "ms": result["milliseconds"], "ambiguous": result["ambiguous"],
            "candidates": [{"id": c["card"]["id"], "score": round(c["score"], 2), "inliers": c["inliers"]} for c in candidates]}


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    engine = Engine()
    old = Engine(ROOT / "data" / "index-before-2000.json")
    for line in sys.stdin:
        packet = None
        try:
            packet = json.loads(line)
            if packet["action"] == "status":
                result = engine.status()
            else:
                card = packet["card"]
                image = decode(packet["image"])
                missing = bool(packet.get("absent"))
                if missing == (card["id"] in engine.entries):
                    raise ValueError("Benchmark membership mismatch")
                ok, encoded = cv2.imencode('.webp', image, [cv2.IMWRITE_WEBP_QUALITY, 50])
                if not ok:
                    raise ValueError("WebP encoder unavailable")
                compressed = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
                result = {"card": card["id"], "absent": missing, "sourceBytes": packet["sourceBytes"],
                          "width": image.shape[1], "height": image.shape[0], "webp50Bytes": int(encoded.nbytes), "queries": []}
                original_entry = engine.entries.get(card["id"])
                for label, query in variants(image):
                    row = {"variant": label, "original": compact(engine.recognize(query, card["language"]), card["id"])}
                    if card["id"] in old.entries:
                        row["pilot411"] = compact(old.recognize(query, card["language"]), card["id"])
                    if not missing:
                        try:
                            engine.add(card, compressed)
                            row["webp50"] = compact(engine.recognize(query, card["language"]), card["id"])
                        finally:
                            engine.entries[card["id"]] = original_entry
                    result["queries"].append(row)
                image = compressed = encoded = None
            print(json.dumps({"id": packet["id"], "result": result}), flush=True)
        except Exception as error:
            print(json.dumps({"id": packet.get("id") if packet else None, "error": str(error)}), flush=True)
        finally:
            if packet is not None:
                packet.clear()
            line = ""


if __name__ == '__main__':
    main()
