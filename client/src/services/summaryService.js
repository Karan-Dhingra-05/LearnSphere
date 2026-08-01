import api from './api.js';

export const getSummary = (documentId) =>
  api.get(`/summary/${documentId}`);

export const createSummary = (documentId) =>
  api.post(`/summary/${documentId}`);

export const regenerateSummary = (documentId) =>
  api.post(`/summary/${documentId}/regenerate`);
