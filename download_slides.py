#!/usr/bin/env python3
"""Export slide previews permitted by Google Slides API; no download restriction bypass."""
import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/presentations.readonly']
DEFAULT_URL = 'https://docs.google.com/presentation/d/1nr2WMkvs3wFKim-sqB7xTyJRnR2MEnL6WOSr-PN7kw4/edit'


def presentation_id(value):
    match = re.search(r'/presentation/d/([\w-]+)', value)
    return match.group(1) if match else value.strip()


def authorize(root):
    token_file = root / 'token.json'
    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            client_secrets = root / 'credentials.json'
            if not client_secrets.exists():
                raise SystemExit('Thiếu credentials.json. Xem README.md để tạo OAuth Desktop Client.')
            creds = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES).run_local_server(port=0)
        token_file.write_text(creds.to_json(), encoding='utf-8')
    return creds


def api_get(url, creds):
    if not creds.valid:
        creds.refresh(Request())
    response = requests.get(url, headers={'Authorization': 'Bearer ' + creds.token}, timeout=50)
    response.raise_for_status()
    return response.json()


def main():
    ap = argparse.ArgumentParser(description='Save rendered Google Slides as PNG for study quizzes')
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--output', default='iot102_slides')
    ap.add_argument('--start', type=int, default=1)
    ap.add_argument('--end', type=int)
    ap.add_argument('--size', choices=['SMALL', 'MEDIUM', 'LARGE'], default='LARGE')
    args = ap.parse_args()
    root = Path(__file__).resolve().parent
    creds = authorize(root)
    pid = presentation_id(args.url)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    data = api_get(f'https://slides.googleapis.com/v1/presentations/{pid}?fields=presentationId,title,slides(objectId)', creds)
    slides = data.get('slides', [])
    records = []
    print(f"Deck: {data.get('title', pid)} | Tổng: {len(slides)} slides")
    for index, slide in enumerate(slides, start=1):
        if index < args.start or index > (args.end or len(slides)):
            continue
        path = out / f'slide_{index:03d}.png'
        status = 'ok'
        try:
            sid = slide['objectId']
            if not path.exists():
                thumb = api_get(f'https://slides.googleapis.com/v1/presentations/{pid}/pages/{sid}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize={args.size}', creds)
                # contentUrl is a short-lived Google-hosted image URL returned to the authorized viewer.
                resp = requests.get(thumb['contentUrl'], timeout=60)
                resp.raise_for_status()
                if not resp.content.startswith(b'\x89PNG\r\n\x1a\n'):
                    raise ValueError('Google did not return a PNG image')
                path.write_bytes(resp.content)
            print(f'[{index}/{len(slides)}] {path}')
        except Exception as exc:
            status = f'error: {exc}'
            print(f'[{index}/{len(slides)}] Không tải được: {exc}')
        records.append({'slide': index, 'objectId': slide['objectId'], 'image': path.name if status == 'ok' else None, 'status': status})
        time.sleep(0.15)
    (out / 'manifest.json').write_text(json.dumps({'presentationId': pid, 'title': data.get('title'), 'slides': records}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Hoàn thành. Kết quả: {out.resolve()}')

if __name__ == '__main__':
    main()
