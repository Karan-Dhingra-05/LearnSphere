import api from './api.js';

export const uploadDocument = (formData, onProgress) =>
  api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      }
    },
  });

export const getDocuments = () => api.get('/documents');

export const getDocument = (id) => api.get(`/documents/${id}`);

export const deleteDocument = (id) => api.delete(`/documents/${id}`);
