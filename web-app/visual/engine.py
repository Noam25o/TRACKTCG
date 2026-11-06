"""Local ORB retrieval baseline. No OCR name gate, image files or cloud AI.

Only generated fingerprints are persisted; input/reference pixels are transient.
Internal scores are NOT probabilities. Reprints still require human checking.
"""
import base64
import json
import os
from pathlib import Path
import sys
import time

os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "5000000")
import cv2
import numpy as np

cv2.setNumThreads(2)
ORB = cv2.ORB_create(nfeatures=600, fastThreshold=12)
# Conservative prototype gate: 12 coherent points still accepted an unrelated
# held-out card. Revalidate recall on phone captures, not only reference queries.
MIN_GEOMETRIC_INLIERS = 24
ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "data" / "index.json"


def decode(encoded):
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 3 * 1024 * 1024:
        raise ValueError("Image trop volumineuse")
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.shape[0] * image.shape[1] > 5000000:
        raise ValueError("Image invalide")
    return image


def prepare(image, reference=False, return_transform=False):
    height, width = image.shape[:2]
    mapping = np.array([[450 / width, 0, 0], [0, 630 / height, 0], [0, 0, 1]], np.float64)
    # TCGplayer reference JPEGs have a white square margin around the card.
    if reference:
        mask = np.any(image < 235, axis=2).astype(np.uint8)
        points = cv2.findNonZero(mask)
        if points is not None:
            x, y, w, h = cv2.boundingRect(points)
            if .5 < w / h < .85:
                image = image[y:y+h, x:x+w]
    else:
        # Look for a card quadrilateral before warping. Fallback is the guide
        # crop, not a fabricated detection. Reference matching verifies geometry.
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        contours, _ = cv2.findContours(cv2.Canny(gray, 60, 160), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        area = image.shape[0] * image.shape[1]
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:20]:
            if cv2.contourArea(contour) < area * .35:
                continue
            poly = cv2.approxPolyDP(contour, .02 * cv2.arcLength(contour, True), True)
            if len(poly) != 4 or not cv2.isContourConvex(poly):
                continue
            p = poly.reshape(4, 2).astype(np.float32)
            ordered = np.array([p[np.argmin(p.sum(1))], p[np.argmin(np.diff(p, axis=1))],
                                p[np.argmax(p.sum(1))], p[np.argmax(np.diff(p, axis=1))]], np.float32)
            if len(np.unique(ordered, axis=0)) < 4:
                continue
            width = (np.linalg.norm(ordered[0]-ordered[1]) + np.linalg.norm(ordered[2]-ordered[3])) / 2
            height = (np.linalg.norm(ordered[0]-ordered[3]) + np.linalg.norm(ordered[1]-ordered[2])) / 2
            if not .5 < width / max(height, 1) < .9:
                continue
            transform = cv2.getPerspectiveTransform(ordered, np.float32([[0, 0], [449, 0], [449, 629], [0, 629]]))
            image = cv2.warpPerspective(image, transform, (450, 630))
            mapping = transform
            break
    prepared = cv2.resize(image, (450, 630), interpolation=cv2.INTER_AREA)
    return (prepared, mapping) if return_transform else prepared


