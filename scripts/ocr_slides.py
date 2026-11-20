#!/usr/bin/env python3
"""OCR the downloaded slide PNGs locally through libtesseract's C API.

This does not call a network service. ImageMagick converts PNG pixels to an
RGBA buffer; Tesseract reads that buffer directly. The raw OCR output is kept
as an auditable intermediate rather than being treated as final question data.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SLIDE_RE = re.compile(r"slide_(\d{3})\.png$")
TESSDATA = b"/usr/share/tesseract/tessdata"


class LocalTesseract:
    def __init__(self) -> None:
        self.lib = ctypes.CDLL("libtesseract.so.5.5")
        t = self.lib
        t.TessBaseAPICreate.restype = ctypes.c_void_p
        t.TessBaseAPIInit3.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p]
        t.TessBaseAPIInit3.restype = ctypes.c_int
        t.TessBaseAPISetPageSegMode.argtypes = [ctypes.c_void_p, ctypes.c_int]
        t.TessBaseAPISetImage.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_int,
        ]
        t.TessBaseAPIGetUTF8Text.argtypes = [ctypes.c_void_p]
        t.TessBaseAPIGetUTF8Text.restype = ctypes.c_void_p
        t.TessBaseAPIMeanTextConf.argtypes = [ctypes.c_void_p]
        t.TessBaseAPIMeanTextConf.restype = ctypes.c_int
        t.TessDeleteText.argtypes = [ctypes.c_void_p]
        t.TessBaseAPIEnd.argtypes = [ctypes.c_void_p]
        t.TessBaseAPIDelete.argtypes = [ctypes.c_void_p]
        self.api = t.TessBaseAPICreate()
        if not self.api or t.TessBaseAPIInit3(self.api, TESSDATA, b"eng") != 0:
            raise RuntimeError("Could not initialize local Tesseract English model")
        # PSM_AUTO: mixed question, code, and diagram slides need automatic layout.
        t.TessBaseAPISetPageSegMode(self.api, 3)

    def close(self) -> None:
        if self.api:
            self.lib.TessBaseAPIEnd(self.api)
            self.lib.TessBaseAPIDelete(self.api)
            self.api = None

    def read(self, image: Path) -> tuple[str, int]:
        rgba = subprocess.check_output(
            ["magick", str(image), "-depth", "8", "rgba:-"], stderr=subprocess.DEVNULL
        )
        width, height, channels = 1600, 900, 4
        expected = width * height * channels
        if len(rgba) != expected:
            raise ValueError(f"Unexpected pixel count for {image}: {len(rgba)} != {expected}")
        buffer = (ctypes.c_ubyte * len(rgba)).from_buffer_copy(rgba)
        self.lib.TessBaseAPISetImage(
            self.api, buffer, width, height, channels, width * channels
        )
        pointer = self.lib.TessBaseAPIGetUTF8Text(self.api)
        if not pointer:
            return "", 0
        try:
            text = ctypes.string_at(pointer).decode("utf-8", "replace").strip()
        finally:
            self.lib.TessDeleteText(pointer)
        return text, self.lib.TessBaseAPIMeanTextConf(self.api)


_thread_state = threading.local()


def read_one(path_text: str) -> dict:
    path = Path(path_text)
    match = SLIDE_RE.search(path.name)
    if not match:
        raise ValueError(path)
    if not hasattr(_thread_state, "ocr"):
        _thread_state.ocr = LocalTesseract()
    text, confidence = _thread_state.ocr.read(path)
    return {
        "slideNumber": int(match.group(1)),
        "image": path.name,
        "text": text,
        "confidence": confidence,
        "engine": "libtesseract-5.5-eng-psm3",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slides", type=Path, default=ROOT / "iot102_slides")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "ocr_raw.json")
    parser.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1))
    args = parser.parse_args()
    images = sorted(args.slides.glob("slide_*.png"))
    if len(images) != 365:
        raise SystemExit(f"Expected 365 slide images, found {len(images)}")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        records = list(pool.map(read_one, map(str, images)))
    records.sort(key=lambda record: record["slideNumber"])
    payload = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": "365 local PNG renders",
        "networkUsed": False,
        "slides": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    nonempty = sum(bool(record["text"]) for record in records)
    average = sum(record["confidence"] for record in records) / len(records)
    print(f"OCR complete: {len(records)} slides, {nonempty} non-empty, mean confidence {average:.1f}")
    print(args.output)


if __name__ == "__main__":
    main()
