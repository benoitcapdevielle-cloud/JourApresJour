const configuredUrl = typeof process.env.EXPO_PUBLIC_BACKEND_URL === 'string' ? process.env.EXPO_PUBLIC_BACKEND_URL.trim() : '';

export const BACKEND_BASE_URL = (configuredUrl || 'http://localhost:3001').replace(/\/$/, '');
export const CHAT_ENDPOINT = `${BACKEND_BASE_URL}/api/chat`;
export const API_TIMEOUT_MS = 20000;
