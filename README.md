# AI-Powered Intelligent Query Resolution System
### Infosys Internship Project • Complete Milestone 1–4 Enterprise Implementation
**Lead Engineer:** Harshvardhan Raj | **Total Budget:** Exactly $0.00 (Zero paid APIs, no credit card required)

---

## 🌐 Live Cloud Deployments

| Component | Platform | Live URL |
| :--- | :--- | :--- |
| **Frontend Application** | Vercel | [development-of-ai-based-knowledge-r-neon.vercel.app](https://development-of-ai-based-knowledge-r-neon.vercel.app) |
| **Backend REST API** | Render | [development-of-ai-based-knowledge-5kcv.onrender.com](https://development-of-ai-based-knowledge-5kcv.onrender.com) |
| **Interactive Swagger API Docs** | Render | [development-of-ai-based-knowledge-5kcv.onrender.com/docs](https://development-of-ai-based-knowledge-5kcv.onrender.com/docs) |

---

## 🌟 Executive Overview
Organizations, universities, and enterprise teams maintain large volumes of knowledge across disparate documents, policies, handbooks, and FAQs — yet retrieving accurate, verified answers remains slow, fragmented, and frustrating. 

This project delivers a **production-grade, domain-agnostic, voice-and-text conversational query resolution platform** that ingests multi-format documentation (PDF, DOCX, TXT, CSV), automatically constructs a vector RAG pipeline, orchestrates a **5-Agent LangGraph state machine**, provides **calibrated Sigmoid confidence scoring**, surfaces a real-time **Response Transparency Panel**, and continuously tracks knowledge gaps.

---

## 📐 System Architecture & Topology

```
                                  +------------------------------------+
                                  |   React.js Single-Page Frontend    |
                                  | (Tech Blue, Dark Slate, Web Speech)|
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
                                                                   |  (MiniLM-L-6, Sigmoid Cfg) |
                                                                   +-------------+--------------+
                                                                                 |
                                                                                 v
                                                                   +----------------------------+
                                                                   | Relational Analytics (SQL) |
                                                                   | (Neon Postgres / SQLite)   |
                                                                   +----------------------------+
```

---

## 🎨 Executive UI/UX Design System

The system implements a refined, minimalistic tech aesthetic built with Tailwind CSS:
* **Background Canvas**: Executive dark slate (`#0B0F19`).
* **Card Surfaces**: Clean, structured surfaces (`#111827`) with subtle 1px border dividers (`#1F2937`).
* **Accent Color**: Sophisticated Tech Blue (`#3B82F6`) for primary interactions, active states, and citations.
* **Minimalist & Accessible**: Strictly free of neon glow effects, excessive gradients, or visual clutter.

---

## 💰 Exactly $0.00 Cost Breakdown

| Component | Technology | Cost | Free-Tier Limits & Behavior |
| :--- | :--- | :--- | :--- |
| **Vector Database** | Qdrant Cloud Free Tier / Local Disk | **$0.00** | 1GB managed vector cluster, zero credit card required |
| **Embeddings** | FastEmbed (`BAAI/bge-small-en-v1.5`) | **$0.00** | 384-dimensional dense vectors generated locally on CPU |
| **Cross-Encoder Reranker** | FlashRank (`ms-marco-MiniLM-L-6-v2`) | **$0.00** | Stage-2 precision cross-encoder reranking on CPU |
| **Multi-Agent Orchestration** | LangGraph + Groq Cloud Free Tier | **$0.00** | `llama-3.1-8b-instant` & `llama-3.3-70b-versatile` |
| **LLM Fallback** | Google AI Studio | **$0.00** | `gemini-2.5-flash` free tier |
| **Voice Input & TTS** | Browser Web Speech API | **$0.00** | Native `SpeechRecognition` and `speechSynthesis` |
| **Relational & Analytics** | Supabase / Neon / SQLite | **$0.00** | PostgreSQL document metadata & `query_analytics` |
| **Cloud Hosting** | Vercel (Frontend) + Render (Backend) | **$0.00** | Fully automated GitHub CI/CD deployments |

---

## 🤖 Multi-Agent LangGraph Orchestration Layer

The query engine coordinates 5 specialized agents structured as a cyclic directed state machine:

1. **Conversation Memory Agent** (`llama-3.1-8b-instant`, temp 0.0):
   Resolves conversational pronouns (*"How much does it cost?"*, *"What about that?"*) into self-contained standalone search queries using session history.
2. **Query Understanding Agent** (`llama-3.1-8b-instant`, temp 0.0):
   Classifies query intent into `factual`, `procedural`, `comparative`, or `ambiguous`.
3. **Clarification Agent** (`llama-3.3-70b-versatile`, temp 0.3):
   If `is_ambiguous == True`, routes immediately to this agent to prompt the user with clarifying options instead of executing speculative vector searches.
4. **Retrieval & Reranking Agent**:
   Retrieves Top-15 candidate chunks from Qdrant, applies FlashRank cross-encoder reranking (`ms-marco-MiniLM-L-6-v2`), and computes calibrated Sigmoid confidence scores:
   $$C = \frac{1}{1 + e^{-z}}$$
   Chunks below the $0.40$ confidence threshold are filtered out. If all chunks fall below $0.40$, a **Knowledge Gap** is automatically detected and logged to `query_analytics`.
5. **Response Generation Agent** (`llama-3.3-70b-versatile`, temp 0.1):
   Synthesizes grounded responses strictly using verified chunks, appending inline citations formatted as `[DocumentName, p.X, Chunk#Y]`.

---

## 🎙️ Hardened Web Speech API Voice Integration

- **Voice Input (`window.SpeechRecognition` / `window.webkitSpeechRecognition`)**:
  - **Pre-flight Permission Verification**: Invokes `navigator.mediaDevices.getUserMedia({ audio: true })` to verify microphone access before starting recognition.
  - **Continuous Audio Streaming**: Enabled `continuous: true` and interim text streaming so speech isn't cut off by natural pauses.
  - **Clean Session Lifecycle**: Dynamically creates a new instance per session to eliminate `InvalidStateError` or silent aborts.
  - **In-App Troubleshooting**: Provides actionable UI alerts if microphone permissions are blocked by the browser.
- **Voice Output (`window.speechSynthesis`)**:
  - **Regex-Sanitized TTS**: Strips markdown formatting (`**`, `*`, `_`), code fences, bullet symbols, and bracketed citations like `[hr_policy.txt, p.1, Chunk#1]` before speech generation for fluent vocal delivery.
  - Audio waveform animation bars and one-click play/pause/stop controls.

---

## 📊 Key UI & Management Features

1. **Collapsible LangGraph Pipeline Ribbon**:
   - The multi-agent pipeline ribbon is wrapped in a dropdown trigger (**`LangGraph Pipeline: [ 5 Agents ▾ ]`**).
   - Collapsed by default to maximize vertical screen space, and can be toggled open whenever needed.
2. **Dynamic Document-Driven Query Suggestions**:
   - Replaced static placeholder cards with dynamic prompts derived directly from the currently uploaded files.
   - When documents are deleted from the knowledge base, their corresponding suggestions are immediately removed.
   - If the knowledge base is empty, a clean informational placeholder invites the user to upload or seed documents.
3. **Knowledge Gap Analytics & Management**:
   - Real-time dashboard tracking total queries, unanswered questions, and low-confidence queries ($< 0.40$).
   - Granular deletion: Delete individual gap reports with a trash can icon or purge all previous reports in bulk with **`Clear All Reports`**.
4. **Response Transparency Panel**:
   - Side inspector comparing raw user query vs. coreference-resolved standalone query.
   - Calibrated confidence gauge: High ($\ge 75\%$), Medium ($40\% - 74\%$), or Knowledge Gap ($< 40\%$).
   - Source chunk cards displaying document name, page number, chunk index, and copy button.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | System status, version, and budget verification |
| `GET` | `/api/health` | Comprehensive health check (DB, Qdrant, FastEmbed, FlashRank, Groq) |
| `POST` | `/api/upload` | Ingest multi-format documents (PDF, DOCX, TXT, CSV) |
| `GET` | `/api/documents` | List all indexed documents with chunk counts |
| `DELETE` | `/api/documents/{id}` | Delete a document and its indexed vectors (failsafe Point ID deletion) |
| `POST` | `/api/query` | Execute multi-agent LangGraph query resolution |
| `GET` | `/api/analytics` | Fetch summary metrics and recent knowledge gaps |
| `DELETE` | `/api/analytics/{gap_id}` | Delete a specific knowledge gap report |
| `DELETE` | `/api/analytics` | Clear all historical knowledge gap reports |
| `POST` | `/api/seed-samples` | Primed domain dataset loader (HR, Academic, FAQ, Cloud) |
| `GET` | `/api/chat/history/{session_id}` | Retrieve persistent session history |

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

# Run automated test suite
python -m pytest tests -o pythonpath=. -v

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
python -m pytest tests -o pythonpath=. -v
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
│   ├── config.py                 # Configuration & model defaults
│   ├── database.py               # SQLAlchemy schema (documents, chunks, sessions, analytics)
│   ├── ingestion.py              # Multi-format parsers (PDF, DOCX, TXT, CSV) & FastEmbed
│   ├── reranker.py               # FlashRank cross-encoder & Sigmoid confidence scoring
│   ├── agents.py                 # 5 LangGraph agent nodes & compiled StateGraph
│   ├── main.py                   # FastAPI REST endpoints & analytics handlers
│   ├── Procfile                  # Render cloud deployment process definition
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
│   ├── tailwind.config.js        # Executive dark slate & tech blue tokens
│   ├── vercel.json               # Vercel deployment rewrites
│   ├── index.html                # Google Fonts & viewport metadata
│   └── src/
│       ├── main.jsx              # React DOM entry point
│       ├── App.jsx               # Main state orchestrator
│       ├── index.css             # Base styles & audio animations
│       ├── utils/
│       │   ├── speech.js         # Hardened Web Speech API engine
│       │   └── api.js            # REST API client
│       └── components/
│           ├── Navbar.jsx        # Top brand, status pills, action buttons
│           ├── Sidebar.jsx       # Document uploader, domain tabs, doc list
│           ├── ChatInterface.jsx # Chat feed, pipeline dropdown, voice mic, dynamic prompts
│           ├── TransparencyPanel.jsx # Source chunks, confidence gauge, citations
│           └── AnalyticsModal.jsx    # Knowledge gap dashboard & report deletion
└── README.md
```

---

## 🏆 Project Milestone Compliance Matrix

| Milestone | Deliverable | Status |
| :--- | :--- | :--- |
| **Milestone 1** | Ingestion pipeline (PDF, DOCX, TXT, CSV), 800/120 chunking, FastEmbed vector indexing | ✅ Completed & Verified |
| **Milestone 2** | Query Understanding Agent, Retrieval Agent, Response Generation Agent, LangGraph flow | ✅ Completed & Verified |
| **Milestone 3** | Clarification Agent, Conversation Memory Agent, Web Speech API Voice I/O, Transparency Panel | ✅ Completed & Verified |
| **Milestone 4** | Knowledge Gap Analytics, report deletion, low-confidence logging (<0.40), automated unit tests, cloud deployment | ✅ Completed & Verified |
