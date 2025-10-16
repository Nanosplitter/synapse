import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, Routes } from "discord.js";
import { generateGameImage } from "../image-generator.js";

/**
 * Get display name for a user with proper priority:
 * 1. Server nickname (if set)
 * 2. Global display name
 * 3. Username (fallback)
 */
export function getDisplayName(interaction) {
  return interaction.member?.nick || interaction.user.globalName || interaction.user.username;
}

export function createPlayButton(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`launch_activity_${sessionId}`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
  );
}

export function formatPlayerMessage(players, isComplete = false) {
  const verb = isComplete
    ? players.length === 1
      ? "was playing"
      : "were playing"
    : players.length === 1
    ? "is playing"
    : "are playing";

  if (players.length === 1) {
    return `**${players[0].username}** ${verb} Synapse`;
  } else if (players.length === 2) {
    return `**${players[0].username}** and **${players[1].username}** ${verb} Synapse`;
  } else {
    const names = players
      .slice(0, -1)
      .map((p) => `**${p.username}**`)
      .join(", ");
    return `${names}, and **${players[players.length - 1].username}** ${verb} Synapse`;
  }
}

export async function createGameAttachment(players) {
  const imageBuffer = await generateGameImage({ players });
  return new AttachmentBuilder(imageBuffer, { name: "synapse.png" });
}

export async function launchActivity(client, interaction) {
  await client.rest.post(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    body: {
      type: 12,
      data: {
        activity_instance_id: process.env.VITE_DISCORD_CLIENT_ID
      }
    }
  });
}

export async function updateSessionMessage(client, session, attachment, messageText, button) {
  if (session.interaction) {
    await session.interaction.editReply({
      content: messageText,
      files: [attachment],
      components: [button]
    });
  } else if (session.webhook) {
    await session.webhook.editMessage(session.messageId, {
      content: messageText,
      files: [attachment],
      components: [button]
    });
  } else {
    await client.rest.patch(Routes.channelMessage(session.channelId, session.messageId), {
      body: {
        content: messageText,
        components: [button.toJSON()]
      },
      files: [{ name: "synapse.png", data: attachment.attachment }]
    });
  }
}
