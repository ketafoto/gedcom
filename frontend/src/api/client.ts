import axios from 'axios';

// Create axios instance with default config
// Authentication is disabled - no tokens needed
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;

