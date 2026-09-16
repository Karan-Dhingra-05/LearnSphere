# Debian-based, not Alpine — faiss-node and onnxruntime-node (used by
# @huggingface/transformers) ship prebuilt native binaries for glibc and
# may fail to load, or require a full build toolchain, on musl (Alpine).
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# server.js already reads PORT from the environment and binds all
# interfaces by default (app.listen(PORT, ...)) — no code change needed.
EXPOSE 5002

CMD ["node", "server.js"]
