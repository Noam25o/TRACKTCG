import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
from engine import Engine
from benchmark_sizes import compare_case, FORMATS


class SizesBenchmarkTests(unittest.TestCase):
    def test_original_entry_restored_on_success_and_failure_without_saving(self):
        with tempfile.TemporaryDirectory() as directory:
            engine = Engine(Path(directory) / 'index.json')
            card = {"id": "test", "language": "FR"}
            entry = {"card": card}
            engine.entries[card["id"]] = entry
            images = {key: np.zeros((337, 245, 3), np.uint8) for key in FORMATS}
            def add(replacement, image):
                engine.entries[replacement["id"]] = {"card": replacement, "changed": True}
            with patch('benchmark_sizes.variants', return_value=[('test', images['highPng'])]), \
                 patch.object(engine, 'add', side_effect=add), \
                 patch.object(engine, 'recognize', return_value={"candidates": [], "milliseconds": 1, "ambiguous": False}):
                result = compare_case(engine, card, images)
                self.assertEqual(len(result['queries']), 1)
                self.assertTrue(all(result['queries'][0][key]['rejected'] for key in FORMATS))
                self.assertIs(engine.entries[card['id']], entry)
                with patch.object(engine, 'recognize', side_effect=ValueError('test failure')):
                    with self.assertRaises(ValueError):
                        compare_case(engine, card, images)
                self.assertIs(engine.entries[card['id']], entry)
            self.assertFalse(engine.path.exists(), 'The experiment must not save the index')


if __name__ == '__main__':
    unittest.main()
