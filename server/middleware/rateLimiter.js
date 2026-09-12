import rateLimit from 'express-rate-limit';

// Login/register brute-force protection. Shared across both routes since
// they're both credential-guessing vectors — 10 attempts per 15 minutes per
// IP is generous for a real user (mistyped passwords, a signup immediately
// followed by a login) while blocking scripted credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

// Groq-backed generation endpoints (Summary/Flashcards/Quiz create + regenerate).
// 20 requests per 15 minutes per IP comfortably covers normal study/testing
// use (generating and regenerating a few times) while capping runaway or
// abusive repeated LLM calls.
const aiGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many generation requests. Please wait a few minutes and try again.' },
});

export { authLimiter, aiGenerationLimiter };
