"""Read-only index experiment with actual TCGdex high/low assets in RAM."""
import json
import sys
from benchmark import compact, variants
from engine import Engine, decode


FORMATS = ("highPng", "highWebp", "lowWebp")


def compare_case(engine, card, images, order=FORMATS):
    if card["id"] not in engine.entries:
        raise ValueError("Test card must already belong to the index")
    if set(order) != set(FORMATS) or len(order) != len(FORMATS):
        raise ValueError("All three formats must be tested exactly once")
    original_entry = engine.entries[card["id"]]
    queries = list(variants(images["highPng"]))
    result = {"card": card["id"], "dimensions": {
        key: {"width": image.shape[1], "height": image.shape[0]}
        for key, image in images.items()}, "queries": [
        {"variant": label} for label, _ in queries]}
    try:
        # The same high-PNG-derived query is tested against each reference.
        # Never save; all other 1,999 index entries stay unchanged.
        for key in order:
            engine.add(card, images[key])
            for row, (_, query) in zip(result["queries"], queries):
                row[key] = compact(engine.recognize(query, card["language"]), card["id"])
    finally:
        engine.entries[card["id"]] = original_entry
    return result


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    engine = Engine()
    for line in sys.stdin:
        packet = images = None
        try:
            packet = json.loads(line)
            if packet["action"] == "status":
                result = engine.status()
            elif packet["action"] == "case":
                images = {key: decode(packet["images"][key]) for key in FORMATS}
                result = compare_case(engine, packet["card"], images, packet["order"])
            else:
                raise ValueError("Unknown benchmark action")
            print(json.dumps({"id": packet["id"], "result": result}), flush=True)
        except Exception as error:
            print(json.dumps({"id": packet.get("id") if packet else None, "error": str(error)}), flush=True)
        finally:
            if packet is not None:
                packet.clear()
            images = None
            line = ""


if __name__ == '__main__':
    main()
