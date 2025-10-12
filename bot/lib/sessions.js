import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getPuzzleNumber, getTodayDate } from "./utils.js";
import { createGameAttachment, createPlayButton, launchActivity } from "./discord-utils.js";
import { notifySessionStart, notifyPlayerJoin, fetchSession } from "./server-api.js";

export async function startGameSession(interaction, client, activeSessions) {
  try {
    const guildId = interaction.guildId || "dm";
    const channelId = interaction.channelId;
    const puzzleNumber = getPuzzleNumber();

    console.log(`🎬 Starting new multi-user session for guild: ${guildId}`);
    console.log(`📍 Initial interaction.channelId: ${channelId}`);
    console.log(`📍 interaction.channel exists: ${!!interaction.channel}`);
    if (interaction.channel) {
      console.log(`📍 interaction.channel.id: ${interaction.channel.id}, type: ${interaction.channel.type}`);
    }

    await interaction.deferReply();

    const attachment = await createGameAttachment([], puzzleNumber);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`launch_activity_temp`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      content: `Click **Play** to join today's Synapse #${puzzleNumber}`,
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
      content: `Click **Play** to join today's Synapse #${puzzleNumber}`,
      files: [attachment],
      components: [updatedRow]
    });

    activeSessions.set(sessionId, {
      sessionId,
      channelId: actualChannelId,
      messageId: reply.id,
      guildId,
      puzzleNumber,
      players: [],
      interaction
    });

    await notifySessionStart(sessionId, guildId, actualChannelId, reply.id);

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

export async function createReplySession(interaction, originalSession, client, activeSessions) {
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const avatarUrl = interaction.user.displayAvatarURL({ format: "png" });
    const puzzleNumber = originalSession.puzzleNumber;

    console.log(`🔄 Creating reply session for ${username} (original session complete)`);

    await launchActivity(client, interaction);
    console.log(`🚀 Activity launched for ${username}`);

    const attachment = await createGameAttachment(
      [{ userId, username, avatarUrl, guessHistory: [], lastGuessCount: 0 }],
      puzzleNumber
    );

    console.log(`📤 Creating webhook message for new session`);

    const webhook = interaction.webhook;
    const followUpMessage = await webhook.send({
      content: `**${username}** is playing Synapse #${puzzleNumber}`,
      files: [attachment],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`launch_activity_temp`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
        )
      ],
      wait: true
    });

    const newSessionId = followUpMessage.id;
    const actualChannelId = followUpMessage.channel_id || interaction.channelId;

    console.log(`✅ Created webhook message ${newSessionId} in channel ${actualChannelId}`);
    console.log(`📋 followUpMessage keys:`, Object.keys(followUpMessage));

    await webhook.editMessage(followUpMessage.id, {
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`launch_activity_${newSessionId}`)
            .setLabel("Play now!")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    activeSessions.set(newSessionId, {
      sessionId: newSessionId,
      channelId: actualChannelId,
      messageId: followUpMessage.id,
      guildId: originalSession.guildId,
      puzzleNumber,
      players: [{ userId, username, avatarUrl, guessHistory: [], lastGuessCount: 0 }],
      interaction: null,
      webhook: webhook,
      parentMessageId: originalSession.messageId
    });

    const gameDate = getTodayDate();
    await notifySessionStart(newSessionId, originalSession.guildId, actualChannelId, followUpMessage.id);
    await notifyPlayerJoin(newSessionId, userId, username, avatarUrl, originalSession.guildId, gameDate);

    console.log(`✓ Reply session ${newSessionId} created with ${username} as first player`);
  } catch (error) {
    console.error("❌ Error creating reply session:", error);
    console.error("Stack trace:", error.stack);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate();
      }
    } catch (deferError) {
      console.error("Could not defer interaction:", deferError.message);
    }
  }
}

export async function restoreSessionFromServer(sessionId, activeSessions) {
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
    puzzleNumber: getPuzzleNumber(),
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
