import api from './api.js';

export const getDashboardStats = () => api.get('/dashboard');
