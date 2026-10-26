# AI-Powered Intelligent Query Resolution System
### Infosys Internship Project • Milestone 1–4 Complete Implementation
**Lead Engineer:** Harshvardhan Raj | **Total Budget:** Exactly $0.00 (Zero paid APIs, no credit card required)

---

## 🌟 Executive Overview
Organizations, universities, and enterprise teams maintain large volumes of knowledge across disparate documents, policies, handbooks, and FAQs — yet retrieving accurate, verified answers remains slow and frustrating. 

This project delivers a **domain-agnostic, voice-and-text enabled conversational query resolution platform** that ingests multi-format documentation (PDF, DOCX, TXT, CSV), automatically constructs a vector RAG pipeline, orchestrates a **5-Agent LangGraph state machine**, provides **calibrated Sigmoid confidence scoring**, surfaces a real-time **Response Transparency Panel**, and continuously tracks knowledge gaps.

---

## 📐 System Architecture & Topology

```
                                  +------------------------------------+
                                  |   React.js Single-Page Frontend    |
                                  | (Tailwind CSS, Glassmorphism, TTS) |
                                  +-----------------+------------------+
                                                    | Web Speech API (Voice In/Out)
                                                    | REST API & JSON Payloads
                                                    v
                                  +------------------------------------+
                                  |   FastAPI Asynchronous Gateway     |
                                  |     (/api/upload, /api/query)      |
                                  +-----------------+------------------+
                                                    |
                       +----------------------------+----------------------------+
                       |                                                         |
                       v                                                         v
         +----------------------------+                            +----------------------------+
         |  Knowledge Base Ingestion  |                            | LangGraph Multi-Agent Flow |
         |   (pypdf, docx, CSV FAQ)   |                            | (Cyclic State Machine)     |
         +-------------+--------------+                            +-------------+--------------+
                       |                                                         |
         +-------------v--------------+                            +-------------v--------------+
         | Local FastEmbed (CPU 384d) |                            | 1. Memory Agent (8B)       |
         |    (bge-small-en-v1.5)     |                            | 2. Understanding Agent (8B)|
         +-------------+--------------+                            | 3. Clarification (70B)     |
                       |                                           | 4. Retrieval & Reranker    |
         +-------------v--------------+                            | 5. Response Synthesis(70B) |
         |   Qdrant Vector Database   |                            +-------------+--------------+
         | (Cloud Free Tier / Disk)   |                                          |
         +-------------+--------------+                                          v
                       |                                           +----------------------------+
                       +------------------------------------------>| Local FlashRank Cross-Enc. |
                                                                   |  (ms-marco, Sigmoid Cfg.)  |
                                                                   +-------------+--------------+
                                                                                 |
                                                                                 v
                                                                   +----------------------------+
                                                                   | Relational Analytics (SQL) |
                                                                   | (Neon Postgres / SQLite)   |
                                                                   +----------------------------+
```

---

## 💰 Exactly $0.00 Cost Breakdown

| Component | Technology | Cost | Free-Tier Limits & Behavior |
| :--- | :--- | :--- | :--- |
| **Vector Database** | Qdrant Cloud Free Tier / Local Disk | **$0.00** | 1GB managed vector storage, zero credit card |
| **Embeddings** | FastEmbed (`bge-small-en-v1.5`) | **$0.00** | 384-dimensional dense vectors generated locally on CPU |
| **Cross-Encoder Reranker** | FlashRank (`ms-marco`) | **$0.00** | Stage-2 precision cross-encoder reranking on CPU |
| **Multi-Agent Orchestration** | LangGraph + Groq Cloud Free Tier | **$0.00** | `llama-3.1-8b-instant` & `llama-3.3-70b-versatile` |
| **Voice Input & TTS** | Browser Web Speech API | **$0.00** | Native `SpeechRecognition` and `speechSynthesis` |
| **Relational & Analytics** | Neon.tech / Supabase / SQLite | **$0.00** | PostgreSQL document metadata & `query_analytics` |

---

## 🤖 Multi-Agent LangGraph Orchestration Layer

The system coordinates 5 specialized agents structured as a cyclic directed graph:

1. **Conversation Memory Agent** (`llama-3.1-8b-instant`, temp 0.0):
   Resolves conversational pronouns (*"How much does it cost?"*, *"What about that?"*) into self-contained standalone search queries.
2. **Query Understanding Agent** (`llama-3.1-8b-instant`, temp 0.0):
   Classifies query intent into `factual`, `procedural`, `comparative`, or `ambiguous`.
3. **Clarification Agent** (`llama-3.3-70b-versatile`, temp 0.3):
   If `is_ambiguous == True`, routes immediately to this agent to prompt the user with clarifying options instead of executing speculative vector searches.
4. **Retrieval & Reranking Agent**:
   Retrieves Top-15 candidate chunks from Qdrant, applies FlashRank cross-encoder reranking, and computes calibrated Sigmoid confidence scores:
   $$C = \frac{1}{1 + e^{-z}}$$
   Chunks with confidence below $0.40$ are filtered out. If all chunks fall below $0.40$, a **Knowledge Gap** is automatically detected and logged to `query_analytics`.
5. **Response Generation Agent** (`llama-3.3-70b-versatile`, temp 0.1):
   Synthesizes grounded responses strictly using verified chunks, appending inline citations formatted as `[DocumentName, p.X, Chunk#Y]`.

---

## 🎙️ Browser-Native Voice Integration (Web Speech API)

- **Voice Input (`window.SpeechRecognition`)**:
  - Live interim transcription tooltip with pulsing audio indicator.
  - Dictation automatically populates query input and submits upon silence.
