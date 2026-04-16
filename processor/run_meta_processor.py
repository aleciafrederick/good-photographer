#!/usr/bin/env python3
"""
Atomic Photographer meta image processor.
Reads config JSON (export_dir, photos[], formats[]), and for each photo
exports a center-cropped, Lanczos-resized copy in every selected meta format.
Prints PROGRESS current total lines for the UI.
"""
import json
import os
import sys

import cv2

from export_formats import make_unique_name, sanitize_filename_part
from export_meta_formats import DEFAULT_META_SUFFIXES, META_EXPORTERS, META_FORMAT_SPECS


def normalize_formats(formats):
    normalized = []
    for fmt in formats:
        if isinstance(fmt, str):
            fmt_id = fmt
            suffix = DEFAULT_META_SUFFIXES.get(fmt_id, "")
        elif isinstance(fmt, dict):
            fmt_id = fmt.get("id")
            suffix = str(fmt.get("suffix", "")).strip() or DEFAULT_META_SUFFIXES.get(fmt_id, "")
        else:
            continue

        if fmt_id not in META_EXPORTERS:
            continue

        default_suffix = DEFAULT_META_SUFFIXES.get(fmt_id, "")
        clean_suffix = sanitize_filename_part(suffix) if suffix else default_suffix
        normalized.append(
            {
                "id": fmt_id,
                "suffix": clean_suffix or default_suffix,
                "ext": META_FORMAT_SPECS[fmt_id]["ext"],
            }
        )
    return normalized


def main():
    if len(sys.argv) < 2:
        print("Usage: run_meta_processor.py <config.json>", file=sys.stderr)
        sys.exit(1)

    config_path = sys.argv[1]
    with open(config_path, "r") as f:
        config = json.load(f)

    export_dir = config["export_dir"]
    photos = config["photos"]
    formats = normalize_formats(config["formats"])

    total = len(photos)
    used_filenames = set()
    print(f"PROGRESS 0 {total}", flush=True)

    for i, photo in enumerate(photos):
        src_path = photo["path"]
        base_name = str(photo.get("baseName", "")).strip()
        base_name_clean = sanitize_filename_part(base_name) if base_name else "image"

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

            for fmt in formats:
                fmt_id = fmt["id"]
                suffix = fmt.get("suffix", "").strip()
                filename_base = f"{base_name_clean}-{suffix}" if suffix else base_name_clean
                name = make_unique_name(filename_base, fmt["ext"], used_filenames)
                out_path = os.path.join(export_dir, name)
                META_EXPORTERS[fmt_id](img, out_path)

        except Exception as e:
            print(f"ERROR: {os.path.basename(src_path)} ({base_name}): {e}", flush=True)
        print(f"PROGRESS {i + 1} {total}", flush=True)

    print(f"PROGRESS {total} {total}", flush=True)


if __name__ == "__main__":
    main()
