import api from './api.js';

export const getProgress = () => api.get('/progress');
