#!/usr/bin/env python3
"""
GoodPhotographer image processor.
Reads config JSON (export_dir, photos[], formats[]), processes each image:
- Save Raw copy
- Detect eyes, align to template, export selected formats
- Prints PROGRESS current total for UI
"""
import sys
import json
import os
import cv2
from align import detect_face_and_eyes, align_to_template, align_to_template_by_face
from export_formats import (
    base_filename,
    make_unique_name,
    export_raw,
    EXPORTERS,
)


def _resource_base():
    """When frozen by PyInstaller, resources are in _MEIPASS."""
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def _haarcascades_dir():
    """Path to OpenCV haarcascades (works when run normally or as frozen exe)."""
    if getattr(sys, "frozen", False):
        return os.path.join(_resource_base(), "cv2", "data")
    return cv2.data.haarcascades


# Path to dlib shape predictor (optional)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCES_DIR = os.path.join(SCRIPT_DIR, "..", "resources")
PREDICTOR_PATH = os.path.join(RESOURCES_DIR, "shape_predictor_68_face_landmarks.dat")


def main():
    if len(sys.argv) < 2:
        print("Usage: run_processor.py <config.json>", file=sys.stderr)
        sys.exit(1)
    config_path = sys.argv[1]
    with open(config_path, "r") as f:
        config = json.load(f)

    export_dir = config["export_dir"]
    photos = config["photos"]
    formats = config["formats"]
    template_path = config.get("template_path")
    if not template_path or not os.path.isfile(template_path):
        print("ERROR: Template file not found", file=sys.stderr)
        sys.exit(2)
    with open(template_path, "r") as f:
        template = json.load(f)

    cascade_dir = _haarcascades_dir()
    face_cascade = cv2.CascadeClassifier(
        os.path.join(cascade_dir, "haarcascade_frontalface_default.xml")
    )
    eye_cascade = cv2.CascadeClassifier(
        os.path.join(cascade_dir, "haarcascade_eye.xml")
    )
    predictor_path = PREDICTOR_PATH
    if not os.path.isfile(predictor_path):
        predictor_path = None

    total = len(photos)
    used_filenames = set()
    print(f"PROGRESS 0 {total}", flush=True)

    for i, photo in enumerate(photos):
        src_path = photo["path"]
        first_name = photo.get("firstName", "").strip()
        last_name = photo.get("lastName", "").strip()
        year = photo.get("year", "").strip()
        base = base_filename(last_name, first_name, year)

        print(f"PROGRESS {i} {total}", flush=True)
        try:
            if not os.path.isfile(src_path):
                print(f"ERROR: File not found: {src_path}", flush=True)
                print(f"PROGRESS {i + 1} {total}", flush=True)
                continue

            img = cv2.imread(src_path)
            if img is None:
                print(f"ERROR: Could not read image: {src_path}", flush=True)
                print(f"PROGRESS {i + 1} {total}", flush=True)
                continue

            # 1. Raw copy (always)
            raw_name = make_unique_name(base + "Raw", "jpg", used_filenames)
            raw_path = os.path.join(export_dir, raw_name)
            export_raw(img, raw_path)

            # 2. Detect face and align (by face rect if template has it, else by eye positions)
            result = detect_face_and_eyes(img, face_cascade, eye_cascade, predictor_path)
            if result is None:
                print(f"ERROR: No face detected in {os.path.basename(src_path)} ({first_name} {last_name})", flush=True)
                print(f"PROGRESS {i + 1} {total}", flush=True)
                continue

            left_eye, right_eye, face_rect = result
            if "face_left" in template and "face_top" in template and "face_width" in template and "face_height" in template:
                aligned = align_to_template_by_face(img, face_rect, template)
            else:
                aligned = align_to_template(img, left_eye, right_eye, template)

            # 3. Export selected formats
            for fmt in formats:
                if fmt not in EXPORTERS:
                    continue
                tfmt = template.get("formats", {}).get(fmt, {})
                if fmt == "website_bio":
                    name = make_unique_name(base + "Bio", "jpg", used_filenames)
                elif fmt == "spin_bio":
                    name = make_unique_name(base + "Spin", "jpg", used_filenames)
                elif fmt == "nucleus_round":
                    name = make_unique_name(base + "Nucleus", "png", used_filenames)
                else:
                    continue
                out_path = os.path.join(export_dir, name)
                EXPORTERS[fmt](aligned, out_path, tfmt)

        except Exception as e:
            print(f"ERROR: {os.path.basename(src_path)} ({first_name} {last_name}): {e}", flush=True)
        print(f"PROGRESS {i + 1} {total}", flush=True)

    print(f"PROGRESS {total} {total}", flush=True)


if __name__ == "__main__":
    main()
