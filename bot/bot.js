import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeDatabase, loadActiveSessions } from "./lib/database.js";
import { startGameSession, restoreSessionFromServer } from "./lib/sessions.js";
import { checkSessionUpdates, cleanupOldSessions } from "./lib/session-updates.js";
import { hasActivePlayer, handlePlayerJoin } from "./lib/player-handler.js";
import { launchActivity, getDisplayName } from "./lib/discord-utils.js";
import { hasPlayerCompletedGame } from "./lib/server-api.js";
import { getTodayDate, addDays } from "./lib/utils.js";
import { checkForRecaps } from "./lib/recap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: []
});

let pool;
let activeSessions = new Map();

async function handleGameInteraction(interaction, client, activeSessions, pool, excludeSessionId = null) {
  const channelId = interaction.channelId;
  const userId = interaction.user.id;
  const guildId = interaction.guildId || "dm";
  const today = getTodayDate();

  let existingSession = null;

  if (pool) {
    try {
      const [mappingRows] = await pool.query(
        `SELECT m.message_session_id
         FROM user_session_mappings m
         JOIN server_sessions s ON m.message_session_id = s.message_session_id
         WHERE m.user_session_id = ? AND s.channel_id = ? AND s.game_date = ?`,
        [`${guildId}_${userId}_${today}`, channelId, today]
      );

      if (mappingRows.length > 0) {
        const mappedSessionId = mappingRows[0].message_session_id;
        if (mappedSessionId !== excludeSessionId) {
          existingSession = activeSessions.get(mappedSessionId);
          if (existingSession) {
            console.log(`📌 Found user's mapped session ${mappedSessionId} in channel ${channelId}`);
          }
        }
      }
    } catch (error) {
      console.error("Error checking user session mapping:", error);
    }
  }

  if (!existingSession) {
    existingSession = Array.from(activeSessions.values()).find(
      (s) => s.channelId === channelId && s.sessionId !== excludeSessionId && s.gameDate === today
    );
  }

  if (existingSession) {
    console.log(`📌 Found existing session ${existingSession.sessionId} in channel ${channelId}, joining that instead`);

    const username = getDisplayName(interaction);

    const hasCompleted = await hasPlayerCompletedGame(guildId, userId, today);
    if (hasCompleted) {
      console.log(`✅ ${username} has already completed today's game - launching activity to view results`);
      await launchActivity(client, interaction);
      console.log(`🚀 Activity launched for ${username} (view only - already completed)`);
      return;
    }

    const existingPlayer = existingSession.players.find((p) => p.userId === userId);

    if (!existingPlayer) {
      const hasActive = hasActivePlayer(existingSession);
      console.log(
        `📊 Session ${existingSession.sessionId}: ${existingSession.players.length} player(s), hasActivePlayer: ${hasActive}`
      );

      if (existingSession.players.length > 0 && !hasActive) {
        console.log(`🔄 All players in session ${existingSession.sessionId} are complete - starting new session`);
        await startGameSession(interaction, client, activeSessions, pool);
        return;
      }

      await handlePlayerJoin(client, interaction, existingSession, pool);
    } else {
      console.log(`♻️ ${username} rejoining session ${existingSession.sessionId}`);
    }

    await launchActivity(client, interaction);
    console.log(`🚀 Activity launched silently for ${username}`);
    return;
  }

  await startGameSession(interaction, client, activeSessions, pool);
}

client.on("ready", async () => {
  console.log(`✓ Logged in as ${client.user.tag}!`);
  console.log(`🏰 Bot is in ${client.guilds.cache.size} guild(s):`);
  client.guilds.cache.forEach((guild) => {
    console.log(`   - ${guild.name} (${guild.id})`);
  });

  pool = await initializeDatabase(process.env.MYSQL_CONNECTION_STRING);

  activeSessions = await loadActiveSessions(pool);

  setInterval(() => checkSessionUpdates(client, activeSessions, pool), 5000);
  console.log("✓ Started polling for session updates");

  setInterval(() => cleanupOldSessions(activeSessions, pool), 60000);
  console.log("✓ Started cleanup for sessions older than 1 hour");

  setInterval(() => checkForRecaps(client, pool), 30000);
  console.log("✓ Started polling for recaps (9:05am EST)");
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "synapse") {
      await handleGameInteraction(interaction, client, activeSessions, pool);
      return;
    }

    if (interaction.commandName === "recap") {
      try {
        const guildId = interaction.guildId;

        if (!guildId) {
          await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
          return;
        }

        await interaction.deferReply();

        const today = getTodayDate();
        const yesterday = addDays(today, -1);

        console.log(`📊 Manual recap requested for guild ${guildId} on ${yesterday}`);

        const { buildRecapResponse } = await import("./lib/recap.js");
        const recapData = await buildRecapResponse(guildId, yesterday, pool);

        if (!recapData) {
          await interaction.editReply(`No completed games found for ${yesterday}.`);
          return;
        }

        await interaction.editReply({
          content: recapData.message,
          files: recapData.files,
          components: recapData.components
        });

        console.log(`✅ Posted recap for ${yesterday}`);
      } catch (error) {
        console.error("Error handling recap command:", error);
        await interaction.editReply("An error occurred while trying to post the recap.");
      }
      return;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("start_new_session_")) {
      await handleGameInteraction(interaction, client, activeSessions, pool);
      return;
    }

    if (interaction.customId.startsWith("launch_activity_")) {
      try {
        const sessionId = interaction.customId.replace("launch_activity_", "");
        let session = activeSessions.get(sessionId);

        if (!session) {
          session = await restoreSessionFromServer(sessionId, activeSessions, client);
        }

        if (session) {
          const userId = interaction.user.id;
          const username = getDisplayName(interaction);
          const guildId = session.guildId || "dm";
          const today = getTodayDate();

          if (session.gameDate !== today) {
            console.log(
              `📅 Session ${sessionId} is from ${session.gameDate}, not today (${today}) - starting new session`
            );
            await handleGameInteraction(interaction, client, activeSessions, pool, sessionId);
            return;
          }

          const hasCompleted = await hasPlayerCompletedGame(guildId, userId, today);
          if (hasCompleted) {
            console.log(`✅ ${username} has already completed today's game - launching activity to view results`);

            await launchActivity(client, interaction);
            console.log(`🚀 Activity launched for ${username} (view only - already completed)`);
            return;
          }

          const existingPlayer = session.players.find((p) => p.userId === userId);

          if (!existingPlayer) {
            const hasActive = hasActivePlayer(session);
            console.log(`📊 Session ${sessionId}: ${session.players.length} player(s), hasActivePlayer: ${hasActive}`);

            if (session.players.length > 0 && !hasActive) {
              console.log(`🔄 All players in session ${sessionId} are complete`);
              await handleGameInteraction(interaction, client, activeSessions, pool, sessionId);
              return;
            }

            await handlePlayerJoin(client, interaction, session, pool);
          } else {
            console.log(`♻️ ${username} rejoining session ${sessionId}`);
          }
        }

        await launchActivity(client, interaction);
        console.log(`🚀 Activity launched silently for ${getDisplayName(interaction)}`);
      } catch (error) {
        console.error("Error launching activity:", error);
        await interaction.deferUpdate();
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
