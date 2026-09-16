<div align="center">

# LearnSphere

An AI-powered document learning platform built with the MERN stack.  
Upload PDFs and use Retrieval-Augmented Generation to chat with your content, generate summaries, and study with AI-built flashcards and quizzes.

<br/>

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)

</div>

---

## Features

### 🔐 Authentication & Security
- 🔑 JWT Authentication via HTTP-only cookies
- 🛡️ Secure Login & Signup with bcrypt password hashing
- 🔒 Protected routes — all data scoped to the authenticated user
- 🚦 Rate limiting on authentication and AI generation endpoints

### 📄 Document Processing
- 📤 Upload PDFs (up to 50 MB) from a compact modal on the Dashboard, Documents, or Progress page
- 🔍 Automatic text extraction at upload time
- ✂️ Automatic chunking into `DocumentChunk` records for retrieval
- 🗂️ Document management — list, view, search by title, and delete
- 📖 Embedded PDF viewer

### 🤖 AI & RAG
- 💬 AI Chat powered by Retrieval-Augmented Generation — only the most relevant chunks are sent, never the whole document
- 🧠 Local text embeddings using `all-MiniLM-L6-v2` (384 dimensions)
- ⚡ FAISS vector search for fast, accurate chunk retrieval
- 📝 AI-generated summaries with chunk-based batching for large documents, cached server-side
- 🃏 AI-generated flashcards — exactly 10 per set, with favorite and reviewed tracking
- ❓ AI-generated quizzes — 10 multiple-choice questions, scored server-side, with retakes and attempt history
- 🧾 JSON-mode generation with strict validation of the final card and question counts

### 🎨 User Experience
- 📊 Dashboard with statistics and recent documents
- 📈 Per-document learning progress (flashcard review status, quiz scores and attempt history)
- ⭐ Favorites — revisit flashcards you've starred across every document in one place
- 🔎 Instant document search from the top bar
- 🗃️ Responsive sidebar navigation
- ✨ Smooth animations with Framer Motion
- 🎨 Clean, custom CSS design system (single light theme)

---

## How You Use It

```
Upload a PDF
     │
     ▼
  Document ──→ Content · Chat · Summary · Flashcards · Quiz
     │
     ▼
Progress · Favorites
```

Each document opens in a tabbed viewer: read the original PDF (**Content**), ask questions about it
(**Chat**), generate a structured **Summary**, study **Flashcards**, or test yourself with a **Quiz**.
Flashcard reviews, favorites, and quiz attempts then roll up into **Progress** and **Favorites**.

---

## Tech Stack

| Layer           | Technology                                       |
|-----------------|--------------------------------------------------|
| Frontend        | React 19, Vite, React Router, Framer Motion      |
| Styling         | Vanilla CSS (custom design system)               |
| Backend         | Node.js, Express.js                              |
| Database        | MongoDB, Mongoose                                |
| Vector Store    | FAISS (`faiss-node`)                             |
| Embeddings      | `@huggingface/transformers` (all-MiniLM-L6-v2)  |
| LLM Provider    | Groq API (openai/gpt-oss-120b)                   |
| Authentication  | JWT (HTTP-only cookies), bcryptjs                |
| File Uploads    | Multer                                           |
| PDF Parsing     | pdf-parse                                        |
| Containerization| Docker, Docker Compose, Nginx (serves the build) |

---

## Architecture

```
React (Vite)  ──build──▶  Nginx (production container)
     │
     │  HTTP / REST (axios, cookie auth)
     ▼
Express API (Node.js)
     │
     ├── MongoDB (users, documents, chunks, flashcards, quizzes, attempts)
     │
     └── RAG Pipeline
              │
              ├── pdf-parse        → extract text once, at upload
              ├── chunkService     → split into overlapping DocumentChunks
              ├── embeddingService → embed locally with all-MiniLM-L6-v2
              ├── FAISS            → store & search 384-dim vectors
              └── Groq LLM         → generate from retrieved context
```

### How the AI pipeline works

**Ingestion.** A PDF is parsed exactly once, at upload. The extracted text is stored on the document
record, then split into overlapping `DocumentChunk` records. Each chunk is embedded locally with
`all-MiniLM-L6-v2` — no embedding API calls — and the resulting 384-dimension vectors are indexed in
FAISS and persisted to disk. Nothing is re-parsed or re-embedded on later requests.

**Chat** retrieves only the chunks most relevant to the question from FAISS and sends those as
context. The full document is never sent to the LLM.

**Summary** reads the stored chunks rather than the raw PDF. Small documents are summarised in a
single call; larger ones are summarised in sequential batches and then consolidated into one final
summary.

