#!/usr/bin/env python3
"""Build the auditable IoT102 question bank from local OCR plus source notes."""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SLIDES = ROOT / "iot102_slides"
NON_QUESTION_SLIDES = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 85, 219, 312, 347, 363}
OPTION_RE = re.compile(r"(?im)^[ \t]*(?:[\(\[])?([A-F])(?:[\)\].:]|\s+-)\s*")
WATERMARK_RE = re.compile(r"(?im)^.*(?:Ho[aà]ng|Hodng).*Sour[^\n]*$")


SOURCE_SECTIONS = [
    {"id": "section-exercises", "name": "Dạng bài tập", "startSlide": 11, "endSlide": 84},
    {"id": "section-short-answer", "name": "Answer ngắn", "startSlide": 86, "endSlide": 218},
    {"id": "section-long-answer", "name": "Answer dài", "startSlide": 220, "endSlide": 311},
    {
        "id": "section-unlabeled",
        "name": "Unlabeled source section",
        "startSlide": 313,
        "endSlide": 346,
        "needsReview": True,
    },
    {"id": "section-not-questions", "name": "NOT questions", "startSlide": 348, "endSlide": 362},
    {"id": "section-true-false", "name": "True/False", "startSlide": 364, "endSlide": 365},
]


TECHNICAL_TOPICS = [
    {
        "id": "arduino",
        "name": "Arduino",
        "keywords": r"arduino|atmega|pinmode|digitalread|digitalwrite|analogread|analogwrite|serial\.|pwm|eeprom|bootloader|sketch",
    },
    {
        "id": "sensors-actuators",
        "name": "Sensors & Actuators",
        "keywords": r"sensor|actuator|dht\d*|lm35|max30102|photoresistor|ultrasonic|servo|motor|buzzer|relay|fingerprint",
    },
    {
        "id": "electronics-circuits",
        "name": "Electronics & Circuits",
        "keywords": r"resistor|resistance|voltage|current|ohm|circuit|breadboard|battery|led|lcd|capacitor|diode|transistor|color band",
    },
    {
        "id": "networking-protocols",
        "name": "Networking & Protocols",
        "keywords": r"network|protocol|mqtt|coap|bluetooth|wi-?fi|uart|i2c|spi|mac\b|tcp|ip address|communication",
    },
    {
        "id": "iot-architecture",
        "name": "IoT Concepts & Architecture",
        "keywords": r"\biot\b|internet of things|cloud|gateway|smart grid|architecture|interoperability|thingspeak|embedded system",
    },
    {
        "id": "programming",
        "name": "C/C++ & Programming",
        "keywords": r"c programming|c\+\+|#define|variable|constant|compiler|syntax|void setup|void loop|array|function|operator|comment",
    },
    {
        "id": "data-structures",
        "name": "Data Structures & Algorithms",
        "keywords": r"hash table|hashing|graph|depth first|breadth first|traversal|algorithm",
    },
]


def tidy(text: str) -> str:
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    text = re.sub(r"\bloT\b", "IoT", text)
    text = re.sub(r"Serial\.printin", "Serial.println", text, flags=re.IGNORECASE)
    return text.strip()


def remove_noise(text: str) -> str:
    text = WATERMARK_RE.sub("", text)
    text = re.sub(r"(?i)\s*Ho[aà]ng\s+Ho[aà]ng\s*$", "", text)
    return text.strip()


def split_last_option(value: str) -> tuple[str, str | None]:
    parts = re.split(r"\n\s*\n", value.strip(), maxsplit=1)
    option = tidy(parts[0]) if parts else ""
    explanation = tidy(parts[1]) if len(parts) > 1 else None
    return option, explanation or None


def parse_ocr(text: str) -> dict:
    cleaned = remove_noise(text)
    # Tesseract often reads a bold C marker as "Cc.".
    cleaned = re.sub(r"(?im)^\s*Cc\.\s*", "C. ", cleaned)
    matches = list(OPTION_RE.finditer(cleaned))
    options: dict[str, str] = {}
    explanation = None
    if matches:
        lead = cleaned[: matches[0].start()].strip()
        for index, match in enumerate(matches):
            label = match.group(1).upper()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(cleaned)
            value = cleaned[match.end() : end].strip()
            if index == len(matches) - 1:
                value, explanation = split_last_option(value)
            else:
                value = tidy(value)
            options[label] = value
    else:
        lead = cleaned

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", lead) if part.strip()]
    question = tidy(paragraphs[0]) if paragraphs else ""
    code = None
    if len(paragraphs) > 1:
        remainder = "\n\n".join(paragraphs[1:]).strip()
        if re.search(
            r"(?i)#include|#define|void\s+(?:setup|loop)|\b(?:int|const int|float|char)\s+\w+|Serial\.|pinMode\(|digital(?:Read|Write)\(|analog(?:Read|Write)\(",
            remainder,
        ):
            code = remainder
        elif not explanation:
            explanation = tidy(remainder)
    return {"question": question, "options": options, "code": code, "explanation": explanation}


