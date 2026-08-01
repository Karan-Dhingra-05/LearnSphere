<div align="center">

# LearnSphere

An AI-powered document learning platform built with the MERN stack.  
Upload PDFs and use Retrieval-Augmented Generation to chat with your content, generate summaries, and study smarter.

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

### 📄 Document Processing
- 📤 Upload PDF documents (up to 50 MB)
- 🔍 Automatic text extraction at upload time
- 🗂️ Document management — list, view, and delete
- 📖 Embedded PDF viewer

### 🤖 AI & RAG
- 💬 AI Chat powered by Retrieval-Augmented Generation (RAG)
- 🧠 Local text embeddings using `all-MiniLM-L6-v2` (384 dimensions)
- ⚡ FAISS vector search for fast, accurate chunk retrieval
- 📝 AI-generated document summaries with server-side caching

### 🎨 User Experience
- 📊 Dashboard with statistics and recent documents
- 🗃️ Responsive sidebar navigation
- ✨ Smooth animations with Framer Motion
- 🌙 Clean, custom CSS design system

---

## Ongoing Development

- 🃏 Flashcard Generation
- 📝 Quiz Generation
- 📊 Learning Analytics & Progress Tracking
- ⭐ Favorites

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
| LLM Provider    | Groq API (llama-3.3-70b-versatile)               |
| Authentication  | JWT (HTTP-only cookies), bcryptjs                |
| File Uploads    | Multer                                           |
| PDF Parsing     | pdf-parse                                        |

---

## Architecture

```
React (Vite)
     │
     │  HTTP / REST (axios, cookie auth)
     ▼
Express API (Node.js)
     │
     ├── MongoDB (documents, users, chunks)
     │
     └── RAG Pipeline
              │
              ├── pdf-parse        → extract text at upload
              ├── chunkService     → split into overlapping chunks
              ├── embeddingService → embed with all-MiniLM-L6-v2
              ├── FAISS            → store & search vectors
              └── Groq LLM         → generate responses from retrieved context
```

---

## Folder Structure

```
LearnSphere/
├── client/                     # React frontend (Vite)
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
    ├── config/                 # DB connection, Multer config
    ├── controllers/            # Route handler logic
    ├── middleware/             # Auth guard, error handler
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

## Environment Variables

| Variable       | Description                                              | Required |
|----------------|----------------------------------------------------------|----------|
| `MONGO_URI`    | MongoDB connection string                                | Yes      |
| `JWT_SECRET`   | Secret key for signing JWT tokens                        | Yes      |
| `GROQ_API_KEY` | Groq API key for LLM inference                           | Yes      |
| `PORT`         | Express server port (default: `5002`)                    | No       |
| `NODE_ENV`     | `development` or `production`                            | No       |
| `CLIENT_URL`   | Frontend origin for CORS (default: `http://localhost:5173`) | No    |
| `VITE_API_URL` | Backend API base URL used by the React app               | Yes      |

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

### Dashboard — `/api/dashboard`

| Method | Endpoint | Description                                                    |
|--------|----------|----------------------------------------------------------------|
| GET    | `/`      | Return stats (documents, flashcard sets, quizzes) and recent documents |

---
