# IoT102 Exam Lab

Ứng dụng React + TypeScript + Vite + Tailwind CSS để luyện tập và thi thử từ 365 ảnh slide IoT102. Dữ liệu câu hỏi được OCR cục bộ từ ảnh trước, ghép với Speaker Notes theo số slide, kiểm tra cấu trúc, gắn topic và giữ liên kết đến ảnh nguồn.

## Kết quả dữ liệu hiện tại

- 365/365 ảnh PNG đã audit; không thiếu, không hỏng và không có file trùng byte.
- 350 slide được xác định là câu hỏi; 15 slide là metadata hoặc tiêu đề/phân đoạn.
- 338 câu có đáp án A/B/C/D đơn nhất từ Speaker Notes.
- 298 câu duy nhất đủ điều kiện vào đề thi sau validation và loại bản trùng.
- 21 câu được giữ trong danh sách `needsReview`; không đoán đáp án cho Notes mơ hồ.
- OCR local: libtesseract 5.5 English, 365 slide, confidence trung bình của engine 88.47%.
- 28 slide lỗi cấu trúc/code/diagram đã được kiểm tra trực tiếp trên ảnh và có override có kiểm toán.

`verified_from_source` chỉ có nghĩa chữ cái đáp án khớp Speaker Notes, không khẳng định đáp án đúng về kiến thức.

## Chạy trên Fedora

Yêu cầu Node.js 20+ và npm:

```bash
cd /run/media/nhattam3101/Data/06_PERSONAL/iot_slide_tool
npm install
npm run dev
```

Mở URL Vite in ra, thường là `http://localhost:5173`.

Build và kiểm thử:

```bash
npm run test
npm run build
npm run preview
```

Build production nằm trong `dist/` và chứa đủ ảnh tại `dist/slides/`.

## Pipeline dữ liệu

Không cần chạy lại downloader để sử dụng website. Nếu cần tái tạo OCR/question bank từ chính các PNG đã có:

```bash
sudo dnf install ImageMagick tesseract tesseract-langpack-eng
python3 scripts/ocr_slides.py
python3 scripts/build_question_bank.py
npm run test
```

Pipeline:

```text
365 PNG → OCR local → structured parser → direct visual overrides
        → Speaker Notes mapping → validation/deduplication → question bank
```

Các file chính:

- `data/ocr_raw.json`: OCR thô của đủ 365 ảnh, kèm confidence và engine.
- `data/questions.json`: ngân hàng 350 câu độc lập với Google Slides.
- `data/topics.json`: source sections và technical topics.
- `data/topic_mapping.json`: mapping câu hỏi → section/topic.
- `data/extraction_report.json`: audit máy đọc được.
- `data/review_report.md`: danh sách câu phải kiểm tra.
- `data/manual_overrides.json`: các chỉnh sửa được đọc trực tiếp từ ảnh.

Website lưu tiến độ, câu đánh dấu, lịch sử thi và chỉnh sửa ngân hàng trong LocalStorage. Import/export đều là JSON local; không có cloud sync mặc định và không sửa dữ liệu Google Slides/PNG gốc.

## Tính năng

- Dashboard, tiến độ theo topic và lịch sử thi.
- Practice Mode: text/code, feedback sau khi chọn, explanation, ảnh slide khi cần.
- Mock Exam: 50 câu duy nhất, timer cấu hình, review flags, tự nộp, chấm thang 10.
- Ôn câu sai/câu đánh dấu, lọc theo topic.
- Duyệt/search/filter ngân hàng; chỉnh sửa bản dữ liệu ứng dụng trong browser.
- Export/import progress, question bank và exam history.

## Kiểm thử đã có

`tests/data-validation.test.ts` kiểm tra mapping, ID, đáp án/options, ảnh và topic. `tests/exam.test.ts` kiểm tra đủ 50 câu, không trùng ID/nội dung, không tạo câu giả khi thiếu và chấm điểm.

---

## Công cụ tải slide ban đầu

# IoT102 Google Slides → PNG (Viewer)

Tool dùng **Google Slides API chính thức** để lưu bản render PNG của từng slide, phù hợp đưa vào AI tạo quiz. Không cần quyền Editor. Không vượt qua quyền hạn: nếu API từ chối, tool sẽ thông báo lỗi. Kết quả là ảnh slide, **không nhất thiết là ảnh nguồn gốc đã chèn**.

## Thiết lập một lần

1. Vào https://console.cloud.google.com/ tạo hoặc chọn Google Cloud project.
2. Bật **Google Slides API** trong APIs & Services → Library.
3. Trong Google Auth Platform, cấu hình OAuth consent screen, chọn **External** (nếu cần), và thêm địa chỉ Gmail hiện tại vào **Test users** khi ứng dụng ở chế độ Testing.
4. Trong **Clients**, tạo **OAuth client ID → Desktop app**. Tải JSON về, đặt tên `credentials.json` cạnh `download_slides.py`.
5. Dùng Google account hiện đang có quyền xem Slides để cấp quyền `presentations.readonly` khi tool mở trình duyệt. Không chia sẻ `credentials.json` hoặc `token.json`.

## Chạy trên Fedora

```bash
cd iot_slide_tool
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_slides.py
```

Lệnh mặc định nhắm vào bài `Sever_1_SEMESTER_4_IOT102` mà bạn gửi và tải toàn bộ slide được phép đọc.

Chỉ tải slide 11–58 (phần đầu của bài tập):

```bash
python download_slides.py --start 11 --end 58
```

Với tài liệu khác:

```bash
python download_slides.py --url 'https://docs.google.com/presentation/d/YOUR_ID/edit' --output another_deck
```

Kết quả: `iot102_slides/slide_001.png`, `slide_002.png`, ... và `manifest.json`.

## Dùng để làm quiz

Đưa thư mục PNG cho Codex/AI có hỗ trợ đọc hình ảnh, yêu cầu nhận diện từng câu hỏi và lựa chọn, xuất `questions.json` theo schema:

```json
[
  {
    "slide": 15,
    "question": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "answer": null,
    "answer_source": "unverified",
    "explanation": "..."
  }
]
```

Không tự cho đáp án khi tài liệu không cung cấp hoặc chưa xác minh. Những slide không phải câu hỏi thì bỏ qua. Kiểm tra thủ công các ảnh mờ hoặc có overlay.

Nếu lỗi 403: kiểm tra tài khoản đang cấp OAuth, quyền Viewer, và chính sách download/copy của chủ sở hữu. Không dùng token đăng nhập từ DevTools hay cookie thô.
