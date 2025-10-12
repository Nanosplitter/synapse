-- Synapse Game Database Schema
-- This schema is automatically created by the server on startup
-- You can also manually create it using this file

CREATE DATABASE IF NOT EXISTS synapse_game
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE synapse_game;

-- Table to store game results for each player
CREATE TABLE IF NOT EXISTS game_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(255) NOT NULL COMMENT 'Discord server/guild ID',
  user_id VARCHAR(255) NOT NULL COMMENT 'Discord user ID',
  username VARCHAR(255) NOT NULL COMMENT 'Discord username at time of play',
  avatar VARCHAR(255) DEFAULT NULL COMMENT 'Discord avatar hash',
  game_date DATE NOT NULL COMMENT 'Date of the Synapse game played',
  score INT NOT NULL COMMENT 'Number of categories solved (0-4)',
  mistakes INT NOT NULL COMMENT 'Number of mistakes made (0-4)',
  guess_history JSON DEFAULT NULL COMMENT 'Array of guess attempts with difficulty levels',
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the game was completed',
  
  -- Indexes for performance
  INDEX idx_guild_date (guild_id, game_date),
  INDEX idx_user (user_id),
  INDEX idx_date (game_date),
  
  -- Ensure one entry per player per game per guild
  UNIQUE KEY unique_player_game (guild_id, user_id, game_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stores player game results for Synapse';

-- Optional: Create a view for leaderboards
CREATE OR REPLACE VIEW guild_leaderboard AS
SELECT 
  guild_id,
  game_date,
  user_id,
  username,
  score,
  mistakes,
  completed_at,
  RANK() OVER (PARTITION BY guild_id, game_date ORDER BY score DESC, mistakes ASC, completed_at ASC) as rank
FROM game_results
ORDER BY guild_id, game_date, rank;

-- Optional: Create a view for player statistics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
  user_id,
  username,
  COUNT(*) as games_played,
  AVG(score) as avg_score,
  SUM(CASE WHEN score = 4 THEN 1 ELSE 0 END) as perfect_games,
  AVG(mistakes) as avg_mistakes
FROM game_results
GROUP BY user_id, username;
