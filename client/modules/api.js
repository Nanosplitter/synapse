/**
 * API communication with the server
 */

import { API_ENDPOINTS } from "../config.js";

/**
 * Fetch Synapse game data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Game data
 */
export async function fetchGameData(date) {
  const response = await fetch(API_ENDPOINTS.synapse(date));

  if (!response.ok) {
    throw new Error(`Failed to fetch game data for ${date}`);
  }

  const data = await response.json();

  if (data.categories) {
    const allCards = [];

    data.categories = data.categories.map((cat, index) => {
      const members = cat.cards.map((card) => {
        allCards.push({ content: card.content, position: card.position });
        return card.content;
      });

      return {
        group: cat.title,
        members,
        difficulty: index
      };
    });

    allCards.sort((a, b) => a.position - b.position);
    data.startingOrder = allCards.map((card) => card.content);
  }

  return data;
}

/**
 * Fetch game state for a guild and date
 * @param {string} guildId - Guild ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Server game state
 */
export async function fetchGameState(guildId, date) {
  const response = await fetch(API_ENDPOINTS.gameState(guildId, date));

  if (!response.ok) {
    throw new Error("Failed to fetch game state");
  }

  return response.json();
}

/**
 * Save game result to the server
 * @param {string} guildId - Guild ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} result - Game result data
 * @returns {Promise<Object>} - Server response
 */
export async function saveGameResult(guildId, date, result) {
  const response = await fetch(API_ENDPOINTS.completeGame(guildId, date), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(result)
  });

  if (!response.ok) {
    throw new Error("Failed to save game result");
  }

  return response.json();
}

/**
 * Delete game result from the server (for dev/testing purposes)
 * @param {string} guildId - Guild ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Server response
 */
export async function deleteGameResult(guildId, date, userId) {
  const response = await fetch(API_ENDPOINTS.deleteGame(guildId, date, userId), {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to delete game result");
  }

  return response.json();
}

/**
 * Update game session with current guess history
 * @param {string} sessionId - Session ID
 * @param {Array} guessHistory - Array of guess objects
 * @returns {Promise<Object>} - Server response
 */
export async function updateSession(sessionId, guessHistory) {
  try {
    console.log(`🔄 Updating session ${sessionId} with ${guessHistory.length} guesses`);
    const response = await fetch(API_ENDPOINTS.sessionUpdate(sessionId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ guessHistory })
    });

    if (!response.ok) {
      console.error(`Session update failed with status ${response.status}`);
      throw new Error("Failed to update session");
    }

    const result = await response.json();
    console.log("✅ Session updated successfully:", result);
    return result;
  } catch (error) {
    console.warn("⚠️ Session update failed:", error.message);
    return null;
  }
}

/**
 * Look up user's active session in a channel
 * @param {string} channelId - Discord channel ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} - Session lookup result
 */
export async function lookupUserSession(channelId, userId) {
  try {
    const response = await fetch(`/api/sessions/lookup/${channelId}/${userId}`);

    if (!response.ok) {
      throw new Error(`Session lookup failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("⚠️ Session lookup failed:", error.message);
    return { found: false };
  }
}
