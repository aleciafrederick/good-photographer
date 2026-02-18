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


def _eye_centers_opencv(face_roi_gray, face_rect, eye_cascade):
    """Get eye centers from face ROI using OpenCV eye cascade."""
    x, y, w, h = face_rect
    # Eyes are in upper half of face
    roi = face_roi_gray[0 : int(0.6 * h), 0:w]
    eyes = eye_cascade.detectMultiScale(roi, 1.1, 5, minSize=(20, 20))
    if len(eyes) < 2:
        # Fallback: estimate eye positions from face proportions
        # Typical face: eyes at ~30% from top, left eye ~25% from left, right ~75%
        ey = int(0.35 * h)
        return [
            (x + int(0.25 * w), y + ey),
            (x + int(0.75 * w), y + ey),
        ]
    # Sort by x to get left and right
    eyes = sorted(eyes, key=lambda e: e[0])
    centers = []
    for (ex, ey, ew, eh) in eyes[:2]:
        centers.append((x + ex + ew // 2, y + ey + eh // 2))
    return centers


def detect_eyes(img_bgr, face_cascade, eye_cascade, predictor_path=None):
    """
    Detect face and return left_eye, right_eye in image coordinates.
    Returns (left_eye (x,y), right_eye (x,y)) or None if no face.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    # Use largest face
    face = max(faces, key=lambda r: r[2] * r[3])
    x, y, w, h = face
    face_roi_gray = gray[y : y + h, x : x + w]

    if HAS_DLIB and predictor_path and os.path.isfile(predictor_path):
        try:
            detector = dlib.get_frontal_face_detector()
            predictor = dlib.shape_predictor(predictor_path)
            # dlib expects RGB
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            dets = detector(img_rgb, 1)
            if len(dets) > 0:
                d = max(dets, key=lambda r: r.width() * r.height())
                shape = predictor(img_rgb, d)
                # 68-point: left eye 36-42, right eye 42-48
                left_pts = [(shape.part(i).x, shape.part(i).y) for i in range(36, 42)]
                right_pts = [(shape.part(i).x, shape.part(i).y) for i in range(42, 48)]
                left_eye = (int(np.mean([p[0] for p in left_pts])), int(np.mean([p[1] for p in right_pts])))
                right_eye = (int(np.mean([p[0] for p in right_pts])), int(np.mean([p[1] for p in right_pts])))
                # Fix: left eye y should use left_pts
                left_eye = (int(np.mean([p[0] for p in left_pts])), int(np.mean([p[1] for p in left_pts])))
                return (left_eye, right_eye)
        except Exception:
            pass

    centers = _eye_centers_opencv(face_roi_gray, face, eye_cascade)
    if len(centers) >= 2:
        return (tuple(centers[0]), tuple(centers[1]))
    return None


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
    """
    cw = template["canvas_width"]
    ch = template["canvas_height"]
    dst_left = tuple(template["left_eye"])
    dst_right = tuple(template["right_eye"])

    M = compute_affine_transform(left_eye, right_eye, dst_left, dst_right)
    aligned = cv2.warpAffine(img_bgr, M, (cw, ch), borderMode=cv2.BORDER_REPLICATE)
    if out_size:
        aligned = cv2.resize(aligned, out_size, interpolation=cv2.INTER_LANCZOS4)
    return aligned
