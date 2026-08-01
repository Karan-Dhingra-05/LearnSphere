import Groq from 'groq-sdk';
import { retrieveRelevantChunks } from './retrievalService.js';

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

// ─── AI Summary ───────────────────────────────────────────────────────────────
// (unchanged — still uses extractedText.slice; Phase 5C will migrate this)

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

/**
 * Generates a structured Markdown summary of the document.
 * Still uses extractedText — will be migrated in Phase 5C.
 *
 * @param {string} documentText - extractedText from MongoDB.
 * @returns {Promise<string>}   - Markdown-formatted summary.
 */
const generateSummary = async (documentText) => {
  const messages = [
    { role: 'system', content: SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `Please summarise the following document:\n\n${documentText.slice(0, 25000)}`,
    },
  ];
  return callGroq(messages, 2048, 0.3);
};

export { chatWithDocument, generateSummary };
