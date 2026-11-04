import axios from 'axios';
import { API_BASE } from '../config';

// One shared HTTP client. The auth token is attached to every request automatically.
export const api = axios.create({ baseURL: API_BASE });

let authToken: string | null = null;
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

api.interceptors.request.use((config) => {
  if (authToken) config.headers.set('Authorization', `Bearer ${authToken}`);
  return config;
});

export const errorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (!err.response) return 'Cannot reach the server. Make sure the backend is running.';
  }
  return fallback;
};
