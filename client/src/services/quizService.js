import api from './api.js';

export const getQuiz        = (documentId) => api.get(`/quiz/${documentId}`);
export const createQuiz     = (documentId) => api.post(`/quiz/${documentId}`);
export const regenerateQuiz = (documentId) => api.post(`/quiz/${documentId}/regenerate`);
export const submitQuiz     = (documentId, answers) => api.post(`/quiz/${documentId}/submit`, { answers });
