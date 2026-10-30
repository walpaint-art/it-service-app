import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('itsa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('itsa_token');
      localStorage.removeItem('itsa_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  uploadLogo: (formData) => api.post('/auth/upload-logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const itemsAPI = {
  list: (params) => api.get('/items', { params }),
  get: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

export const servicesAPI = {
  list: (params) => api.get('/services', { params }),
  get: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

export const ordersAPI = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  changeStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  updateFinancial: (id, data) => api.patch(`/orders/${id}/financial`, data),
  addItem: (id, data) => api.post(`/orders/${id}/items`, data),
  addService: (id, data) => api.post(`/orders/${id}/services`, data),
  updateItem: (itemId, data) => api.put(`/orders/items/${itemId}`, data),
  updateService: (svId, data) => api.put(`/orders/services/${svId}`, data),
  toggleItem: (itemId, field) => api.patch(`/orders/items/${itemId}/toggle`, { field }),
  toggleService: (svId, field) => api.patch(`/orders/services/${svId}/toggle`, { field }),
  removeItem: (itemId) => api.delete(`/orders/items/${itemId}`),
  removeService: (svId) => api.delete(`/orders/services/${svId}`),
  uploadMedia: (id, formData) => api.post(`/orders/${id}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMedia: (mediaId) => api.delete(`/orders/media/${mediaId}`),
  stats: () => api.get('/orders/stats/summary'),
};

export const configAPI = {
  list: () => api.get('/config'),
  get: (key) => api.get(`/config/${key}`),
  update: (key, value) => api.put(`/config/${key}`, { value }),
  uploadLogo: (formData) => api.post('/config/upload-logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteLogo: () => api.delete('/config/logo'),
};

export const whatsappAPI = {
  send: (data) => api.post('/whatsapp/send', data),
  list: (params) => api.get('/whatsapp', { params }),
  tracking: (orderNumber) => api.get(`/whatsapp/tracking/${orderNumber}`),
};

export const brandingAPI = {
  get: () => api.get('/branding'),
};
