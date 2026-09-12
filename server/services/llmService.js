import Groq from 'groq-sdk';
import { retrieveRelevantChunks } from './retrievalService.js';
import DocumentChunk from '../models/DocumentChunk.js';

const MODEL = 'openai/gpt-oss-120b';

// ─── Shared Groq helper ───────────────────────────────────────────────────────
const createClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

// `responseFormat` is optional and only used by callers that need Groq's JSON
// mode (currently flashcards). Omitting it (Chat, Summary) keeps the request
// body identical to before this parameter existed.
const callGroq = async (messages, maxTokens = 2048, temperature = 0.4, responseFormat) => {
  const client = createClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(responseFormat ? { response_format: responseFormat } : {}),
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

// Token budgets: candidate batches only need a handful of cards, so their
// limit stays as it was. The two paths that must return exactly 10 complete
// cards (single-pass and merge) get a higher ceiling so valid JSON isn't cut
// off mid-generation.
const CANDIDATE_MAX_TOKENS = 2048;
const FULL_SET_MAX_TOKENS = 4096;

// Groq JSON mode requires a top-level JSON object (not a bare array), so all
// flashcard prompts ask for {"flashcards": [...]}.
const FLASHCARD_JSON_FORMAT = { type: 'json_object' };

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
- Return ONLY a valid JSON object with a single key "flashcards" whose value is an array of exactly 10 flashcard objects. No explanation. No markdown. No code fences.

Example output format:
{
  "flashcards": [
    { "question": "What is a binary search tree?", "answer": "A BST is a tree where each node's left subtree contains only nodes with lesser keys and the right subtree contains only nodes with greater keys.", "difficulty": "Easy" },
    { "question": "What is the time complexity of BST search in the worst case?", "answer": "O(n) — when the tree is completely unbalanced (degenerate).", "difficulty": "Hard" }
  ]
}`;

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
- Return ONLY a valid JSON object with a single key "flashcards" whose value is an array of the candidate flashcard objects. No explanation. No markdown. No code fences.`;

const FLASHCARD_MERGE_SYSTEM = `You are LearnSphere AI.
You will receive several batches of candidate flashcards (as a JSON array) generated from different sections of the same document.
Merge them into one final set.

Rules:
- Remove duplicate questions.
- Keep the highest-quality flashcards.
- Ensure coverage of different document sections.
- Return EXACTLY 10 flashcards.
- Return ONLY a valid JSON object with a single key "flashcards" whose value is an array of exactly 10 flashcard objects, each with "question", "answer", and "difficulty".
- No explanation. No markdown. No code fences.`;

/**
 * Parses the LLM's text output into a flashcard array.
 * Accepts either a bare JSON array or the preferred {"flashcards": [...]}
 * object shape, and strips markdown code fences if the model adds them
 * despite JSON mode being requested.
 *
 * @param {string} text - Raw LLM response.
 * @returns {Array}     - Parsed array of {question, answer, difficulty}.
 */
const parseFlashcardJSON = (text) => {
  // Strip markdown code fences if present
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  const cards = Array.isArray(parsed) ? parsed : parsed?.flashcards;
  if (!Array.isArray(cards)) {
    throw new Error('LLM response did not contain a flashcards array.');
  }
  return cards;
};

/**
 * Throws if `cards` is not an array of exactly 10 items. Used at every point
 * where the pipeline is expected to produce the final 10-card set, so a
 * non-compliant LLM response fails loudly instead of being saved as-is.
 *
 * @param {Array}  cards - Parsed flashcard array to check.
 * @param {string} stage - Human-readable description of the pipeline stage, for the error message.
 * @returns {Array} The same array, for chaining.
 */
const ensureExactlyTen = (cards, stage) => {
  if (!Array.isArray(cards) || cards.length !== 10) {
    const count = Array.isArray(cards) ? cards.length : 'a non-array result';
    throw new Error(`Flashcard generation failed: expected exactly 10 flashcards ${stage}, but got ${count}.`);
  }
  return cards;
};

const normalizeQuestion = (q) => (q || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Removes flashcards whose question text is an exact match after
 * normalisation (trim, lowercase, collapsed whitespace). This is a safety
 * net for the merge step's "remove duplicate questions" instruction — no
 * semantic/paraphrase detection is attempted, by design.
 *
 * @param {Array} cards - Flashcard array to dedupe.
 * @returns {Array}     - Deduplicated flashcard array (order preserved).
 */
const dedupeByQuestion = (cards) => {
  const seen = new Set();
  const result = [];
  for (const card of cards) {
    const key = normalizeQuestion(card.question);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
};

/**
 * Generates flashcards from a single text batch and returns a parsed array.
 */
const generateFlashcardsFromText = async (text, systemPrompt = FLASHCARD_SYSTEM, maxTokens = CANDIDATE_MAX_TOKENS) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate flashcards from this document content:\n\n${text}` },
  ];
  const raw = await callGroq(messages, maxTokens, 0.4, FLASHCARD_JSON_FORMAT);
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
    const cards = await generateFlashcardsFromText(batches[i], FLASHCARD_CANDIDATE_SYSTEM, CANDIDATE_MAX_TOKENS);
    allCards.push(...cards);
  }

  // Merge via a consolidation call to deduplicate and clean up
  const combined = JSON.stringify(allCards, null, 2);
  const messages = [
    { role: 'system', content: FLASHCARD_MERGE_SYSTEM },
    { role: 'user', content: `Merge, filter, and finalize exactly 10 flashcards from these candidates:\n\n${combined}` },
  ];
  const raw = await callGroq(messages, FULL_SET_MAX_TOKENS, 0.3, FLASHCARD_JSON_FORMAT);
  const merged = ensureExactlyTen(parseFlashcardJSON(raw), 'from the merge step');

  const deduped = dedupeByQuestion(merged);
  return ensureExactlyTen(deduped, 'after removing duplicate questions');
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
    const cards = await generateFlashcardsFromText(fullText, FLASHCARD_SYSTEM, FULL_SET_MAX_TOKENS);
    return ensureExactlyTen(cards, 'from single-pass generation');
  }
  return generateFlashcardsFromBatches(fullText);
};

// ─── AI Quiz — chunk-based, full-document pipeline ───────────────────────────
// Mirrors the Flashcard pipeline: same constants, same batching strategy, same
// JSON-reliability approach. MCQs carry more data per item (4 options + an
// explanation), so quiz generation gets its own, larger token budget.

const QUIZ_CANDIDATE_MAX_TOKENS = 2048; // small batch of 3–4 candidate questions
const QUIZ_FULL_SET_MAX_TOKENS = 6144;  // 10 complete MCQs (4 options + explanation each) as JSON

const QUIZ_JSON_FORMAT = { type: 'json_object' };

const QUIZ_SYSTEM = `You are LearnSphere AI, an expert educational quiz generator.
Generate a multiple-choice quiz that helps students test their understanding of the provided document content.

Rules:
- Use ONLY information from the document. Do NOT add external knowledge.
- Generate EXACTLY 10 questions.
- Each question must have exactly four options.
- Exactly one option must be the correct answer.
- Each question must have exactly these fields: "question", "options", "correctAnswer", "explanation", "difficulty".
- "options" must be an array of exactly 4 strings.
- "correctAnswer" must be an exact copy of one (and only one) of the 4 strings in "options".
- "explanation" must briefly justify why the correct answer is correct.
- difficulty must be one of: "Easy", "Medium", "Hard".
- Prioritize: definitions, key concepts, important facts, algorithms, formulae, comparisons.
- Questions must be clear and unambiguous. Avoid trivial or duplicate questions.
- Return ONLY a valid JSON object with a single key "quiz" whose value is an array of exactly 10 question objects. No explanation outside the JSON. No markdown. No code fences.

Example output format:
{
  "quiz": [
    {
      "question": "What is the time complexity of binary search on a sorted array?",
      "options": ["O(n)", "O(log n)", "O(n^2)", "O(1)"],
      "correctAnswer": "O(log n)",
      "explanation": "Binary search halves the search space on each comparison, giving logarithmic time complexity.",
      "difficulty": "Medium"
    }
  ]
}`;

const QUIZ_CANDIDATE_SYSTEM = `You are LearnSphere AI, an expert educational quiz generator.
Generate multiple-choice questions that help students test their understanding of the provided document content.

Rules:
- Use ONLY information from the document. Do NOT add external knowledge.
- Generate 3–4 candidate questions from this specific section of the document.
- Each question must have exactly four options, with exactly one correct answer.
- Each question must have exactly these fields: "question", "options", "correctAnswer", "explanation", "difficulty".
- "options" must be an array of exactly 4 strings.
- "correctAnswer" must be an exact copy of one (and only one) of the 4 strings in "options".
- difficulty must be one of: "Easy", "Medium", "Hard".
- Questions must be clear and unambiguous. Avoid trivial or duplicate questions.
- Return ONLY a valid JSON object with a single key "quiz" whose value is an array of the candidate question objects. No explanation. No markdown. No code fences.`;

const QUIZ_MERGE_SYSTEM = `You are LearnSphere AI.
You will receive several batches of candidate multiple-choice questions (as a JSON array) generated from different sections of the same document.
Merge them into one final quiz.

Rules:
- Remove duplicate or near-identical questions.
- Keep the highest-quality, clearest questions.
- Ensure coverage of different document sections.
- Each question must keep exactly four options with exactly one correct answer.
- Return EXACTLY 10 questions.
- Return ONLY a valid JSON object with a single key "quiz" whose value is an array of exactly 10 question objects, each with "question", "options", "correctAnswer", "explanation", and "difficulty".
- No explanation. No markdown. No code fences.`;

/**
 * Parses the LLM's text output into a quiz question array.
 * Accepts either a bare JSON array or the preferred {"quiz": [...]} object
 * shape, and strips markdown code fences if the model adds them despite JSON
 * mode being requested.
 *
 * @param {string} text - Raw LLM response.
 * @returns {Array}     - Parsed array of question objects.
 */
const parseQuizJSON = (text) => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  const questions = Array.isArray(parsed) ? parsed : parsed?.quiz;
  if (!Array.isArray(questions)) {
    throw new Error('LLM response did not contain a quiz array.');
  }
  return questions;
};

/**
 * Structural validation for a single quiz question: required fields present,
 * exactly 4 non-empty options, and correctAnswer matching exactly one option.
 *
 * @param {*} q - Candidate question object.
 * @returns {boolean}
 */
const isValidQuizQuestion = (q) => {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.question !== 'string' || q.question.trim().length === 0) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.options.some((opt) => typeof opt !== 'string' || opt.trim().length === 0)) return false;
  if (typeof q.correctAnswer !== 'string') return false;
  const matchCount = q.options.filter((opt) => opt === q.correctAnswer).length;
  if (matchCount !== 1) return false;
  if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0) return false;
  if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty)) return false;
  return true;
};

/**
 * Throws if `questions` is not an array of exactly 10 structurally valid
 * questions. Used at every point where the pipeline is expected to produce
 * the final quiz, so a non-compliant LLM response fails loudly instead of
 * being saved as-is.
 *
 * @param {Array}  questions - Parsed question array to check.
 * @param {string} stage     - Human-readable pipeline stage, for the error message.
 * @returns {Array} The same array, for chaining.
 */
const ensureValidQuiz = (questions, stage) => {
  if (!Array.isArray(questions) || questions.length !== 10) {
    const count = Array.isArray(questions) ? questions.length : 'a non-array result';
    throw new Error(`Quiz generation failed: expected exactly 10 questions ${stage}, but got ${count}.`);
  }
  const invalidIndex = questions.findIndex((q) => !isValidQuizQuestion(q));
  if (invalidIndex !== -1) {
    throw new Error(
      `Quiz generation failed: question ${invalidIndex + 1} ${stage} is missing required fields, ` +
      `does not have exactly 4 options, or its correctAnswer does not match exactly one option.`
    );
  }
  return questions;
};

/**
 * Generates quiz questions from a single text batch and returns a parsed array.
 */
const generateQuizFromText = async (text, systemPrompt = QUIZ_SYSTEM, maxTokens = QUIZ_CANDIDATE_MAX_TOKENS) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a multiple-choice quiz from this document content:\n\n${text}` },
  ];
  const raw = await callGroq(messages, maxTokens, 0.4, QUIZ_JSON_FORMAT);
  return parseQuizJSON(raw);
};

