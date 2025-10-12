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
