import mysql from "mysql2/promise";
import { getTodayDate } from "./utils.js";

export async function initializeDatabase(connectionString) {
  try {
    if (!connectionString) {
      console.log("⚠️  No MySQL connection string found - bot will not function properly");
      return null;
    }

    const pool = mysql.createPool(connectionString);
    const connection = await pool.getConnection();
    console.log("✓ MySQL connected successfully!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS pending_recaps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        game_date DATE NOT NULL,
        recap_posted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        posted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_channel_date (channel_id, game_date),
        INDEX idx_pending (recap_posted, game_date),
        UNIQUE KEY unique_channel_recap (channel_id, game_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migration: Remove puzzle_number column if it exists
    await connection.query(`
      ALTER TABLE pending_recaps DROP COLUMN IF EXISTS puzzle_number
    `).catch(() => {
      // Ignore error if column doesn't exist (MySQL < 8.0.23 doesn't support IF EXISTS)
    });

    await connection.query(`
      CREATE TABLE IF NOT EXISTS posted_game_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        game_date DATE NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lookup (guild_id, user_id, game_date),
        UNIQUE KEY unique_notification (guild_id, user_id, game_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        game_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_guild_date (guild_id, game_date),
        INDEX idx_channel (channel_id),
        INDEX idx_last_update (last_update)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migration: Remove puzzle_number column if it exists
    await connection.query(`
      ALTER TABLE active_sessions DROP COLUMN IF EXISTS puzzle_number
    `).catch(() => {
      // Ignore error if column doesn't exist
    });

    await connection.query(`
      CREATE TABLE IF NOT EXISTS session_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        guess_history JSON,
        last_guess_count INT DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES active_sessions(session_id) ON DELETE CASCADE,
        INDEX idx_session (session_id),
        UNIQUE KEY unique_player_session (session_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    connection.release();
    return pool;
  } catch (error) {
    console.error("✗ Database initialization error:", error.message);
    return null;
  }
}

export async function saveSession(pool, sessionData) {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO active_sessions (session_id, guild_id, channel_id, message_id, game_date)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_update = CURRENT_TIMESTAMP`,
      [sessionData.sessionId, sessionData.guildId, sessionData.channelId, sessionData.messageId, getTodayDate()]
    );
  } catch (error) {
    console.error("Error saving session:", error);
  }
}

export async function saveSessionPlayer(pool, sessionId, playerData) {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO session_players (session_id, user_id, username, avatar_url, guess_history, last_guess_count)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         avatar_url = VALUES(avatar_url),
         guess_history = VALUES(guess_history),
         last_guess_count = VALUES(last_guess_count)`,
      [sessionId, playerData.userId, playerData.username, playerData.avatarUrl, JSON.stringify(playerData.guessHistory || []), playerData.lastGuessCount || 0]
    );
  } catch (error) {
    console.error("Error saving session player:", error);
  }
}

export async function loadActiveSessions(pool) {
  if (!pool) return new Map();

  try {
    const today = getTodayDate();
    const [sessions] = await pool.query(
      `SELECT session_id, guild_id, channel_id, message_id
       FROM active_sessions
       WHERE game_date = ?`,
      [today]
    );

    const activeSessions = new Map();

    for (const session of sessions) {
      const [players] = await pool.query(
        `SELECT user_id, username, avatar_url, guess_history, last_guess_count
         FROM session_players
         WHERE session_id = ?`,
        [session.session_id]
      );

      activeSessions.set(session.session_id, {
        sessionId: session.session_id,
        channelId: session.channel_id,
        messageId: session.message_id,
        guildId: session.guild_id,
        players: players.map(p => ({
          userId: p.user_id,
          username: p.username,
          avatarUrl: p.avatar_url,
          guessHistory: typeof p.guess_history === 'string' ? JSON.parse(p.guess_history) : p.guess_history || [],
          lastGuessCount: p.last_guess_count
        })),
        interaction: null,
        webhook: null
      });
    }

    console.log(`✓ Loaded ${activeSessions.size} active session(s) from database`);
    return activeSessions;
  } catch (error) {
    console.error("Error loading active sessions:", error);
    return new Map();
  }
}

export async function deleteSession(pool, sessionId) {
  if (!pool) return;

  try {
    await pool.query(`DELETE FROM active_sessions WHERE session_id = ?`, [sessionId]);
  } catch (error) {
    console.error("Error deleting session:", error);
  }
}
