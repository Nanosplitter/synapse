import { getTodayDate } from "./utils.js";
import { notifyPlayerJoin } from "./server-api.js";
import { createGameAttachment, createPlayButton, formatPlayerMessage, updateSessionMessage, getDisplayName } from "./discord-utils.js";
import { saveSessionPlayer } from "./database.js";

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

export async function handlePlayerJoin(client, interaction, session, pool) {
  const userId = interaction.user.id;
  const username = getDisplayName(interaction);
  const avatarUrl = interaction.user.displayAvatarURL({ format: "png" });

  const playerData = {
    userId,
    username,
    avatarUrl,
    guessHistory: [],
    lastGuessCount: 0
  };

  session.players.push(playerData);

  console.log(`➕ Added ${username} to session ${session.sessionId}. Total players: ${session.players.length}`);

  await saveSessionPlayer(pool, session.sessionId, playerData);
  await notifyPlayerJoin(session.sessionId, userId, username, avatarUrl, session.guildId, getTodayDate());

  try {
    const attachment = await createGameAttachment(session.players);
    const button = createPlayButton(session.sessionId);
    const messageText = formatPlayerMessage(session.players);

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
