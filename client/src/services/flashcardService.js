import api from './api.js';

export const getFlashcards       = (documentId) => api.get(`/flashcards/${documentId}`);
export const createFlashcards    = (documentId) => api.post(`/flashcards/${documentId}`);
export const regenerateFlashcards= (documentId) => api.post(`/flashcards/${documentId}/regenerate`);
export const toggleFavorite      = (documentId, cardId) => api.patch(`/flashcards/${documentId}/cards/${cardId}/favorite`);
export const markReviewed        = (documentId, cardId) => api.patch(`/flashcards/${documentId}/cards/${cardId}/reviewed`);
