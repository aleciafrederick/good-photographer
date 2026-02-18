"""
Face detection and alignment: compute eye positions and affine transform to template.
Uses OpenCV cascades; optional dlib for better landmarks if available.
"""
import cv2
import numpy as np
import json
import os

# Optional dlib for 68-point landmarks (more accurate)
try:
    import dlib
    HAS_DLIB = True
except ImportError:
    HAS_DLIB = False


def _face_proportion_eyes(face_rect):
    """Eye positions from face proportions (25% and 75% of face width, 35% from top). Same formula for every face → consistent scale; works with glasses."""
    x, y, w, h = face_rect
    ey = int(0.35 * h)
    return [
        (x + int(0.25 * w), y + ey),
        (x + int(0.75 * w), y + ey),
    ]


def detect_face_and_eyes(img_bgr, face_cascade, eye_cascade=None, predictor_path=None):
    """
    Detect face and return left_eye, right_eye (from face proportions), and face_rect.
    Returns (left_eye, right_eye, face_rect) or None if no face.
    face_rect is (x, y, w, h).
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    face = max(faces, key=lambda r: r[2] * r[3])
    centers = _face_proportion_eyes(face)
    return (tuple(centers[0]), tuple(centers[1]), tuple(face))


def detect_eyes(img_bgr, face_cascade, eye_cascade=None, predictor_path=None):
    """Convenience: returns (left_eye, right_eye) or None. Use detect_face_and_eyes when face_rect is needed."""
    out = detect_face_and_eyes(img_bgr, face_cascade, eye_cascade, predictor_path)
    if out is None:
        return None
    return (out[0], out[1])


def _affine_face_to_face(src_face, t_face):
    """Uniform scale + translate so source face rect maps to template face rect (centered in target)."""
    sx, sy, sw, sh = src_face
    tx, ty, tw, th = t_face
    if sw <= 0 or sh <= 0 or tw <= 0 or th <= 0:
        return np.eye(2, 3, dtype=np.float32)
    scale = min(tw / sw, th / sh)
    src_cx = sx + sw * 0.5
    src_cy = sy + sh * 0.5
    t_cx = tx + tw * 0.5
    t_cy = ty + th * 0.5
    tx_affine = t_cx - scale * src_cx
    ty_affine = t_cy - scale * src_cy
    return np.array([[scale, 0, tx_affine], [0, scale, ty_affine]], dtype=np.float32)


def align_to_template_by_face(img_bgr, face_rect, template):
    """
    Map detected face to template face rect. Canvas is always template canvas (1024×683 for Bio).
    Uniform scale, face centered in the reference face rect.
    """
    cw = template["canvas_width"]
    ch = template["canvas_height"]
    t_face = (
        template["face_left"],
        template["face_top"],
        template["face_width"],
        template["face_height"],
    )
    M = _affine_face_to_face(face_rect, t_face)
    aligned = cv2.warpAffine(img_bgr, M, (cw, ch), borderMode=cv2.BORDER_REPLICATE)
    return aligned


def compute_affine_transform(src_left, src_right, dst_left, dst_right):
    """Compute 2x3 affine matrix from 3 point pairs. getAffineTransform requires 3 points."""
    # Third point: below the midpoint of the eyes (nose/chin direction), proportional to eye distance
    def mid(p, q):
        return ((p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5)

    def eye_dist(p, q):
        return np.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) + 1e-6

    src_mid = mid(src_left, src_right)
    dst_mid = mid(dst_left, dst_right)
    d_src = eye_dist(src_left, src_right)
    d_dst = eye_dist(dst_left, dst_right)

    src_third = (src_mid[0], src_mid[1] + 0.5 * d_src)
    dst_third = (dst_mid[0], dst_mid[1] + 0.5 * d_dst)

    src = np.array([src_left, src_right, src_third], dtype=np.float32)
    dst = np.array([dst_left, dst_right, dst_third], dtype=np.float32)
    return cv2.getAffineTransform(src, dst)


def align_to_template(img_bgr, left_eye, right_eye, template, out_size=None):
    """
    Warp image so eyes match template eye positions.
    Returns aligned BGR image of size (canvas_width, canvas_height) or out_size.
    Optional template["face_scale"] > 1 zooms in (bigger face), < 1 zooms out.
    """
    cw = template["canvas_width"]
    ch = template["canvas_height"]
    dst_left = np.array(template["left_eye"], dtype=np.float64)
    dst_right = np.array(template["right_eye"], dtype=np.float64)

    face_scale = float(template.get("face_scale", 1.0))
    if face_scale != 1.0:
        mid = (dst_left + dst_right) * 0.5
        dst_left = mid + (dst_left - mid) * face_scale
        dst_right = mid + (dst_right - mid) * face_scale
    dst_left = tuple(dst_left)
    dst_right = tuple(dst_right)

    M = compute_affine_transform(left_eye, right_eye, dst_left, dst_right)
    aligned = cv2.warpAffine(img_bgr, M, (cw, ch), borderMode=cv2.BORDER_REPLICATE)
    if out_size:
        aligned = cv2.resize(aligned, out_size, interpolation=cv2.INTER_LANCZOS4)
    return aligned
