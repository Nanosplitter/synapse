import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getTodayDate } from "./utils.js";
import { createGameAttachment, createPlayButton, launchActivity, getDisplayName } from "./discord-utils.js";
import { notifySessionStart, notifyPlayerJoin, fetchSession } from "./server-api.js";
import { saveSession, saveSessionPlayer } from "./database.js";

export async function startGameSession(interaction, client, activeSessions, pool) {
  try {
    const guildId = interaction.guildId || "dm";
    const channelId = interaction.channelId;

    console.log(`🎬 Starting new multi-user session for guild: ${guildId}`);
    console.log(`📍 Initial interaction.channelId: ${channelId}`);
    console.log(`📍 interaction.channel exists: ${!!interaction.channel}`);
    if (interaction.channel) {
      console.log(`📍 interaction.channel.id: ${interaction.channel.id}, type: ${interaction.channel.type}`);
    }

    await interaction.deferReply();

    const attachment = await createGameAttachment([]);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`launch_activity_temp`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      content: `Click **Play now!** to join today's Synapse`,
      files: [attachment],
      components: [row]
    });

    const reply = await interaction.fetchReply();
    console.log(`📍 Reply object - channelId: ${reply.channelId}, channel exists: ${!!reply.channel}`);
    if (reply.channel) {
      console.log(`📍 reply.channel.id: ${reply.channel.id}, type: ${reply.channel.type}`);
    }

    const actualChannelId = reply.channel?.id || reply.channelId || channelId;
    const sessionId = reply.id;

    console.log(`📍 Created session ${sessionId} in channel ${actualChannelId}`);

    const updatedRow = createPlayButton(sessionId);
    await interaction.editReply({
      content: `Click **Play now!** to join today's Synapse`,
      files: [attachment],
      components: [updatedRow]
    });

    const sessionData = {
      sessionId,
      channelId: actualChannelId,
      messageId: reply.id,
      guildId,
      players: [],
      interaction
    };

    activeSessions.set(sessionId, sessionData);
    await saveSession(pool, sessionData);

    const gameDate = getTodayDate();
    await notifySessionStart(sessionId, guildId, actualChannelId, reply.id, gameDate);

    console.log(`✓ Started multi-user game session ${sessionId}`);
  } catch (error) {
    console.error("Error starting game session:", error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Failed to start game session. Please try again.",
          flags: 64
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "Failed to start game session. Please try again."
        });
      }
    } catch (replyError) {
      console.error("Failed to send error message:", replyError.message);
    }
  }
}

export async function restoreSessionFromServer(sessionId, activeSessions, client) {
  console.log(`⚠️ Session ${sessionId} not in cache, fetching from server...`);

  const serverSession = await fetchSession(sessionId);
  if (!serverSession) {
    console.warn(`❌ Session ${sessionId} not found on server`);
    return null;
  }

  const session = {
    sessionId,
    channelId: serverSession.channelId,
    messageId: sessionId,
    guildId: serverSession.guildId,
    players: Object.entries(serverSession.players || {}).map(([userId, player]) => ({
      userId,
      username: player.username,
      avatarUrl: player.avatarUrl,
      guessHistory: player.guessHistory || [],
      lastGuessCount: player.guessHistory?.length || 0
    })),
    interaction: null
  };

  activeSessions.set(sessionId, session);
  console.log(`✅ Session ${sessionId} restored from server`);
  return session;
}
