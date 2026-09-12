import axios from 'axios';

// Falls back to the local dev server if VITE_API_URL is missing at build
// time (Vite bakes this in at build, not runtime) so a misconfigured build
// degrades to a wrong-but-defined URL instead of crashing downstream code
// that reads it.
const DEFAULT_API_URL = 'http://localhost:5002/api';
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// Same-origin host the API is served from, without the /api suffix — used
// to build URLs for static assets served outside /api (e.g. uploaded PDFs).
export const API_ORIGIN = API_BASE_URL.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default api;
