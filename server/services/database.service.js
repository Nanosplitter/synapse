import { getPool } from "../config/database.js";
import { transformRowsToPlayers } from "../utils/transforms.js";

const gameState = {};

export async function getGameState(guildId, date) {
  try {
    const pool = getPool();
    if (pool) {
      const [rows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?`,
        [guildId, date]
      );

      const players = transformRowsToPlayers(rows);
      return { date, players };
    } else {
      if (!gameState[guildId] || gameState[guildId].date !== date) {
        gameState[guildId] = { date, players: {} };
      }
      return gameState[guildId];
    }
  } catch (error) {
    console.error("Error fetching game state:", error);
    if (!gameState[guildId] || gameState[guildId].date !== date) {
      gameState[guildId] = { date, players: {} };
    }
    return gameState[guildId];
  }
}

export async function saveGameResult(guildId, date, playerData) {
  const { userId, username, avatar, score, mistakes, guessHistory } = playerData;

  try {
    const pool = getPool();
    if (pool) {
      await pool.query(
        `INSERT INTO game_results (guild_id, user_id, username, avatar, game_date, score, mistakes, guess_history)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           username = VALUES(username),
           avatar = VALUES(avatar),
           score = VALUES(score),
           mistakes = VALUES(mistakes),
           guess_history = VALUES(guess_history),
           completed_at = CURRENT_TIMESTAMP`,
        [guildId, userId, username, avatar, date, score, mistakes, JSON.stringify(guessHistory)]
      );

      const [rows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?`,
        [guildId, date]
      );

      const players = transformRowsToPlayers(rows);
      return { success: true, gameState: { date, players } };
    } else {
      if (!gameState[guildId] || gameState[guildId].date !== date) {
        gameState[guildId] = { date, players: {} };
      }

      gameState[guildId].players[userId] = {
        username,
        avatar,
        score,
        mistakes,
        guessHistory,
        completedAt: Date.now()
      };

      return { success: true, gameState: gameState[guildId] };
    }
  } catch (error) {
    console.error("Error saving game result:", error);
    throw error;
  }
}

export async function deleteGameResult(guildId, date, userId) {
  try {
    const pool = getPool();
    if (pool) {
      await pool.query(
        `DELETE FROM game_results WHERE guild_id = ? AND game_date = ? AND user_id = ?`,
        [guildId, date, userId]
      );

      const [rows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?`,
        [guildId, date]
      );

      const players = transformRowsToPlayers(rows);
      console.log(`✅ Deleted from database`);
      return { success: true, gameState: { date, players } };
    } else {
      if (gameState[guildId] && gameState[guildId].players) {
        delete gameState[guildId].players[userId];
      }
      console.log(`✅ Deleted from in-memory storage`);
      return { success: true, gameState: gameState[guildId] || { date, players: {} } };
    }
  } catch (error) {
    console.error("Error deleting game result:", error);
    throw error;
  }
}
