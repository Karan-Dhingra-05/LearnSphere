import api from './api.js';

/**
 * Sends a chat message for a document and returns the AI response.
 *
 * @param {string} documentId   - MongoDB document ID
 * @param {string} message      - User's current message
 * @param {Array}  history      - [{role:'user'|'assistant', content:string}]
 */
export const sendChatMessage = (documentId, message, history) =>
  api.post('/ai/chat', { documentId, message, history });
