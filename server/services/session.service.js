import { parseUserSessionId } from "../utils/transforms.js";
import { getPool } from "../config/database.js";

const activeSessions = {};
const userToMessageSession = {};

async function loadSessionFromDB(sessionId) {
  if (activeSessions[sessionId]) {
    return activeSessions[sessionId];
  }

  const pool = getPool();
  if (!pool) return null;

  try {
    const [sessionRows] = await pool.query(
      `SELECT message_session_id, guild_id, channel_id, game_date
       FROM server_sessions
       WHERE message_session_id = ?`,
      [sessionId]
    );

    if (sessionRows.length === 0) {
      return null;
    }

    const session = sessionRows[0];

    const [playerRows] = await pool.query(
      `SELECT user_id, username, avatar_url, guess_history
       FROM server_session_players
       WHERE message_session_id = ?`,
      [sessionId]
    );

    const players = {};
    for (const player of playerRows) {
      players[player.user_id] = {
        username: player.username,
        avatarUrl: player.avatar_url,
        guessHistory: typeof player.guess_history === 'string' ? JSON.parse(player.guess_history) : player.guess_history || []
      };
    }

    activeSessions[sessionId] = {
      guildId: session.guild_id,
      channelId: session.channel_id,
      messageId: sessionId,
      date: session.game_date,
      players,
      lastUpdate: Date.now()
    };

    console.log(`✅ Loaded session ${sessionId} from DB with ${Object.keys(players).length} player(s)`);

    return activeSessions[sessionId];
  } catch (error) {
    console.error("Error loading session from DB:", error.message);
    return null;
  }
}

export async function createSession(sessionId, guildId, channelId, gameDate) {
  console.log(`📝 Creating message session: ${sessionId}`);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO server_sessions (message_session_id, guild_id, channel_id, game_date)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_update = CURRENT_TIMESTAMP`,
        [sessionId, guildId, channelId, gameDate]
      );
    } catch (error) {
      console.error("Error saving session to DB:", error.message);
    }
  }

  activeSessions[sessionId] = {
    guildId,
    channelId,
    messageId: sessionId,
    players: {},
    lastUpdate: Date.now()
  };

  console.log(`✅ Message session created. Active sessions:`, Object.keys(activeSessions));

  return activeSessions[sessionId];
}

export async function joinSession(messageSessionId, userId, username, avatarUrl, guildId, date) {
  console.log(`👤 User ${username} (${userId}) joining session ${messageSessionId}`);

  if (!activeSessions[messageSessionId]) {
    await loadSessionFromDB(messageSessionId);
    if (!activeSessions[messageSessionId]) {
      console.warn(`❌ Message session not found: ${messageSessionId}`);
      return { error: "Session not found" };
    }
  }

  const userSessionId = `${guildId}_${userId}_${date}`;

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO user_session_mappings (user_session_id, message_session_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE message_session_id = VALUES(message_session_id)`,
        [userSessionId, messageSessionId]
      );

      await pool.query(
        `INSERT INTO server_session_players (message_session_id, user_id, username, avatar_url, guess_history)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE username = VALUES(username), avatar_url = VALUES(avatar_url)`,
        [messageSessionId, userId, username, avatarUrl, JSON.stringify([])]
      );
    } catch (error) {
      console.error("Error saving player to DB:", error.message);
    }
  }

  userToMessageSession[userSessionId] = messageSessionId;

  if (!activeSessions[messageSessionId].date) {
    activeSessions[messageSessionId].date = date;
    console.log(`📅 Set session date to ${date}`);
  }

  if (!activeSessions[messageSessionId].players[userId]) {
    activeSessions[messageSessionId].players[userId] = {
      username,
      avatarUrl,
      guessHistory: []
    };
  }

  console.log(`✅ User mapped: ${userSessionId} -> ${messageSessionId}`);
  console.log(`   Total players in session: ${Object.keys(activeSessions[messageSessionId].players).length}`);

  return { userSessionId, messageSessionId };
}