**Flashcards and Quiz** share the same generation architecture. Small documents are handled in a
single pass. Larger documents are processed as sequential batches that each contribute a few
candidates, followed by **one** merge call that selects, de-duplicates, and finalises the set. Both
generate in JSON mode and validate the result — a set is rejected rather than silently saved if it
doesn't contain exactly the expected number of items, or if a quiz question doesn't have exactly four
options with a single matching correct answer.

**Model.** All generation runs on Groq using `openai/gpt-oss-120b`. LLM calls are issued
sequentially, never in parallel, to stay within rate limits.

---

## Study Features

### 🃏 Flashcards
- Exactly **10** flashcards per document, each with a question, answer, and difficulty (Easy / Medium / Hard)
- Mark cards as **reviewed** as you flip through them
- **Favorite** any card to revisit it later from the Favorites page
- The generated set is **cached** per document — regenerate at any time to replace it

### ❓ Quiz
- **10** multiple-choice questions per document
- **4 options** per question, exactly **one** correct answer, plus an explanation and a difficulty rating
- **Scored server-side** — answers are graded against the stored quiz, never trusted from the client
- **Retake** as often as you like; each submission is recorded as a separate attempt
- **Regenerate** to build a fresh question set — previous attempts are preserved
- The quiz set is **cached** per document, with attempt history stored separately

### ⭐ Favorites
Flashcards you star are collected on the **Favorites** page alongside the document they came from, so
you can review starred cards across every document in one place — and unfavorite them from there.

### 📈 Progress
Tracked per document:

| Metric              | Description                                              |
|---------------------|----------------------------------------------------------|
| Flashcards reviewed | How many cards in the set have been marked reviewed      |
| Favorites           | How many cards in the set are starred                    |
| Quiz attempts       | Number of times the quiz has been submitted              |
| Average score       | Mean score across all attempts for that document         |
| Best score          | Highest score achieved                                   |
| Last attempt        | When the quiz was most recently taken                    |

---

## Folder Structure

```
LearnSphere/
├── docker-compose.yml          # Two services: server + client
│
├── client/                     # React frontend (Vite)
│   ├── Dockerfile              # Multi-stage build → Nginx
│   ├── nginx.conf              # Static serving + SPA fallback
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── context/            # Auth context (React Context API)
│       ├── hooks/              # Custom hooks
│       ├── layouts/            # App shell layout
│       ├── pages/              # Route-level page components
│       ├── services/           # API call wrappers (axios)
│       └── utils/              # Shared utility functions
│
└── server/                     # Express backend
    ├── Dockerfile              # Node 20 Bookworm Slim
    ├── config/                 # DB connection, Multer config
    ├── controllers/            # Route handler logic
    ├── middleware/             # Auth guard, rate limiters, error handler
    ├── models/                 # Mongoose schemas
    ├── routes/                 # Express routers
    ├── services/               # LLM, embeddings, chunking, retrieval
    ├── utils/                  # File helpers, JWT helper, PDF parser
    ├── uploads/                # Uploaded PDFs (gitignored)
    └── faiss/                  # FAISS index + metadata (gitignored)
```

---

## Installation

### Prerequisites

