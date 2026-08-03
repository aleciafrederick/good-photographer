"""
Color-managed image loader.

cv2.imread() ignores embedded ICC profiles, so wide-gamut sources
(Display P3, Adobe RGB, ProPhoto RGB, etc.) get treated as sRGB by
downstream viewers, producing a visibly desaturated result.

This helper loads through Pillow, converts pixel values into sRGB when the
source carries a non-sRGB profile, applies EXIF orientation, and returns the
BGR uint8 numpy array that cv2.imread would have returned. Existing callers
can swap in load_image_bgr() with no other changes.
"""
import io

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageOps


_SRGB_PROFILE = ImageCms.createProfile("sRGB")


def load_image_bgr(path):
    """Return a BGR uint8 numpy array in sRGB, or None if the file can't be opened."""
    try:
        with Image.open(path) as pil_img:
            pil_img.load()
            oriented = ImageOps.exif_transpose(pil_img) or pil_img
            converted = _convert_to_srgb(oriented)
            rgb = converted.convert("RGB")
            arr = np.asarray(rgb, dtype=np.uint8)
    except (OSError, ValueError, Image.DecompressionBombError):
        return None
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _convert_to_srgb(pil_img):
    icc_bytes = pil_img.info.get("icc_profile")
    if not icc_bytes:
        return pil_img

    try:
        src_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_bytes))
    except (ImageCms.PyCMSError, OSError):
        return pil_img

    if _profile_is_srgb(src_profile):
        return pil_img

    working = pil_img
    if working.mode not in ("RGB", "RGBA", "L", "CMYK"):
        working = working.convert("RGB")

    out_mode = "RGBA" if working.mode == "RGBA" else "RGB"
    try:
        return ImageCms.profileToProfile(
            working, src_profile, _SRGB_PROFILE, outputMode=out_mode
        )
    except ImageCms.PyCMSError:
        return working


def _profile_is_srgb(profile):
    try:
        desc = ImageCms.getProfileDescription(profile) or ""
    except (ImageCms.PyCMSError, AttributeError):
        return False
    return "srgb" in desc.lower()
