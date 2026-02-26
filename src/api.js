import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://agrilog-server.onrender.com/api',
});

// Auth
export const login = (data) => api.post('/auth/login', data);
export const signup = (data) => api.post('/auth/signup', data);

// Crops
export const getCrops = (veg, userId) => api.get('/crops', { params: { veg, userId } });
export const createCrop = (data) => api.post('/crops', data);
export const updateCrop = (id, data) => api.put(`/crops/${id}`, data);
export const deleteCrop = (id) => api.delete(`/crops/${id}`);

// Records
export const getRecords = (cropId, userId) => api.get('/records', { params: { cropId, userId } });
export const getAllRecords = (userId) => api.get('/records', { params: { userId } });
export const createRecord = (data) => api.post('/records', data);
export const updateRecord = (id, data) => api.put(`/records/${id}`, data);
export const deleteRecord = (id) => api.delete(`/records/${id}`);

// Expenses
export const getExpenses = (cropId, userId) => api.get('/expenses', { params: { cropId, userId } });
export const createExpense = (data) => api.post('/expenses', data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

export default api;