- **Voice Output (`window.speechSynthesis`)**:
  - **Regex-Sanitized TTS**: Strips markdown formatting (`**`, `*`, `_`), code fences, bullet symbols, and bracketed citations like `[hr_policy.txt, p.1, Chunk#1]` before speech generation, ensuring clean, natural vocal delivery.
  - Audio waveform animation bars and one-click play/pause/stop controls.

---

## 📊 Response Transparency Panel & Knowledge Gap Detection

- **Response Transparency Panel**:
  - Side inspector panel displaying original raw query vs. coreference-resolved standalone query.
  - Visual confidence badge: High ($\ge 75\%$), Medium ($40\% - 74\%$), or Knowledge Gap ($< 40\%$).
  - Full source chunk cards with document name, page number, chunk index, and copy button.
- **Knowledge Gap Analytics Modal**:
  - Real-time dashboard showing total queries, unanswered questions, and low-confidence rate.
  - Table of flagged queries for administrator review and knowledge base gap resolution.

---

## 🚀 Quickstart & Local Setup Guide

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ (Tested on Node v24)

### 2. Backend Installation & Startup
```bash
# Navigate to backend
cd backend

# Create .env from template (Zero cost keys)
copy .env.example .env

# Install backend dependencies
pip install -r requirements.txt

# Run automated test suite (12 tests)
python -m pytest tests -v

# Start FastAPI Server (Runs on port 8000)
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Installation & Startup
```bash
# In a new terminal, navigate to frontend
cd frontend

# Install frontend dependencies
npm install

# Start Vite React Dev Server (Runs on port 5173)
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 🧪 Automated Test Verification

The backend includes a comprehensive pytest suite covering all project milestones:
```bash
cd backend
python -m pytest tests -v
```

**Test Coverage Highlights:**
- `test_pydantic_schemas`: Validates strict JSON schemas for all 5 agents.
- `test_intent_classification`: Tests factual, procedural, comparative, and ambiguous intents.
- `test_langgraph_ambiguous_flow`: Verifies conditional routing to the Clarification Agent.
- `test_sigmoid_confidence_calculation`: Tests mathematical formula $C = \frac{1}{1 + e^{-z}}$ and bounds.
- `test_reranker_threshold_and_knowledge_gap`: Verifies 0.40 threshold filtering.
- `test_parse_txt_and_chunking`: Tests RecursiveCharacterTextSplitter (800 / 120).
- `test_parse_csv_faq`: Tests CSV FAQ question-answer chunking.
- `test_parse_pdf`: Tests PDF parsing and page-number attribution.
- `test_seed_and_query_flow`: Validates end-to-end FastAPI query pipeline.

---

## 📁 Repository Directory Structure

```
├── backend/
│   ├── .env.example              # Free-tier environment template
│   ├── requirements.txt          # Python dependencies
│   ├── config.py                 # Configuration & $0.00 model defaults
│   ├── database.py               # SQLAlchemy schema (documents, chunks, sessions, analytics)
│   ├── ingestion.py              # Multi-format parsers (PDF, DOCX, TXT, CSV) & FastEmbed
│   ├── reranker.py               # FlashRank cross-encoder & Sigmoid confidence scoring
│   ├── agents.py                 # 5 LangGraph agent nodes & compiled StateGraph
│   ├── main.py                   # FastAPI application & REST endpoints
│   ├── sample_data/              # Primed domain datasets (HR, Academic, FAQ CSV, PDF)
│   │   ├── hr_policy.txt
│   │   ├── student_handbook.txt
│   │   ├── faq_knowledge.csv
│   │   └── cloud_architecture.pdf
│   └── tests/                    # Pytest test suite
│       ├── test_agents.py
│       ├── test_api.py
│       ├── test_ingestion.py
│       └── test_reranker.py
├── frontend/
│   ├── package.json              # React 19, Tailwind CSS, Lucide icons
│   ├── vite.config.js            # Vite configuration
│   ├── tailwind.config.js        # Glassmorphic dark design tokens
│   ├── index.html                # Google Fonts & viewport metadata
│   └── src/
│       ├── main.jsx              # React DOM entry point
│       ├── App.jsx               # Main state orchestrator
│       ├── index.css             # Glassmorphism & audio waveform animations
│       ├── utils/
│       │   ├── speech.js         # Web Speech API wrapper & regex text sanitizer
│       │   └── api.js            # REST API client
│       └── components/
│           ├── Navbar.jsx        # Top brand, status pills, action buttons
│           ├── Sidebar.jsx       # Document uploader, domain tabs, doc list
│           ├── ChatInterface.jsx # Message feed, agent tracker, voice mic, TTS
│           ├── TransparencyPanel.jsx # Source chunks, confidence gauge, citations
│           └── AnalyticsModal.jsx    # Knowledge gap dashboard & gap logs
└── README.md
```

---

## 🏆 Project Milestone Compliance Matrix

| Milestone | Deliverable | Status |
| :--- | :--- | :--- |
| **Milestone 1** | Ingestion pipeline (PDF, DOCX, TXT, CSV), 800/120 chunking, FastEmbed vector indexing | ✅ Completed & Verified |
| **Milestone 2** | Query Understanding Agent, Retrieval Agent, Response Generation Agent, LangGraph flow | ✅ Completed & Verified |
| **Milestone 3** | Clarification Agent, Conversation Memory Agent, Web Speech API Voice I/O, Transparency Panel | ✅ Completed & Verified |
| **Milestone 4** | Knowledge Gap Analytics, low-confidence logging (<0.40), 12 automated unit tests, multi-domain validation | ✅ Completed & Verified |