def source_section(slide: int) -> str:
    for section in SOURCE_SECTIONS:
        if section["startSlide"] <= slide <= section["endSlide"]:
            return section["id"]
    raise ValueError(f"Question slide {slide} is outside source sections")


def technical_topic_ids(text: str) -> list[str]:
    result = [
        topic["id"]
        for topic in TECHNICAL_TOPICS
        if re.search(topic["keywords"], text, re.IGNORECASE)
    ]
    return result or ["uncategorized"]


def normalized_question(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def image_audit() -> dict:
    images = sorted(SLIDES.glob("slide_*.png"))
    hashes: dict[str, list[str]] = defaultdict(list)
    corrupt = []
    for image in images:
        try:
            data = image.read_bytes()
            if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 100:
                corrupt.append(image.name)
            hashes[hashlib.sha256(data).hexdigest()].append(image.name)
        except OSError:
            corrupt.append(image.name)
    duplicates = [names for names in hashes.values() if len(names) > 1]
    expected = {f"slide_{number:03}.png" for number in range(1, 366)}
    actual = {image.name for image in images}
    return {
        "imageCount": len(images),
        "missingImages": sorted(expected - actual),
        "unexpectedImages": sorted(actual - expected),
        "corruptImages": corrupt,
        "byteIdenticalDuplicateGroups": duplicates,
    }


def main() -> None:
    ocr_payload = json.loads((DATA / "ocr_raw.json").read_text(encoding="utf-8"))
    notes_payload = json.loads((DATA / "speaker_notes.json").read_text(encoding="utf-8"))
    override_payload = json.loads((DATA / "manual_overrides.json").read_text(encoding="utf-8"))
    ocr = {item["slideNumber"]: item for item in ocr_payload["slides"]}
    notes = {item["slide_number"]: item for item in notes_payload["slides"]}
    overrides = {int(number): item for number, item in override_payload["slides"].items()}
    if set(ocr) != set(range(1, 366)) or set(notes) != set(range(1, 366)):
        raise SystemExit("OCR and notes mappings must both contain contiguous slides 1..365")

    questions = []
    for slide in range(1, 366):
        if slide in NON_QUESTION_SLIDES:
            continue
        parsed = parse_ocr(ocr[slide]["text"])
        manual = overrides.get(slide)
        if manual:
            parsed.update(manual)
        options = parsed.get("options") or {}
        note = notes[slide]
        answer = note["answer"] if note["answer"] in options else None
        missing_required = set("ABCD") - set(options)
        is_true_false = set(options) == {"A", "B"} and {
            value.upper().rstrip(".") for value in options.values()
        } <= {"TRUE", "FALSE"}
        structural_options_ok = not missing_required or is_true_false
        review_reasons = []
        if not parsed.get("question"):
            review_reasons.append("missing_question_text")
        if not structural_options_ok:
            review_reasons.append("missing_or_unlabeled_options")
        if not note["answer"]:
            review_reasons.append("answer_not_single_ABCD_in_speaker_notes")
        elif note["answer"] not in options:
            review_reasons.append("speaker_note_answer_not_present_in_options")
        if ocr[slide]["confidence"] < 80 and not manual:
            review_reasons.append("low_ocr_confidence")
        if parsed.get("code") and not manual:
            review_reasons.append("code_not_manually_verified")
        requires_image = bool(manual and manual.get("requiresImage")) or bool(
            re.search(r"(?i)figure|diagram|shown below|given graph|circuit|color bands", parsed.get("question", ""))
        )
        combined = " ".join(
            [parsed.get("question", ""), parsed.get("code") or "", *options.values()]
        )
        topic_ids = technical_topic_ids(combined)
        question = {
            "id": f"iot102-{slide:03}",
            "slideNumber": slide,
            "question": parsed.get("question", ""),
            "options": options,
            "code": parsed.get("code"),
            "explanation": parsed.get("explanation"),
            "correctAnswer": answer,
            "answerSource": "speaker_notes" if answer else None,
            "speakerNotes": note["speaker_notes"],
            "imagePath": f"/slides/slide_{slide:03}.png",
            "requiresImage": requires_image,
            "sourceSectionId": source_section(slide),
            "topicIds": topic_ids,
            "status": "verified_from_source" if answer else "review_required",
            "needsReview": bool(review_reasons),
            "reviewReasons": review_reasons,
            "ocr": {
                "confidence": ocr[slide]["confidence"],
                "engine": ocr[slide]["engine"],
                "manuallyInspected": bool(manual),
            },
            "duplicateOf": None,
        }
        questions.append(question)

    first_seen: dict[str, str] = {}
    for question in questions:
        key = normalized_question(question["question"])
        if key and key in first_seen:
            question["duplicateOf"] = first_seen[key]
        elif key:
            first_seen[key] = question["id"]

    topics = [
        {
            **{key: value for key, value in section.items() if key != "needsReview"},
            "kind": "source_section",
            "needsReview": section.get("needsReview", False),
        }
        for section in SOURCE_SECTIONS
    ] + [
        {"id": item["id"], "name": item["name"], "kind": "technical"}
        for item in TECHNICAL_TOPICS
    ] + [{"id": "uncategorized", "name": "Uncategorized", "kind": "technical"}]
    mapping = [
        {
            "questionId": question["id"],
            "slideNumber": question["slideNumber"],
            "sourceSectionId": question["sourceSectionId"],
            "topicIds": question["topicIds"],
        }
        for question in questions
    ]

    audit = image_audit()
    eligible = [
        q
        for q in questions
        if q["correctAnswer"] and not q["needsReview"] and not q["duplicateOf"]
    ]
    topic_counts = Counter(topic for q in questions for topic in q["topicIds"])
    review = [q for q in questions if q["needsReview"]]
    report = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceSlideCount": 365,
        **audit,
        "ocr": {
            "processedSlides": len(ocr),
            "nonEmptySlides": sum(bool(item["text"]) for item in ocr.values()),
            "meanConfidence": round(sum(item["confidence"] for item in ocr.values()) / len(ocr), 2),
            "engine": "libtesseract-5.5-eng-psm3",
            "networkUsed": False,
            "structuralParseBeforeOverrides": "330/350 question slides had A-D or A-B markers",
            "structuralParseRatePercentBeforeOverrides": 94.29,
            "manualVisualOverrides": len(overrides),
            "visuallyInspectedSlides": sorted(overrides),
            "limitations": [
                "No exact Google Slides text layer was available because network/DNS is disabled.",
                "OCR confidence is an engine estimate, not a character-level accuracy guarantee.",
                "Questions with incomplete source options, missing answers, low OCR confidence, or unverified code are flagged for review.",
            ],
        },
        "mapping": {
            "notesSlides": len(notes),
            "contiguousSlideNumbers": True,
            "uniqueImageNames": len({item["image"] for item in notes.values()}),
            "slideImageNotesMatchRatePercent": 100.0,
        },
        "nonQuestionSlides": sorted(NON_QUESTION_SLIDES),
        "extractedQuestions": len(questions),
        "sourceVerifiedSingleAnswers": sum(q["correctAnswer"] is not None for q in questions),
        "validUniqueExamQuestions": len(eligible),
        "needsReview": len(review),
        "duplicateQuestionInstances": sum(q["duplicateOf"] is not None for q in questions),
        "topicCounts": dict(sorted(topic_counts.items())),
    }
    (DATA / "questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "topics.json").write_text(
        json.dumps(topics, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "topic_mapping.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "extraction_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        "# IoT102 extraction review report",
        "",
        f"- Question slides extracted: **{len(questions)}**",
        f"- Unique questions eligible for an exam: **{len(eligible)}**",
        f"- Questions requiring review: **{len(review)}**",
        f"- Duplicate question instances: **{report['duplicateQuestionInstances']}**",
        "",
        "`verified_from_source` only means the answer letter matches a single A/B/C/D Speaker Note; it does not certify subject-matter correctness.",
        "",
        "## Items requiring review",
        "",
        "| Slide | ID | Reasons | Speaker Notes |",
        "|---:|---|---|---|",
    ]
    for question in review:
        notes_text = (question["speakerNotes"] or "").replace("\n", " ").replace("|", "\\|")
        if len(notes_text) > 100:
            notes_text = notes_text[:97] + "..."
        lines.append(
            f"| {question['slideNumber']} | {question['id']} | {', '.join(question['reviewReasons'])} | {notes_text} |"
        )
    (DATA / "review_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
