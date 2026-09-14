import api from './api.js';

export const getFavorites = () => api.get('/favorites');
