import Groq from 'groq-sdk';
import { retrieveRelevantChunks } from './retrievalService.js';
import DocumentChunk from '../models/DocumentChunk.js';

const MODEL = 'llama-3.3-70b-versatile';

// ─── Shared Groq helper ───────────────────────────────────────────────────────
const createClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const callGroq = async (messages, maxTokens = 2048, temperature = 0.4) => {
  const client = createClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
  });
  const text = completion.choices?.[0]?.message?.content;
  if (!text || text.trim().length === 0) {
    throw new Error('LLM returned an empty response.');
  }
  return text;
};

// ─── AI Chat — RAG-powered ────────────────────────────────────────────────────

const CHAT_SYSTEM = `You are LearnSphere AI, an expert educational assistant that helps students deeply understand their documents.

## Answering Rules
- Answer ONLY using information found in the provided document content.
- If the answer is not in the document, respond with exactly: "The document does not contain enough information to answer this question."
- Do NOT invent, fabricate, or extrapolate beyond what the document states.
- Be precise when quoting the document.

## Response Style
Write like a high-quality textbook or educational resource:
- Begin with a short, clear direct answer.
- Follow with structured detail using headings, bullets, or numbered lists.
- Use **bold** for important concepts and key terms.
- Keep sentences concise. Avoid giant paragraphs — break them into bullets.

## Formatting Rules (CRITICAL — follow exactly)

### Inline code — use backticks for:
- Keywords: \`True\`, \`False\`, \`None\`, \`null\`, \`undefined\`
- Operators: \`and\`, \`or\`, \`not\`, \`in\`, \`is\`
- Variable/function/method names: \`print()\`, \`len()\`, \`push()\`, \`array\`
- Short expressions: \`O(log n)\`, \`O(n²)\`, \`x + y\`
- Filenames, commands, flags: \`index.js\`, \`npm install\`

### Fenced code blocks — ONLY for:
- Complete, multi-line code examples that a student would copy and run
- Structured output or schemas spanning multiple lines

### NEVER use fenced code blocks for:
- Single keywords (\`True\`, \`and\`, \`array\`)
- Short values or expressions
- Anything that fits on one line as inline code

### Preferred response layout:
**Short direct answer**

## Key Points
- Bullet 1
- Bullet 2

## How It Works
Explanation paragraph...

## Example
\`\`\`python
# only real runnable code here
\`\`\`

## Summary / Notes
- Any caveats

### Tables
When comparing items (e.g., data structures, algorithms, concepts), prefer Markdown tables:
| Concept | Property A | Property B |
|---------|------------|------------|
| ...     | ...        | ...        |

### Complexity notation
Always use inline code: \`O(n)\`, \`O(log n)\`, \`O(n²)\` — never wrap these in fenced blocks.`;


const NO_CONTEXT_REPLY =
  "The document does not contain enough information to answer this question.";

/**
 * Sends a chat message using RAG: retrieves the most relevant document chunks
 * for the user's query and sends them as context to Groq.
 *
 * Updated signature: accepts documentId instead of extractedText so the
 * retrieval service can scope the vector search to the correct document.
 *
 * Fallback (development only): if the retrieval pipeline throws an internal
 * error, falls back to sending the first 20 000 chars of extractedText. A
 * clear warning is always logged when the fallback activates.
 *
 * @param {string} documentId    - MongoDB document ID (used by retrievalService).
 * @param {Array}  history       - [{role:'user'|'assistant', content:string}]
 * @param {string} userMessage   - The current user question.
 * @param {string} extractedText - Full document text (fallback only).
 * @returns {Promise<string>}    - The model's response text.
 */