/**
 * Generates a quiz from a long document by batching candidate questions then merging.
 */
const generateQuizFromBatches = async (fullText) => {
  const batches = [];
  for (let i = 0; i < fullText.length; i += BATCH_SIZE) {
    batches.push(fullText.slice(i, i + BATCH_SIZE));
  }

  const allQuestions = [];
  for (let i = 0; i < batches.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const questions = await generateQuizFromText(batches[i], QUIZ_CANDIDATE_SYSTEM, QUIZ_CANDIDATE_MAX_TOKENS);
    allQuestions.push(...questions);
  }

  // Merge via a consolidation call to deduplicate and select the final 10
  const combined = JSON.stringify(allQuestions, null, 2);
  const messages = [
    { role: 'system', content: QUIZ_MERGE_SYSTEM },
    { role: 'user', content: `Merge, filter, and finalize exactly 10 quiz questions from these candidates:\n\n${combined}` },
  ];
  const raw = await callGroq(messages, QUIZ_FULL_SET_MAX_TOKENS, 0.3, QUIZ_JSON_FORMAT);
  const merged = ensureValidQuiz(parseQuizJSON(raw), 'from the merge step');

  // dedupeByQuestion is generic over any array of objects with a `.question`
  // field, so the same helper used for Flashcards applies here unchanged.
  const deduped = dedupeByQuestion(merged);
  return ensureValidQuiz(deduped, 'after removing duplicate questions');
};

/**
 * Generates a 10-question multiple-choice quiz covering the entire document.
 *
 * Pipeline:
 *   1. Load all DocumentChunks from MongoDB (sorted by chunkIndex).
 *   2. Concatenate to get full document text.
 *   3. If text ≤ SINGLE_PASS_LIMIT → one Groq call.
 *      If text  > SINGLE_PASS_LIMIT → batch + merge.
 *   4. Return a validated array of exactly 10 question objects.
 *
 * @param {string} documentId - MongoDB Document _id.
 * @returns {Promise<Array>}  - Array of {question, options, correctAnswer, explanation, difficulty}.
 */
const generateQuiz = async (documentId) => {
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
    const questions = await generateQuizFromText(fullText, QUIZ_SYSTEM, QUIZ_FULL_SET_MAX_TOKENS);
    return ensureValidQuiz(questions, 'from single-pass generation');
  }
  return generateQuizFromBatches(fullText);
};

export { chatWithDocument, generateSummary, generateFlashcards, generateQuiz };

