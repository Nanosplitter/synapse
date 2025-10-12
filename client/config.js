/**
 * Configuration and constants for the Synapse game
 */

// Check if we're in local development mode (not in Discord iframe)
// In production, we're always in Discord mode unless explicitly on localhost
export const isLocalMode = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Check if dev mode is enabled (shows answers in order like local mode, but still uses Discord SDK)
// Can be enabled via environment variable: VITE_DEV_MODE=true
export const isDevMode = import.meta.env.VITE_DEV_MODE === "true" || isLocalMode;

export const GAME_CONFIG = {
  maxMistakes: 4,
  wordsPerCategory: 4,
  totalCategories: 4,
  selectableWords: 4
};

export const DATE_CONFIG = {
  current: new Date().toISOString().split("T")[0],
  fallback: "2024-10-02"
};

export const CATEGORY_COLORS = ["yellow", "green", "blue", "purple"];

export const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || "mock-client-id";

export const API_ENDPOINTS = {
  token: "/api/token",
  synapse: (date) => `/api/synapse/${date}`,
  gameState: (guildId, date) => `/api/gamestate/${guildId}/${date}`,
  completeGame: (guildId, date) => `/api/gamestate/${guildId}/${date}/complete`,
  deleteGame: (guildId, date, userId) => `/api/gamestate/${guildId}/${date}/${userId}`,
  sessionUpdate: (sessionId) => `/api/sessions/${sessionId}/update`
};
