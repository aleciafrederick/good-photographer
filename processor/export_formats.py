"""
Export aligned image to each format: crop/resize, circular mask for Nucleus, filenames.
"""
import cv2
import numpy as np
import re


def sanitize_filename_part(s):
    """Replace spaces with hyphens, remove special chars. Preserve capitalization."""
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^\w\-]", "", s)
    return s or "Unknown"


def base_filename(last_name, first_name, year):
    """LastName-FirstName-YYYY (sanitized)."""
    ln = sanitize_filename_part(last_name)
    fn = sanitize_filename_part(first_name)
    y = str(year).strip()
    return f"{ln}-{fn}-{y}"


def make_unique_name(base, ext, existing):
    """If base+ext exists in set, append -1, -2, etc."""
    name = f"{base}.{ext}"
    if name not in existing:
        existing.add(name)
        return name
    i = 1
    while True:
        name = f"{base}-{i}.{ext}"
        if name not in existing:
            existing.add(name)
            return name
        i += 1


def export_raw(img_bgr, out_path):
    """Save original image as JPEG (visually preserve)."""
    cv2.imwrite(out_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])


def export_website_bio(aligned_bgr, out_path, template_format):
    """1000 x 684 JPEG. Center crop from aligned canvas to match aspect then resize."""
    w, h = template_format.get("width", 1000), template_format.get("height", 684)
    # aligned is canvas size; center crop to aspect ratio then resize
    canvas_h, canvas_w = aligned_bgr.shape[:2]
    target_aspect = w / h
    canvas_aspect = canvas_w / canvas_h
    if canvas_aspect >= target_aspect:
        crop_w = int(canvas_h * target_aspect)
        x0 = (canvas_w - crop_w) // 2
        crop = aligned_bgr[:, x0 : x0 + crop_w]
    else:
        crop_h = int(canvas_w / target_aspect)
        y0 = (canvas_h - crop_h) // 2
        crop = aligned_bgr[y0 : y0 + crop_h, :]
    resized = cv2.resize(crop, (w, h), interpolation=cv2.INTER_LANCZOS4)
    cv2.imwrite(out_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 92])


def export_spin_bio(aligned_bgr, out_path, template_format):
    """510 x 510 JPEG. Center square crop then resize."""
    size = template_format.get("width", 510), template_format.get("height", 510)
    canvas_h, canvas_w = aligned_bgr.shape[:2]
    s = min(canvas_w, canvas_h)
    x0 = (canvas_w - s) // 2
    y0 = (canvas_h - s) // 2
    crop = aligned_bgr[y0 : y0 + s, x0 : x0 + s]
    resized = cv2.resize(crop, size, interpolation=cv2.INTER_LANCZOS4)
    cv2.imwrite(out_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 92])


def export_nucleus_round(aligned_bgr, out_path, template_format):
    """510 x 510 PNG, circular mask, transparent background."""
    size = template_format.get("width", 510), template_format.get("height", 510)
    canvas_h, canvas_w = aligned_bgr.shape[:2]
    s = min(canvas_w, canvas_h)
    x0 = (canvas_w - s) // 2
    y0 = (canvas_h - s) // 2
    crop = aligned_bgr[y0 : y0 + s, x0 : x0 + s]
    resized = cv2.resize(crop, size, interpolation=cv2.INTER_LANCZOS4)
    # Circular mask
    mask = np.zeros((size[1], size[0]), dtype=np.uint8)
    cv2.circle(mask, (size[0] // 2, size[1] // 2), min(size) // 2, 255, -1)
    # BGR + alpha
    bgra = cv2.cvtColor(resized, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = mask
    cv2.imwrite(out_path, bgra)


EXPORTERS = {
    "website_bio": export_website_bio,
    "spin_bio": export_spin_bio,
    "nucleus_round": export_nucleus_round,
}