- Node.js 18+
- MongoDB (local or [Atlas](https://www.mongodb.com/atlas))
- Groq API key — [console.groq.com](https://console.groq.com)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/LearnSphere.git
cd LearnSphere
```

### 2. Install dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 3. Configure environment variables

**`server/.env`**
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GROQ_API_KEY=your_groq_api_key
PORT=5002
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:5002/api
```

### 4. Start the development servers

```bash
# Backend  (from /server)
npm run dev

# Frontend (from /client)
npm run dev
```

The app will be available at `http://localhost:5173`.

> **Note:** On the first document upload, the embedding model (`all-MiniLM-L6-v2`, ~90 MB) is downloaded and cached automatically. All subsequent uploads use the local cache.

---

## Running with Docker

The project ships with a two-service Docker Compose setup. MongoDB Atlas and the Groq API stay
**external** — neither runs in a container.

| Service  | Image base              | Role                                                    | Port          |
|----------|-------------------------|---------------------------------------------------------|---------------|
| `server` | `node:20-bookworm-slim` | Express API, embeddings, FAISS                          | `5002:5002`   |
| `client` | `nginx:1.27-alpine`     | Serves the production React build with SPA fallback     | `5173:80`     |

> **Why Bookworm and not Alpine?** `faiss-node` and `onnxruntime-node` (via
> `@huggingface/transformers`) ship prebuilt native binaries built against glibc, which musl-based
> Alpine images can't load.

### 1. Configure

The backend reads its runtime variables from `server/.env` (via `env_file`); that file is never
copied into the image. The frontend is different — `VITE_API_URL` is compiled into the JavaScript
bundle at **build time**, so Compose passes it as a build argument, read from a root-level `.env`:

```bash
cp .env.example .env     # contains VITE_API_URL=http://localhost:5002/api
```

Because that URL is executed in the user's browser, it must point at the **published host address**
(`http://localhost:5002/api`) — not the internal Compose service name.

### 2. Run

```bash
docker compose build
docker compose up -d
docker compose down
docker compose logs -f
```

The app is available at `http://localhost:5173`, the API at `http://localhost:5002`.

### Persistent data

Uploaded PDFs and the FAISS index live in named volumes, so they survive container recreation:

| Volume         | Mount point     | Contents                     |
|----------------|-----------------|------------------------------|
| `uploads_data` | `/app/uploads`  | Uploaded PDF files           |
| `faiss_data`   | `/app/faiss`    | FAISS index + metadata       |

Neither directory's local contents are copied into the image. `docker compose down` preserves both
volumes — use `docker compose down -v` only when you intend to **delete** all uploaded documents and
the vector index.

---

## Environment Variables

| Variable       | Description                                              | Required |
|----------------|----------------------------------------------------------|----------|
| `MONGO_URI`    | MongoDB connection string                                | Yes      |
| `JWT_SECRET`   | Secret key for signing JWT tokens                        | Yes      |
| `GROQ_API_KEY` | Groq API key for LLM inference                           | Yes      |
| `PORT`         | Express server port (default: `5002`)                    | No       |
| `NODE_ENV`     | `development` or `production`                            | No       |
| `CLIENT_URL`   | Frontend origin for CORS (default: `http://localhost:5173`) | No    |
| `VITE_API_URL` | Backend API base URL used by the React app — read at **build time** (`client/.env` locally, root `.env` for Docker) | Yes |

---

## API Overview

### Authentication — `/api/auth`

| Method | Endpoint      | Description                          |
|--------|---------------|--------------------------------------|
| POST   | `/register`   | Create a new user account            |
| POST   | `/login`      | Log in and receive a session cookie  |
| POST   | `/logout`     | Invalidate the session cookie        |
| GET    | `/me`         | Get the authenticated user's profile |

### Documents — `/api/documents`

| Method | Endpoint   | Description                                          |
|--------|------------|------------------------------------------------------|
| POST   | `/upload`  | Upload a PDF; extracts text and runs the RAG pipeline |
| GET    | `/`        | List all documents for the current user              |
| GET    | `/:id`     | Get metadata for a single document                   |
| DELETE | `/:id`     | Delete document, PDF file, chunks, and FAISS vectors |

### AI Chat — `/api/ai`

| Method | Endpoint | Description                                                  |
|--------|----------|--------------------------------------------------------------|
| POST   | `/chat`  | Send a message; retrieves relevant chunks via RAG and responds |

### Summary — `/api/summary`

| Method | Endpoint                  | Description                                |
|--------|---------------------------|--------------------------------------------|
| GET    | `/:documentId`            | Return cached summary (or `null`)          |
| POST   | `/:documentId`            | Generate and cache a summary               |
| POST   | `/:documentId/regenerate` | Force-regenerate an existing summary       |

### Flashcards — `/api/flashcards`

| Method | Endpoint                              | Description                                                  |
|--------|-----------------------------------------|---------------------------------------------------------------|
| GET    | `/:documentId`                        | Return the cached flashcard set (or `null`)                    |
| POST   | `/:documentId`                        | Generate and cache a flashcard set                             |
| POST   | `/:documentId/regenerate`             | Force-regenerate the flashcard set                             |
| PATCH  | `/:documentId/cards/:cardId/favorite` | Toggle favorite on a single flashcard                          |
| PATCH  | `/:documentId/cards/:cardId/reviewed` | Mark a single flashcard as reviewed                            |

### Quiz — `/api/quiz`

| Method | Endpoint                  | Description                                                              |
|--------|----------------------------|----------------------------------------------------------------------------|
| GET    | `/:documentId`             | Return the cached quiz set (or `null`)                                    |
| POST   | `/:documentId`             | Generate and cache a quiz set                                             |
| POST   | `/:documentId/regenerate`  | Force-regenerate the quiz set (past attempts are preserved)               |
| POST   | `/:documentId/submit`      | Submit answers; score is computed server-side and an attempt is recorded |

### Favorites — `/api/favorites`

| Method | Endpoint | Description                                                            |
|--------|----------|------------------------------------------------------------------------|
| GET    | `/`      | Return every favorited flashcard across the user's documents           |

### Progress — `/api/progress`

| Method | Endpoint | Description                                                          |
|--------|----------|--------------------------------------------------------------------------|
| GET    | `/`      | Return per-document flashcard and quiz progress for the current user |

### Dashboard — `/api/dashboard`

| Method | Endpoint | Description                                                    |
|--------|----------|----------------------------------------------------------------|
| GET    | `/`      | Return stats (documents, flashcard sets, quiz attempts, flashcards reviewed/favorited) and recent documents |

---
