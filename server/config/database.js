import mysql from "mysql2/promise";

let pool;

export async function initializeDatabase() {
  try {
    if (!process.env.MYSQL_CONNECTION_STRING) {
      console.log("No MySQL connection string found - using in-memory storage");
      console.log("To enable database storage, add MYSQL_CONNECTION_STRING to your .env file");
      return;
    }

    pool = mysql.createPool(process.env.MYSQL_CONNECTION_STRING);

    const connection = await pool.getConnection();
    console.log("✓ MySQL connected successfully!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT NULL,
        game_date DATE NOT NULL,
        score INT NOT NULL,
        mistakes INT NOT NULL,
        guess_history JSON DEFAULT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_date (guild_id, game_date),
        UNIQUE KEY unique_player_game (guild_id, user_id, game_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS pending_recaps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        game_date DATE NOT NULL,
        puzzle_number INT NOT NULL,
        recap_posted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        posted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_channel_date (channel_id, game_date),
        INDEX idx_pending (recap_posted, game_date),
        UNIQUE KEY unique_channel_recap (channel_id, game_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS server_sessions (
        message_session_id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        game_date DATE NOT NULL,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_guild_date (guild_id, game_date),
        INDEX idx_last_update (last_update)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS server_session_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_session_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        guess_history JSON,
        FOREIGN KEY (message_session_id) REFERENCES server_sessions(message_session_id) ON DELETE CASCADE,
        INDEX idx_session (message_session_id),
        UNIQUE KEY unique_player_session (message_session_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_session_mappings (
        user_session_id VARCHAR(255) PRIMARY KEY,
        message_session_id VARCHAR(255) NOT NULL,
        INDEX idx_message_session (message_session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("✓ Database tables initialized!");
    connection.release();
  } catch (error) {
    console.error("✗ Database initialization error:", error.message);
    console.log("→ Continuing without database - using in-memory storage");
    pool = null;
  }
}

export function getPool() {
  return pool;
}
