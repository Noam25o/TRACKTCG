"""Input/crop tests need only the existing OpenCV environment, no model weights."""
import base64
import unittest
import cv2
import numpy as np
from ocr_cpu_worker import decode, prepare


class CpuCropTests(unittest.TestCase):
    def test_crop_preserves_footer_pixels_and_never_upscales(self):
        image = np.zeros((500, 300, 3), np.uint8)
        image[400:] = (20, 40, 60)
        _, raw = cv2.imencode('.png', image)
        result = prepare(base64.b64encode(raw).decode(), 1500)
        crop = decode(result['image'])
        self.assertEqual((result['width'], result['height']), (320, 120))
        np.testing.assert_array_equal(crop[10:-10, 10:-10], image[400:])
        self.assertTrue(np.all(crop[:10] == 255))

    def test_invalid_images_rejected(self):
        for value in ('not base64!', base64.b64encode(b'not an image').decode()):
            with self.assertRaises(ValueError):
                decode(value)


if __name__ == '__main__':
    unittest.main()