const chatWithDocument = async (documentId, history, userMessage, extractedText = '') => {
  // ── Retrieval ────────────────────────────────────────────────────────────────
  let documentContext;
  let retrievalSucceeded = false;

  try {
    const { context, chunks } = await retrieveRelevantChunks(documentId, userMessage);

    if (!context || context.trim().length === 0) {
      documentContext = '';
    } else {
      documentContext = context;
    }
    retrievalSucceeded = true;
  } catch (retrievalErr) {
    // ── Dev fallback — ONLY for internal retrieval pipeline failures ────────────
    console.warn('[RAG FALLBACK] Retrieval failed. Using extracted document text.');
    console.warn('[RAG FALLBACK] Reason:', retrievalErr?.message);

    if (extractedText && extractedText.trim().length > 0) {
      documentContext = extractedText.slice(0, 20000);
    } else {
      // No fallback text available — respond gracefully
      return NO_CONTEXT_REPLY;
    }
  }

  // ── Prompt construction ──────────────────────────────────────────────────────
  //
  //   [system]       → rules & persona
  //   [user]         → retrieved context (or empty-context notice)
  //   [assistant]    → acknowledgement
  //   [...history]   → last 6 exchanges (12 messages) to control token usage
  //   [user]         → current question

  const contextMessage =
    documentContext && documentContext.trim().length > 0
      ? `RETRIEVED DOCUMENT CONTEXT:\n\n${documentContext}`
      : 'No relevant document content was found for this question.';

  const recentHistory = history.slice(-12).map(({ role, content }) => ({ role, content }));

  const messages = [
    { role: 'system',    content: CHAT_SYSTEM },
    { role: 'user',      content: contextMessage },
    { role: 'assistant', content: 'Understood. I have reviewed the relevant document content. Please ask your question.' },
    ...recentHistory,
    { role: 'user',      content: userMessage },
  ];

  return callGroq(messages, 2048, 0.4);
};

// ─── AI Summary — chunk-based, full-document pipeline ────────────────────────

// Character budget constants (tune here if needed)
const SINGLE_PASS_LIMIT = 20000; // chars — send as one call below this threshold
const BATCH_SIZE        = 18000; // chars — size of each batch above the threshold

const SUMMARY_SYSTEM = `You are LearnSphere AI, an expert educational summariser.
Your task is to produce a structured summary of the provided document content.

Rules:
- Use ONLY the information found in the document.
- Do NOT add external knowledge or opinions.
- Format the output in clean Markdown.
- Always include these sections (skip a section only if the document truly contains no relevant content):

## Overview
(2-4 sentence high-level description)

## Key Points
- Bulleted list of the most important ideas

## Important Concepts
- Bulleted list of central terms and brief definitions

## Important Definitions
(if any formal definitions are given in the document)

## Important Dates
(if any dates or timelines are mentioned)

## Important Numbers
(if any statistics, figures, or quantities are mentioned)

Be concise, accurate, and easy to understand.`;

const CONSOLIDATION_SYSTEM = `You are LearnSphere AI, an expert educational summariser.
You will receive several partial summaries of different sections of the same document.
Combine them into a single, coherent, structured summary.

Rules:
- Merge overlapping points — do NOT repeat the same idea twice.
- Use ONLY information from the partial summaries provided.
- Format the output in clean Markdown using the same sections as the partial summaries.
- Be concise and accurate.`;

/**
 * Summarises one batch of text (a slice of the full document).
 *
 * @param {string} textBatch - A portion of the document text.
 * @param {number} batchNum  - 1-based batch number (for context in the prompt).
 * @param {number} total     - Total number of batches.
 * @returns {Promise<string>} - Partial Markdown summary.
 */
const summariseBatch = (textBatch, batchNum, total) => {
  const messages = [
    { role: 'system', content: SUMMARY_SYSTEM },
    {
      role: 'user',
      content:
        `This is part ${batchNum} of ${total} of the document. Please summarise this section:\n\n${textBatch}`,
    },
  ];
  return callGroq(messages, 1500, 0.3);
};

/**
 * Consolidates an array of partial summaries into one final summary.
 *
 * @param {string[]} partials - Partial summaries from each batch.
 * @returns {Promise<string>} - Final merged Markdown summary.
 */
