import { parseUserSessionId } from "../utils/transforms.js";

const activeSessions = {};
const userToMessageSession = {};

export function createSession(sessionId, guildId, channelId) {
  console.log(`📝 Creating message session: ${sessionId}`);

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

export function joinSession(messageSessionId, userId, username, avatarUrl, guildId, date) {
  console.log(`👤 User ${username} (${userId}) joining session ${messageSessionId}`);

  if (!activeSessions[messageSessionId]) {
    console.warn(`❌ Message session not found: ${messageSessionId}`);
    return { error: "Session not found" };
  }

  const userSessionId = `${guildId}_${userId}_${date}`;

  userToMessageSession[userSessionId] = messageSessionId;

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

export function updateSession(userSessionId, guessHistory) {
  console.log(`🔄 Update request for user session: ${userSessionId}, guesses: ${guessHistory?.length || 0}`);

  const messageSessionId = userToMessageSession[userSessionId];

  if (!messageSessionId) {
    console.warn(`❌ No message session mapped for user session: ${userSessionId}`);
    console.log(`Available user mappings:`, Object.keys(userToMessageSession));
    return { error: "User session not found" };
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

    console.log(`✅ Player ${userId} updated in message session ${messageSessionId}, guesses: ${guessHistory.length}`);

    return { messageSessionId, userId };
  } else {
    console.warn(`⚠️ Player ${userId} not found in message session ${messageSessionId}`);
    return { error: "Player not in session" };
  }
}

export function lookupSession(channelId, userId) {
  console.log(`🔍 Looking up active session for user ${userId} in channel ${channelId}`);

  for (const [sessionId, session] of Object.entries(activeSessions)) {
    if (session.channelId === channelId && session.players[userId]) {
      console.log(`✅ Found active session ${sessionId} for user ${userId}`);

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

  console.log(`❌ No active session found for user ${userId} in channel ${channelId}`);
  return { found: false };
}

export function getSession(sessionId) {
  return activeSessions[sessionId] || null;
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
