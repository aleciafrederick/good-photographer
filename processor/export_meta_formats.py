"""
Meta image exporters: center-crop and Lanczos-resize uploads to the standard
sizes used in website meta tags (Open Graph, Twitter).
"""
import cv2


META_FORMAT_SPECS = {
    "og_landscape": {"width": 1200, "height": 630, "ext": "jpg"},
    "og_square": {"width": 1200, "height": 1200, "ext": "jpg"},
    "twitter_large": {"width": 1200, "height": 675, "ext": "jpg"},
}

DEFAULT_META_SUFFIXES = {
    "og_landscape": "OG",
    "og_square": "OGSquare",
    "twitter_large": "Twitter",
}

JPEG_QUALITY = 92


def _crop_and_resize(img, width, height):
    canvas_h, canvas_w = img.shape[:2]
    target_aspect = width / height
    src_aspect = canvas_w / canvas_h

    if src_aspect >= target_aspect:
        crop_w = int(round(canvas_h * target_aspect))
        x0 = (canvas_w - crop_w) // 2
        crop = img[:, x0 : x0 + crop_w]
    else:
        crop_h = int(round(canvas_w / target_aspect))
        y0 = (canvas_h - crop_h) // 2
        crop = img[y0 : y0 + crop_h, :]

    return cv2.resize(crop, (width, height), interpolation=cv2.INTER_LANCZOS4)


def _write_jpeg(img, out_path):
    cv2.imwrite(out_path, img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])


def export_og_landscape(img_bgr, out_path):
    spec = META_FORMAT_SPECS["og_landscape"]
    resized = _crop_and_resize(img_bgr, spec["width"], spec["height"])
    _write_jpeg(resized, out_path)


def export_og_square(img_bgr, out_path):
    spec = META_FORMAT_SPECS["og_square"]
    resized = _crop_and_resize(img_bgr, spec["width"], spec["height"])
    _write_jpeg(resized, out_path)


def export_twitter_large(img_bgr, out_path):
    spec = META_FORMAT_SPECS["twitter_large"]
    resized = _crop_and_resize(img_bgr, spec["width"], spec["height"])
    _write_jpeg(resized, out_path)


META_EXPORTERS = {
    "og_landscape": export_og_landscape,
    "og_square": export_og_square,
    "twitter_large": export_twitter_large,
}