const consolidateSummaries = (partials) => {
  const combined = partials
    .map((s, i) => `### Part ${i + 1} Summary\n\n${s}`)
    .join('\n\n---\n\n');
  const messages = [
    { role: 'system', content: CONSOLIDATION_SYSTEM },
    {
      role: 'user',
      content: `Please combine these partial summaries into one final summary:\n\n${combined}`,
    },
  ];
  return callGroq(messages, 2048, 0.3);
};

/**
 * Generates a structured Markdown summary of a document.
 *
 * Pipeline:
 *   1. Load all DocumentChunks from MongoDB (sorted by chunkIndex).
 *   2. Concatenate them to get the full document text.
 *   3. If text ≤ SINGLE_PASS_LIMIT → one Groq call.
 *      If text  > SINGLE_PASS_LIMIT → slice into BATCH_SIZE batches,
 *        summarise each sequentially, then consolidate into one final summary.
 *
 * @param {string} documentId - MongoDB Document _id.
 * @returns {Promise<string>} - Markdown-formatted summary.
 */
const generateSummary = async (documentId) => {
  // ── 1. Load all chunks in order ──────────────────────────────────────────────
  const chunks = await DocumentChunk.find({ documentId })
    .sort({ chunkIndex: 1 })
    .select('text -_id');

  if (!chunks || chunks.length === 0) {
    throw new Error('No document chunks found. The document may not have been processed yet.');
  }

  // ── 2. Concatenate into full text ────────────────────────────────────────────
  const fullText = chunks.map((c) => c.text).join('\n\n');

  // ── 3a. Short document — single Groq call ────────────────────────────────────
  if (fullText.length <= SINGLE_PASS_LIMIT) {
    const messages = [
      { role: 'system', content: SUMMARY_SYSTEM },
      { role: 'user', content: `Please summarise the following document:\n\n${fullText}` },
    ];
    return callGroq(messages, 2048, 0.3);
  }

  // ── 3b. Long document — sequential batch summarisation + consolidation ────────
  const batches = [];
  for (let i = 0; i < fullText.length; i += BATCH_SIZE) {
    batches.push(fullText.slice(i, i + BATCH_SIZE));
  }

  const partialSummaries = [];
  for (let i = 0; i < batches.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const partial = await summariseBatch(batches[i], i + 1, batches.length);
    partialSummaries.push(partial);
  }

  return consolidateSummaries(partialSummaries);
};

// ─── AI Flashcards — chunk-based, full-document pipeline ─────────────────────
// Mirrors the Summary pipeline: same constants, same batching strategy.

const FLASHCARD_SYSTEM = `You are LearnSphere AI, an expert educational flashcard generator.
Generate flashcards that help students study the provided document content.

Rules:
- Use ONLY information from the document. Do NOT add external knowledge.
- Generate EXACTLY 10 flashcards.
- Each flashcard must have exactly three fields: "question", "answer", "difficulty".
- difficulty must be one of: "Easy", "Medium", "Hard".
- Prioritize: definitions, key concepts, important facts, algorithms, formulae, comparisons.
- Questions must be clear and unambiguous.
- Answers must be concise but complete.
- Avoid trivial or duplicate questions.
- Return ONLY a valid JSON array. No explanation. No markdown. No code fences.

Example output format:
[
  { "question": "What is a binary search tree?", "answer": "A BST is a tree where each node's left subtree contains only nodes with lesser keys and the right subtree contains only nodes with greater keys.", "difficulty": "Easy" },
  { "question": "What is the time complexity of BST search in the worst case?", "answer": "O(n) — when the tree is completely unbalanced (degenerate).", "difficulty": "Hard" }
]`;

const FLASHCARD_CANDIDATE_SYSTEM = `You are LearnSphere AI, an expert educational flashcard generator.
Generate flashcards that help students study the provided document content.

Rules:
- Use ONLY information from the document. Do NOT add external knowledge.
- Generate 3–4 candidate flashcards from this specific section of the document.
- Each flashcard must have exactly three fields: "question", "answer", "difficulty".
- difficulty must be one of: "Easy", "Medium", "Hard".
- Prioritize: definitions, key concepts, important facts, algorithms, formulae, comparisons.
- Questions must be clear and unambiguous.
- Answers must be concise but complete.
- Avoid trivial or duplicate questions.
- Return ONLY a valid JSON array. No explanation. No markdown. No code fences.`;

