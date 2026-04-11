# 🧠 Arkivo AI — Intelligent Document Processing

An advanced AI-powered SaaS document management system. It seamlessly uploads documents (PDF, JPG, PNG), extracts multi-lingual text using PaddleOCR with precision bounding boxes, and leverages LLM integration (GPT-4o-mini via OpenRouter) to intelligently classify, structure, and extract 9 core metabolic fields with unparalleled accuracy.

## ⚡ Quick Start

### Prerequisites

1. **Python 3.10+** — [Download](https://www.python.org/downloads/)
2. **Tesseract OCR** — [Download for Windows](https://github.com/UB-Mannheim/tesseract/wiki)
   - Install to default path: `C:\Program Files\Tesseract-OCR\`
   - During install, check "Add to PATH"
3. **Poppler** (needed for PDF support) — [Download for Windows](https://github.com/oschwartz10612/poppler-windows/releases/)
   - Extract to a folder (e.g. `C:\poppler`)
   - Add the `bin` folder to your system PATH, or set the environment variable:
     ```
     set POPPLER_PATH=C:\poppler\Library\bin
     ```

### Install & Run

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Run database migration (first time only)
python migrate_db.py

# 3. Start the server
python -m uvicorn main:app --reload --port 8000
```

### Open the App

Navigate to **http://localhost:8000** in your browser.
API documentation is available at **http://localhost:8000/docs**

## 📋 Features

### Milestone 1 — Core Document Management & UI
- ✅ **Premium SaaS Dashboard** — Dark-themed, responsive, modern interface with scalable SVG iconography.
- ✅ **Multi-page PDF Handling** — Automatically splits large PDFs into managed folders containing individual page documents.
- ✅ **Document Operations** — Drag-and-drop uploads, instant preview generation with cache-busting, and accurate single-page PDF extraction using `pypdf`.
- ✅ **Robust Download System** — Properly reconstructs single pages into standalone PDF files on the fly.

### Milestone 2 — Intelligent AI Extraction Engine
- ✅ **LLM-Powered Extraction** — Fully integrated OpenRouter API (GPT-4o-mini) to intelligently extract and normalize data replacing legacy regex rules.
- ✅ **Universal Language Support** — Accurately extracts fields across English, Albanian, Serbian, and more.
- ✅ **9 Core Metadata Fields** — Invoice Number, Vendor Company, Total Amount, Issue Date, Due Date, Currency, Client Name, Document Type, and Expiry Date.
- ✅ **Editable Metadata Data Display** — Clean, structured form presentation allowing users to rapidly verify and overwrite AI-extracted fields.

### Milestone 3 — Bulk Actions & Advanced Exports
- ✅ **Folder-Level Processing** — "AI Data Extraction ALL" allows processing entire folders in one click with smooth, modern UI progress bars.
- ✅ **Single-run Optimizations** — Batch extractor intelligently skips documents that already contain generated metadata.
- ✅ **Folder-Level Exports** — Quickly export the metadata of all pages within a specific document folder directly to `.csv`, `.xlsx`, or `.txt`.
- ✅ **Custom Advanced Export** — Export exactly what you see after applying custom metadata filters to your document database.
- ✅ **Global Exports** — Filter by format and extract global system data.
- ✅ **Mode 1: Financial Advisor** — AI generates custom actionable financial insights and advice based on real-time aggregated document values.
- ✅ **Mode 2: Semantic Search** — Query documents naturally ("Show invoices from 2026"). AI automatically extracts criteria and builds the search results inline.
- ✅ **Mode 3: System Action** — Use AI commands to drive the UI. The assistant parses intent and interacts with the application to magically apply search filters and switch views.
- ✅ **Mode 4: General Greeting** — A conversational layer allowing the AI to casually introduce itself and guide users on its capabilities.
### Milestone 4 — Multi-Modal AI Assistant
continuous
-------------------------------------
## 🛠 Tech Stack

| Component       | Technology       |
|-----------------|------------------|
| Backend         | Python FastAPI   |
| OCR / Vision    | PaddleOCR (latin), Poppler, pdf2image |
| AI Extraction   | OpenRouter (GPT-4o-mini), LLM JSON Prompting |
| Manipulation    | PyPDF for runtime PDF splitting |
| Database        | SQLite + SQLAlchemy |
| Export          | openpyxl (Excel) + Python CSV |
| Frontend        | HTML / Vanilla CSS / Vanilla JS |

## 📁 Project Structure

```
fiverocr/
├── backend/
│   ├── main.py               # API routes (upload, export, bulk processing)
│   ├── models.py             # SQLite Database Schema
│   ├── database.py           # DB connection setup
│   ├── ocr_service.py        # PaddleOCR pipeline & text coordinates
│   ├── extraction_service.py # LLM-based intelligent structured data parser
│   ├── migrate_db.py         # DB schema migration
│   ├── requirements.txt      # Python dependencies
│   └── uploads/              # Uploaded files storage
├── frontend/
│   ├── index.html            # Premium UI Dashboard layout
│   ├── style.css             # Fluid animations, CSS Variables
│   └── app.js                # Core JS logic, API binding, folder tracking
├── poppler/                  # Poppler binaries (PDF→image)
└── README.md                 # Project Documentation
```

## 📌 Core API Endpoints

### Document API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/documents/upload` | Upload & OCR document. Splits PDFs into folders. |
| GET    | `/api/documents/{id}/children` | Get pages of a parent PDF folder. |
| GET    | `/api/documents/{id}/download` | Robust file download. Extracts pages independently. |

### AI & Export API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/documents/{id}/extract` | Run LLM data extraction for a document. |
| PUT    | `/api/documents/{id}/extract` | Update/save manually edited metadata fields. |
| POST   | `/api/documents/search` | Full-text and metadata advanced document search. |
| POST   | `/api/ai/chat`          | Interact with the Multi-Modal AI Assistant. |
| GET    | `/api/export/folder/{id}` | Export extraction metadata for a single folder. |
| POST   | `/api/export/custom`    | Export custom filtered document searches. |
| GET    | `/api/export/all`       | Export metadata for all global documents. |
