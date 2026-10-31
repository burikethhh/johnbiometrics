import axios from 'axios';

const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/api/auth?action=login', credentials),
  register: (data) => api.post('/api/auth?action=register', data),
  logout: () => api.post('/api/auth?action=logout'),
  changePassword: (data) => api.post('/api/auth?action=change-password', data)
};

export const residentAPI = {
  getAll: () => api.get('/api/residents'),
  getById: (id) => api.get(`/api/residents?id=${id}`),
  create: (data) => api.post('/api/residents', data),
  update: (id, data) => api.put(`/api/residents?id=${id}`, data),
  delete: (id) => api.delete(`/api/residents?id=${id}`)
};

export const fingerprintAPI = {
  getByResident: (residentId) => api.get(`/api/fingerprints?residentId=${residentId}`),
  register: (data) => api.post('/api/fingerprints', data),
  verify: (data) => api.post('/api/fingerprints?action=verify', data),
  delete: (id) => api.delete(`/api/fingerprints?fingerprintId=${id}`)
};

export const accessLogAPI = {
  getAll: (params) => api.get('/api/access-logs', { params }),
  getStats: () => api.get('/api/access-logs?action=stats')
};

export const dashboardAPI = {
  getOverview: () => api.get('/api/dashboard'),
  getHourly: () => api.get('/api/dashboard?action=hourly')
};

export const deviceAPI = {
  getAll: () => api.get('/api/devices'),
  create: (data) => api.post('/api/devices', data),
  update: (id, data) => api.put(`/api/devices?id=${id}`, data),
  delete: (id) => api.delete(`/api/devices?id=${id}`)
};

export const evaluationAPI = {
  getAccuracy: () => api.get('/api/evaluation'),
  getByThreshold: () => api.get('/api/evaluation?type=threshold'),
  getByDevice: () => api.get('/api/evaluation?type=device'),
  getTimeline: () => api.get('/api/evaluation?type=timeline')
};

export const zkAPI = {
  status: (deviceId) => api.get(`/api/zkteco/status${deviceId ? `?device_id=${deviceId}` : ''}`),
  users: (deviceId) => api.get(`/api/zkteco/users${deviceId ? `?device_id=${deviceId}` : ''}`),
  scan: () => api.get('/api/zkteco/scan'),
  connect: (data) => api.post('/api/zkteco/connect', data),
  pullLogs: (data) => api.post('/api/zkteco/pull-logs', data),
  syncResidents: (data) => api.post('/api/zkteco/sync-residents', data),
  enroll: (data) => api.post('/api/zkteco/enroll', data)
};

export default api;