const FLASHCARD_MERGE_SYSTEM = `You are LearnSphere AI.
You will receive several batches of candidate flashcards (as JSON arrays) generated from different sections of the same document.
Merge them into one final JSON array.

Rules:
- Remove duplicate questions.
- Keep the highest-quality flashcards.
- Ensure coverage of different document sections.
- Return EXACTLY 10 flashcards.
- Return ONLY a valid JSON array of flashcard objects, each with "question", "answer", and "difficulty".
- No explanation. No markdown. No code fences.`;

/**
 * Parses the LLM's text output into a flashcard array.
 * Handles cases where the model accidentally wraps the JSON in markdown fences.
 *
 * @param {string} text - Raw LLM response.
 * @returns {Array}     - Parsed array of {question, answer, difficulty}.
 */
const parseFlashcardJSON = (text) => {
  // Strip markdown code fences if present
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
};

/**
 * Generates flashcards from a single text batch and returns a parsed array.
 */
const generateFlashcardsFromText = async (text, systemPrompt = FLASHCARD_SYSTEM) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate flashcards from this document content:\n\n${text}` },
  ];
  const raw = await callGroq(messages, 2048, 0.4);
  return parseFlashcardJSON(raw);
};

/**
 * Generates flashcards from a long document by batching then merging.
 */
const generateFlashcardsFromBatches = async (fullText) => {
  const batches = [];
  for (let i = 0; i < fullText.length; i += BATCH_SIZE) {
    batches.push(fullText.slice(i, i + BATCH_SIZE));
  }

  const allCards = [];
  for (let i = 0; i < batches.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const cards = await generateFlashcardsFromText(batches[i], FLASHCARD_CANDIDATE_SYSTEM);
    allCards.push(...cards);
  }

  // Merge via a consolidation call to deduplicate and clean up
  const combined = JSON.stringify(allCards, null, 2);
  const messages = [
    { role: 'system', content: FLASHCARD_MERGE_SYSTEM },
    { role: 'user', content: `Merge, filter, and finalize exactly 10 flashcards from these candidates:\n\n${combined}` },
  ];
  const raw = await callGroq(messages, 2048, 0.3);
  return parseFlashcardJSON(raw);
};

/**
 * Generates a set of flashcards covering the entire document.
 *
 * Pipeline:
 *   1. Load all DocumentChunks from MongoDB (sorted by chunkIndex).
 *   2. Concatenate to get full document text.
 *   3. If text ≤ SINGLE_PASS_LIMIT → one Groq call.
 *      If text  > SINGLE_PASS_LIMIT → batch + merge.
 *   4. Return parsed array of {question, answer, difficulty}.
 *
 * @param {string} documentId - MongoDB Document _id.
 * @returns {Promise<Array>}  - Array of flashcard objects.
 */
const generateFlashcards = async (documentId) => {
  // ── 1. Load all chunks in order ──────────────────────────────────────────────
  const chunks = await DocumentChunk.find({ documentId })
    .sort({ chunkIndex: 1 })
    .select('text -_id');

  if (!chunks || chunks.length === 0) {
    throw new Error('No document chunks found. The document may not have been processed yet.');
  }

  // ── 2. Concatenate into full text ────────────────────────────────────────────
  const fullText = chunks.map((c) => c.text).join('\n\n');

  // ── 3. Single-pass or batched ────────────────────────────────────────────────
  if (fullText.length <= SINGLE_PASS_LIMIT) {
    return generateFlashcardsFromText(fullText);
  }
  return generateFlashcardsFromBatches(fullText);
};

export { chatWithDocument, generateSummary, generateFlashcards };