def rectified_footer(image, capture_to_crop, reference_to_crop):
    """Read capture pixels, not reference artwork. Keep original input detail."""
    try:
        # ORB verifies reference -> normalized capture. Invert it and compose
        # with capture normalization to rectify the ORIGINAL high-res photo.
        transform = np.diag([2., 2., 1.]) @ np.linalg.inv(reference_to_crop) @ capture_to_crop
        if not np.isfinite(transform).all():
            return None
        rectified = cv2.warpPerspective(image, transform, (900, 1260),
            flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))
        footer = rectified[1008:1260]
        # Small collector glyphs should not undergo another lossy compression.
        ok, encoded = cv2.imencode('.png', footer, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        if not ok or encoded.nbytes > 700000:
            return None
        return base64.b64encode(encoded).decode('ascii')
    except (np.linalg.LinAlgError, cv2.error):
        return None


def fingerprint(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    points, descriptors = ORB.detectAndCompute(gray, None)
    if descriptors is None or len(points) < 20:
        raise ValueError("Image sans détails suffisants")
    positions = np.float32([point.pt for point in points])
    small = cv2.resize(gray, (32, 32)).astype(np.float32)
    dct = cv2.dct(small)[:8, :8].ravel()[1:]
    phash = dct > np.median(dct)
    return positions, descriptors, phash


class Engine:
    def __init__(self, path=INDEX):
        self.path = path
        self.entries = {}
        if path.exists():
            stored = json.loads(path.read_text(encoding="utf-8"))
            if stored.get("format") != "tracktcg.orb.v1":
                raise ValueError("Index incompatible")
            for item in stored["entries"]:
                self.entries[item["card"]["id"]] = self.unpack(item)

    @staticmethod
    def unpack(item):
        positions = np.frombuffer(base64.b64decode(item["points"]), np.float32).reshape(-1, 2)
        descriptors = np.frombuffer(base64.b64decode(item["descriptors"]), np.uint8).reshape(-1, 32)
        phash = np.array(item["hash"], np.bool_)
        if len(positions) != len(descriptors) or len(phash) != 63:
            raise ValueError("Empreinte invalide")
        return {"card": item["card"], "points": positions, "descriptors": descriptors, "hash": phash}

    def add(self, card, image):
        positions, descriptors, phash = fingerprint(prepare(image, reference=True))
        self.entries[card["id"]] = {"card": card, "points": positions, "descriptors": descriptors, "hash": phash}

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        entries = [{"card": item["card"], "points": base64.b64encode(item["points"].tobytes()).decode(),
                    "descriptors": base64.b64encode(item["descriptors"].tobytes()).decode(),
                    "hash": item["hash"].tolist()} for item in self.entries.values()]
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"format": "tracktcg.orb.v1", "entries": entries}), encoding="utf-8")
        temporary.replace(self.path)

    def status(self):
        counts = {lang: sum(e["card"]["language"] == lang for e in self.entries.values()) for lang in ("FR", "EN", "JP")}
        return {"engine": "OpenCV ORB + RANSAC", "counts": counts, "indexed": len(self.entries),
                "ids": list(self.entries), "imageUpload": True, "complete": False}

    def recognize(self, image, language, with_verification=False, force_verification=False):
        if language not in ("FR", "EN", "JP"):
            raise ValueError("Langue invalide")
        started = time.monotonic()
        crop, capture_to_crop = prepare(image, return_transform=True)
        positions, descriptors, phash = fingerprint(crop)
        pool = [e for e in self.entries.values() if e["card"]["language"] == language]
        # Coarse shortlist over ALL indexed species, then geometric verification.
        # Recall of this shortlist must be benchmarked on real phone photos.
        pool.sort(key=lambda e: np.count_nonzero(e["hash"] != phash))
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
        candidates = []
        transforms = {}
        for item in pool[:80]:
            pairs = matcher.knnMatch(item["descriptors"], descriptors, k=2)
            good = [a for pair in pairs if len(pair) == 2 for a, b in [pair] if a.distance < .75 * b.distance]
            # One feature in the scan must not vote for many reference points.
            good = list({m.trainIdx: m for m in sorted(good, key=lambda m: m.distance, reverse=True)}.values())
            if len(good) < MIN_GEOMETRIC_INLIERS:
                continue
            source = np.float32([item["points"][m.queryIdx] for m in good])
            target = np.float32([positions[m.trainIdx] for m in good])
            transform, mask = cv2.findHomography(source, target, cv2.RANSAC, 4)
            if transform is None or mask is None:
                continue
            inliers = int(mask.sum())
            if inliers < MIN_GEOMETRIC_INLIERS or inliers / len(good) < .4:
                continue
            accepted = source[mask.ravel().astype(bool)]
            area = cv2.contourArea(cv2.convexHull(accepted)) / (450 * 630)
            if area < .08:
                continue
            corners = cv2.perspectiveTransform(np.float32([[[0, 0], [449, 0], [449, 629], [0, 629]]]), transform)[0]
            if not np.isfinite(corners).all() or not cv2.isContourConvex(corners):
                continue
            projected = abs(cv2.contourArea(corners)) / (450 * 630)
            if not .25 <= projected <= 1.8 or np.any(corners < -180) or np.any(corners > 810):
                continue
            candidates.append({"card": item["card"], "inliers": inliers, "score": inliers * min(1, area * 3)})
            transforms[item["card"]["id"]] = transform
        candidates.sort(key=lambda c: c["score"], reverse=True)
        result = {"candidates": candidates[:3], "milliseconds": round((time.monotonic()-started)*1000),
                "indexed": len(pool), "ambiguous": len(candidates) > 1 and candidates[1]["score"] > candidates[0]["score"] * .8}
        if with_verification:
            # Engineering gate, not a calibrated probability or exact-print proof.
            required = bool(candidates and (force_verification or candidates[0]["inliers"] < 80
                or (len(candidates) > 1 and candidates[1]["score"] >= candidates[0]["score"] * .65)))
            result["verification"] = {"required": required}
            if required:
                result["verification"]["footer"] = rectified_footer(image, capture_to_crop,
                    transforms[candidates[0]["card"]["id"]])
        return result


def main():
    # Node writes UTF-8 JSON. Windows' default pipe encoding may be cp1252.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    engine = Engine()
    for line in sys.stdin:
        packet = None
        try:
            if len(line) > 4500000:
                raise ValueError("Requête trop volumineuse")
            packet = json.loads(line)
            action = packet["action"]
            if action == "status":
                result = engine.status()
            elif action == "add":
                engine.add(packet["card"], decode(packet["image"]))
                result = {"indexed": len(engine.entries)}
            elif action == "save":
                engine.save()
                result = engine.status()
            elif action == "metadata":
                card = engine.entries[packet["cardId"]]["card"]
                card.update(name=packet["name"], number=packet["number"])
                result = {"updated": card["id"]}
            elif action == "recognize":
                result = engine.recognize(decode(packet["image"]), packet["language"],
                    with_verification=packet.get("withVerification", False),
                    force_verification=packet.get("forceVerification", False))
            else:
                raise ValueError("Action invalide")
            print(json.dumps({"id": packet["id"], "result": result}, ensure_ascii=True), flush=True)
            result = None  # Do not keep a returned footer in the idle worker.
        except Exception as error:
            message = str(error) if isinstance(error, ValueError) else "Analyse impossible. Réessaie avec une carte nette."
            print(json.dumps({"id": packet.get("id") if packet else None, "error": message}), flush=True)
        finally:
            # Do not retain the last photo in the idle stdin loop.
            if packet is not None:
                packet.clear()
            line = ""


if __name__ == "__main__":
    main()
