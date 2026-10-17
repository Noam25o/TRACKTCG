import tempfile
import base64
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import cv2
import numpy as np
from engine import Engine, decode, main, rectified_footer


class RecognitionTests(unittest.TestCase):
    def test_retrieval_without_any_name_reading_and_no_false_language(self):
        rng = np.random.default_rng(6)
        with tempfile.TemporaryDirectory() as directory:
            engine = Engine(Path(directory) / "index.json")
            images = []
            for i in range(3):
                image = np.full((630, 450, 3), 180, np.uint8)
                for _ in range(110):
                    p = tuple(map(int, rng.integers([15, 15], [430, 610])))
                    color = tuple(map(int, rng.integers(0, 255, 3)))
                    cv2.circle(image, p, int(rng.integers(3, 15)), color, -1)
                images.append(image)
                engine.add({"id": str(i), "language": "FR", "name": "Synthetic test"}, image)
            transform = cv2.getPerspectiveTransform(np.float32([[0, 0], [449, 0], [449, 629], [0, 629]]),
                                                     np.float32([[14, 17], [437, 6], [442, 615], [9, 620]]))
            photo = cv2.warpPerspective(images[1], transform, (450, 630))
            self.assertEqual(engine.recognize(photo, "FR")["candidates"][0]["card"]["id"], "1")
            verified = engine.recognize(photo, "FR", with_verification=True, force_verification=True)
            self.assertTrue(verified["verification"]["required"])
            self.assertEqual(decode(verified["verification"]["footer"]).shape[:2], (252, 900))
            self.assertNotIn("verification", engine.recognize(photo, "FR"))
            self.assertEqual(engine.recognize(photo, "JP")["candidates"], [])
            homography = cv2.findHomography
            def weak_evidence(source, *args):
                transform, mask = homography(source, *args)
                if mask is not None:
                    mask[np.flatnonzero(mask.ravel())[12:]] = 0
                return transform, mask
            with patch("engine.cv2.findHomography", side_effect=weak_evidence):
                self.assertEqual(engine.recognize(photo, "FR")["candidates"], [], "12 coherent points are insufficient")
            with patch("engine.cv2.findHomography", side_effect=lambda source, *_: (np.eye(3), np.zeros((len(source), 1), np.uint8))):
                self.assertEqual(engine.recognize(photo, "FR")["candidates"], [], "zero inliers are a refusal, not a crash")
            engine.save()
            self.assertEqual(Engine(engine.path).status()["indexed"], 3)
            self.assertEqual([p.name for p in Path(directory).iterdir()], ["index.json"])
            with self.assertRaises(ValueError):
                engine.recognize(np.full((630, 450, 3), 255, np.uint8), "FR")

    def test_invalid_input_refused(self):
        with self.assertRaises(Exception):
            decode("not-base64")

    def test_footer_warps_original_capture_pixels_and_rejects_singular_geometry(self):
        image = np.full((1260, 900, 3), (50, 120, 200), np.uint8)
        cv2.putText(image, '001/165', (120, 1190), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3)
        h = np.array([[.85, .015, 20], [-.01, .85, 40], [0, 0, 1]], np.float64)
        scale = np.diag([2., 2., 1.])
        capture = cv2.warpPerspective(image, scale @ h @ np.linalg.inv(scale), (900, 1260))
        encoded = rectified_footer(capture, np.linalg.inv(scale), h)
        self.assertTrue(base64.b64decode(encoded).startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertLessEqual(len(base64.b64decode(encoded)), 700000)
        restored = decode(encoded)
        self.assertLess(np.mean(np.abs(restored.astype(float)-image[1008:].astype(float))), 5)
        self.assertIsNone(rectified_footer(image, np.eye(3), np.zeros((3,3))))

    def test_windows_pipe_utf8_names_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            engine = Engine(Path(directory) / "index.json")
            engine.entries["jp"] = {"card": {"id": "jp", "name": "old", "number": "1"}}
            packet = {"id": 1, "action": "metadata", "cardId": "jp", "name": "ピカチュウ", "number": "001"}
            incoming = io.TextIOWrapper(io.BytesIO((json.dumps(packet, ensure_ascii=False) + "\n").encode("utf-8")), encoding="cp1252")
            outgoing = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
            with patch("engine.Engine", return_value=engine), patch("engine.sys.stdin", incoming), patch("engine.sys.stdout", outgoing):
                main()
            self.assertEqual(engine.entries["jp"]["card"]["name"], "ピカチュウ")


if __name__ == "__main__":
    unittest.main()
