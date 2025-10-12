/**
 * Transform database rows to players object
 * @param {Array} rows - Database rows
 * @returns {Object} - Players object keyed by userId
 */
export function transformRowsToPlayers(rows) {
  const players = {};
  rows.forEach((row) => {
    players[row.user_id] = {
      username: row.username,
      avatar: row.avatar,
      score: row.score,
      mistakes: row.mistakes,
      guessHistory: row.guess_history,
      completedAt: new Date(row.completed_at).getTime()
    };
  });
  return players;
}

/**
 * Create a user session ID
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string} - User session ID
 */
export function createUserSessionId(guildId, userId, date) {
  return `${guildId}_${userId}_${date}`;
}

/**
 * Parse a user session ID
 * @param {string} userSessionId - User session ID
 * @returns {Object} - Parsed session ID with guildId, userId, date
 */
export function parseUserSessionId(userSessionId) {
  const parts = userSessionId.split("_");
  return {
    guildId: parts[0],
    userId: parts[1],
    date: parts[2]
  };
}
