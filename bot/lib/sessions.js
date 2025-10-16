import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getTodayDate } from "./utils.js";
import { createGameAttachment, createPlayButton, launchActivity, getDisplayName } from "./discord-utils.js";
import { notifySessionStart, notifyPlayerJoin, fetchSession } from "./server-api.js";
import { saveSession, saveSessionPlayer } from "./database.js";

export async function startGameSession(interaction, client, activeSessions, pool) {
  try {
    const guildId = interaction.guildId || "dm";
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const username = getDisplayName(interaction);
    const avatarUrl = interaction.user.displayAvatarURL({ format: "png" });

    console.log(`🎬 Starting new session for guild: ${guildId}`);
    console.log(`📍 Initial interaction.channelId: ${channelId}`);
    console.log(`📍 interaction.channel exists: ${!!interaction.channel}`);
    if (interaction.channel) {
      console.log(`📍 interaction.channel.id: ${interaction.channel.id}, type: ${interaction.channel.type}`);
    }

    await launchActivity(client, interaction);
    console.log(`🚀 Activity launched for ${username}`);

    const initialPlayers = [{ userId, username, avatarUrl, guessHistory: [], lastGuessCount: 0 }];
    const attachment = await createGameAttachment(initialPlayers);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`launch_activity_temp`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
    );

    const messageContent = `**${username}** is playing Synapse`;

    const webhook = interaction.webhook;
    const reply = await webhook.send({
      content: messageContent,
      files: [attachment],
      components: [row],
      wait: true
    });
    console.log(`📍 Reply object - channelId: ${reply.channel_id}`);

    const actualChannelId = reply.channel_id || channelId;
    const sessionId = reply.id;

    console.log(`📍 Created session ${sessionId} in channel ${actualChannelId}`);

    const updatedRow = createPlayButton(sessionId);
    await webhook.editMessage(reply.id, {
      content: messageContent,
      files: [attachment],
      components: [updatedRow]
    });

    const sessionData = {
      sessionId,
      channelId: actualChannelId,
      messageId: reply.id,
      guildId,
      players: initialPlayers,
      interaction: null,
      webhook: webhook
    };

    activeSessions.set(sessionId, sessionData);
    await saveSession(pool, sessionData);

    const gameDate = getTodayDate();
    await notifySessionStart(sessionId, guildId, actualChannelId, reply.id, gameDate);
    await notifyPlayerJoin(sessionId, userId, username, avatarUrl, guildId, gameDate);
    await saveSessionPlayer(pool, sessionId, { userId, username, avatarUrl, guessHistory: [], lastGuessCount: 0 });

    console.log(`✓ Started session ${sessionId} with ${username} as first player`);
  } catch (error) {
    console.error("Error starting game session:", error);
    try {
      if (interaction.webhook) {
        await interaction.webhook.send({
          content: "❌ Failed to start game session. Please try again.",
          flags: 64
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
    interaction: null,
    webhook: null
  };

  activeSessions.set(sessionId, session);
  console.log(`✅ Session ${sessionId} restored from server`);
  return session;
}