export async function updateSession(userSessionId, guessHistory) {
  console.log(`🔄 Update request for user session: ${userSessionId}, guesses: ${guessHistory?.length || 0}`);

  let messageSessionId = userToMessageSession[userSessionId];

  if (!messageSessionId) {
    const pool = getPool();
    if (pool) {
      try {
        const [rows] = await pool.query(
          `SELECT message_session_id FROM user_session_mappings WHERE user_session_id = ?`,
          [userSessionId]
        );
        if (rows.length > 0) {
          messageSessionId = rows[0].message_session_id;
          userToMessageSession[userSessionId] = messageSessionId;
        }
      } catch (error) {
        console.error("Error looking up session mapping:", error.message);
      }
    }

    if (!messageSessionId) {
      console.warn(`❌ No message session mapped for user session: ${userSessionId}`);
      return { error: "User session not found" };
    }
  }

  if (!activeSessions[messageSessionId]) {
    await loadSessionFromDB(messageSessionId);
  }

  const messageSession = activeSessions[messageSessionId];

  if (!messageSession) {
    console.warn(`❌ Message session not found: ${messageSessionId}`);
    return { error: "Message session not found" };
  }

  const { userId } = parseUserSessionId(userSessionId);

  if (messageSession.players[userId]) {
    messageSession.players[userId].guessHistory = guessHistory;
    messageSession.lastUpdate = Date.now();

    const pool = getPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE server_session_players SET guess_history = ? WHERE message_session_id = ? AND user_id = ?`,
          [JSON.stringify(guessHistory), messageSessionId, userId]
        );
      } catch (error) {
        console.error("Error updating player guess history:", error.message);
      }
    }

    console.log(`✅ Player ${userId} updated in message session ${messageSessionId}, guesses: ${guessHistory.length}`);

    return { messageSessionId, userId };
  } else {
    console.warn(`⚠️ Player ${userId} not found in message session ${messageSessionId}`);
    return { error: "Player not in session" };
  }
}

export async function lookupSession(channelId, userId, date) {
  console.log(`🔍 Looking up active session for user ${userId} in channel ${channelId} on date ${date}`);

  const pool = getPool();
  if (pool) {
    try {
      const [mappingRows] = await pool.query(
        `SELECT m.message_session_id, s.guild_id
         FROM user_session_mappings m
         JOIN server_sessions s ON m.message_session_id = s.message_session_id
         WHERE m.user_session_id LIKE ? AND s.channel_id = ? AND s.game_date = ?`,
        [`%_${userId}_${date}`, channelId, date]
      );

      if (mappingRows.length > 0) {
        const messageSessionId = mappingRows[0].message_session_id;
        const guildId = mappingRows[0].guild_id;

        if (!activeSessions[messageSessionId]) {
          await loadSessionFromDB(messageSessionId);
        }

        if (activeSessions[messageSessionId] && activeSessions[messageSessionId].players[userId]) {
          const guessHistory = activeSessions[messageSessionId].players[userId].guessHistory || [];
          console.log(`✅ Found mapped session ${messageSessionId} for user ${userId} on date ${date}`);

          return {
            found: true,
            sessionId: messageSessionId,
            messageSessionId: messageSessionId,
            guessHistory,
            session: activeSessions[messageSessionId]
          };
        }
      }
    } catch (error) {
      console.error("Error looking up session from DB:", error.message);
    }
  }

  for (const [sessionId, session] of Object.entries(activeSessions)) {
    if (session.channelId === channelId && session.players[userId]) {
      if (session.date) {
        const sessionDateStr = session.date instanceof Date
          ? session.date.toISOString().split('T')[0]
          : session.date;

        if (sessionDateStr !== date) {
          console.log(`⏭️ Skipping session ${sessionId} - wrong date (${sessionDateStr} !== ${date})`);
          continue;
        }
      }

      console.log(`✅ Found active session ${sessionId} for user ${userId} on date ${date}`);

      const userProgress = session.players[userId];
      return {
        found: true,
        sessionId,
        messageSessionId: sessionId,
        guessHistory: userProgress.guessHistory || [],
        session
      };
    }
  }

  console.log(`❌ No active session found for user ${userId} in channel ${channelId} on date ${date}`);
  return { found: false };
}

export async function getSession(sessionId) {
  if (activeSessions[sessionId]) {
    return activeSessions[sessionId];
  }

  return await loadSessionFromDB(sessionId);
}

export function checkLaunchRequest(sessionId) {
  if (!activeSessions[sessionId]) {
    return { launchRequested: false };
  }

  const launchRequested = activeSessions[sessionId].launchRequested || false;

  if (launchRequested) {
    activeSessions[sessionId].launchRequested = false;
    console.log(`✅ Launch request cleared for session ${sessionId}`);
  }

  return { launchRequested };
}

export function endSession(sessionId) {
  if (activeSessions[sessionId]) {
    delete activeSessions[sessionId];
  }
  return { success: true };
}

export function clearUserFromSessions(guildId, userId, date) {
  console.log(`🗑️ Clearing user ${userId} from sessions on ${date}`);

  const userSessionId = `${guildId}_${userId}_${date}`;
  const messageSessionId = userToMessageSession[userSessionId];

  if (messageSessionId) {
    if (activeSessions[messageSessionId]?.players[userId]) {
      delete activeSessions[messageSessionId].players[userId];
      console.log(`✅ Cleared user ${userId} from active session ${messageSessionId}`);
    }

    delete userToMessageSession[userSessionId];
    console.log(`✅ Cleared user session mapping: ${userSessionId}`);

    if (activeSessions[messageSessionId] && Object.keys(activeSessions[messageSessionId].players).length === 0) {
      delete activeSessions[messageSessionId];
      console.log(`✅ Removed empty session ${messageSessionId}`);
    }
  }
}
