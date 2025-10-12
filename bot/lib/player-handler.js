import { getTodayDate } from "./utils.js";
import { notifyPlayerJoin } from "./server-api.js";
import { createGameAttachment, createPlayButton, formatPlayerMessage, updateSessionMessage } from "./discord-utils.js";

export function isPlayerGameComplete(player) {
  const guessHistory = player.guessHistory || [];
  const correctCount = guessHistory.filter((g) => g.correct).length;
  const mistakeCount = guessHistory.filter((g) => !g.correct).length;
  return correctCount === 4 || mistakeCount >= 4;
}

export function hasActivePlayer(session) {
  if (!session.players || session.players.length === 0) {
    return false;
  }
  return session.players.some((player) => !isPlayerGameComplete(player));
}

export async function handlePlayerJoin(client, interaction, session) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL({ format: "png" });

  session.players.push({
    userId,
    username,
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  });

  session.players.push({
    userId,
    username: "1",
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  });

  session.players.push({
    userId,
    username: "2",
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  });

  session.players.push({
    userId,
    username: "3",
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  });

  session.players.push({
    userId,
    username: "4",
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  });

  console.log(`➕ Added ${username} to session ${session.sessionId}. Total players: ${session.players.length}`);

  await notifyPlayerJoin(session.sessionId, userId, username, avatarUrl, session.guildId, getTodayDate());

  try {
    const attachment = await createGameAttachment(session.players, session.puzzleNumber);
    const button = createPlayButton(session.sessionId);
    const messageText = formatPlayerMessage(session.players, session.puzzleNumber);

    if (session.interaction) {
      await session.interaction.editReply({
        content: messageText,
        files: [attachment],
        components: [button]
      });
      console.log(`✅ Message updated with new player!`);
    }
  } catch (updateError) {
    console.error("Failed to update message:", updateError.message);
  }
}
