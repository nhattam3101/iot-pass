#!/usr/bin/env python3
"""Read Google Slides speaker notes through the official read-only Slides API."""
import argparse
import json
import re
from pathlib import Path

# Reuse existing OAuth, scope, and HTTP helper. No new permissions needed.
from download_slides import DEFAULT_URL, authorize, presentation_id, api_get


def text_from_elements(elements):
    return "".join(
        element.get("textRun", {}).get("content", "")
        for element in (elements or [])
    ).strip()


def notes_for_slide(slide):
    properties = slide.get("slideProperties", {})
    notes_page = properties.get("notesPage", {})
    notes_id = notes_page.get("notesProperties", {}).get("speakerNotesObjectId")
    if not notes_id:
        return None, "missing_notes_placeholder"

    for element in notes_page.get("pageElements", []):
        if element.get("objectId") == notes_id:
            return text_from_elements(element.get("shape", {}).get("text", {}).get("textElements", [])), "ok"
    return None, "notes_element_not_found"


def normalize_answer(notes):
    """Accept exactly one answer letter; do not infer from ambiguous notes."""
    if not notes:
        return None
    s = notes.strip().upper()
    if re.fullmatch(r"[ABCD]", s):
        return s
    return None


def build_record(index, slide):
    notes, status = notes_for_slide(slide)
    answer = normalize_answer(notes)
    return {
        "slide_number": index,
        "slide_object_id": slide["objectId"],
        "image": f"slide_{index:03d}.png",
        "speaker_notes": notes,
        "answer": answer,
        "answer_source": "speaker_notes" if answer else None,
        "notes_status": status if status != "ok" else ("empty" if not notes else "ok"),
        "needs_review": bool(notes and not answer) or status not in ("ok",),
    }


def main():
    parser = argparse.ArgumentParser(description="Extract notes and answer letters from Google Slides")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--output", default="data/speaker_notes.json")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    credentials = authorize(root)
    pid = presentation_id(args.url)
    # Use one API read for the full deck; notes are in the notesPage object.
    # Request the notesPage object as a whole to avoid malformed nested field masks.
    url = (
        f"https://slides.googleapis.com/v1/presentations/{pid}"
        "?fields=presentationId,title,slides(objectId,slideProperties(notesPage))"
    )
    data = api_get(url, credentials)
    slides = data.get("slides", [])
    records = [build_record(i, slide) for i, slide in enumerate(slides, 1)]
    payload = {
        "presentationId": pid,
        "title": data.get("title"),
        "slide_count": len(records),
        "slides": records,
    }
    output = Path(args.output)
    if not output.is_absolute():
        output = root / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    answers = sum(record["answer"] is not None for record in records)
    ambiguous = sum(record["needs_review"] for record in records)
    print(f"Đã đọc {len(records)} slides; {answers} đáp án A–D; {ambiguous} mục cần kiểm tra.")
    print(f"Đã lưu: {output}")
    if len(records) >= 15:
        print(f"Slide 15: {records[14]['speaker_notes']!r} (answer={records[14]['answer']!r})")
    print("Lưu ý: Đáp án là nội dung ghi chú của người soạn, chưa được xác minh đúng về kiến thức.")


if __name__ == "__main__":
    main()
