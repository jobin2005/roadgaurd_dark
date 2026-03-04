/**
 * Centralized API configuration for RoadGuard.
 * Uses Vite environment variables to switch between local and production.
 */

// In development (local), we use the proxy defined in vite.config.js
// In production (Vercel), we use the VITE_API_URL environment variable
const BACKEND_URL = import.meta.env.VITE_API_URL || '/api';

export { BACKEND_URL };
