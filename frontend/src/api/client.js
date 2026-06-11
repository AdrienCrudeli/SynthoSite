import axios from 'axios';

export const AUTH_STORAGE_KEY = 'synthosite_auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const API_PUBLIC_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const client = axios.create({
  baseURL: API_BASE_URL
});

client.interceptors.request.use((config) => {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedAuth) {
    return config;
  }

  try {
    const { token } = JSON.parse(storedAuth);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return config;
});

export default client;
