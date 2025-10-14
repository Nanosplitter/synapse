import fetch from "node-fetch";
import { createPlayButton, formatPlayerMessage, updateSessionMessage, createGameAttachment } from "./discord-utils.js";
import { trackSessionCompletion } from "./recap.js";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

let wasPolling = false;

export async function checkSessionUpdates(client, activeSessions, pool) {
  const isPolling = activeSessions.size > 0;

  if (isPolling && !wasPolling) {
    console.log(`🔍 Started polling ${activeSessions.size} active session(s)`);
  } else if (!isPolling && wasPolling) {
    console.log(`⏸️ Stopped polling - no active sessions`);
  }

  wasPolling = isPolling;

  if (!isPolling) return;

  for (const [sessionId, session] of activeSessions.entries()) {
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}`);
      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`Session ${sessionId} returned ${response.status}`);
        }
        continue;
      }

      let serverSession;
      try {
        const text = await response.text();
        serverSession = JSON.parse(text);
      } catch (parseError) {
        console.error(`Failed to parse session response for ${sessionId}:`, parseError.message);
        continue;
      }

      const serverPlayers = serverSession.players || {};

      let hasUpdates = false;

      for (const userId in serverPlayers) {
        const serverPlayer = serverPlayers[userId];
        const localPlayer = session.players.find((p) => p.userId === userId);

        if (localPlayer) {
          const serverGuessCount = serverPlayer.guessHistory?.length || 0;
          const localGuessCount = localPlayer.lastGuessCount || 0;

          if (serverGuessCount > localGuessCount) {
            console.log(
              `🎮 Player ${serverPlayer.username} has new guesses: ${localGuessCount} -> ${serverGuessCount}`
            );
            localPlayer.guessHistory = serverPlayer.guessHistory;
            localPlayer.lastGuessCount = serverGuessCount;
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        console.log(`📤 Updating Discord message with new progress...`);

        try {
          const allComplete = session.players.every((player) => {
            const guesses = player.guessHistory || [];
            const correctCount = guesses.filter((g) => g.correct).length;
            const mistakeCount = guesses.filter((g) => !g.correct).length;
            return correctCount === 4 || mistakeCount >= 4;
          });

          const attachment = await createGameAttachment(session.players, session.puzzleNumber);
          const button = createPlayButton(sessionId);
          const messageText = formatPlayerMessage(session.players, session.puzzleNumber, allComplete);
          await updateSessionMessage(client, session, attachment, messageText, button);
          console.log(`✅ Message updated!`);

          if (allComplete && session.players.length > 0) {
            await trackSessionCompletion(
              sessionId,
              session.guildId,
              session.channelId,
              session.messageId,
              session.players,
              session.puzzleNumber,
              session.interaction,
              session.webhook,
              pool
            );
            activeSessions.delete(sessionId);
            console.log(`✓ Game session ${sessionId} completed - all players done`);
          }
        } catch (editError) {
          console.error(`❌ Failed to edit message:`, editError.message);
        }
      } else if (session.players.length > 0) {
        const allComplete = session.players.every((player) => {
          const guesses = player.guessHistory || [];
          const correctCount = guesses.filter((g) => g.correct).length;
          const mistakeCount = guesses.filter((g) => !g.correct).length;
          return correctCount === 4 || mistakeCount >= 4;
        });

        if (allComplete) {
          await trackSessionCompletion(
            sessionId,
            session.guildId,
            session.channelId,
            session.messageId,
            session.players,
            session.puzzleNumber,
            session.interaction,
            session.webhook,
            pool
          );
          activeSessions.delete(sessionId);
          console.log(`✓ Game session ${sessionId} completed - removing from active sessions`);
        }
      }
    } catch (error) {
      console.error(`Error checking session ${sessionId}:`, error.message);
      activeSessions.delete(sessionId);
    }
  }
}
