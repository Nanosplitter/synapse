import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeDatabase, checkForCompletedGames, postDailyPrompt } from "./lib/database.js";
import { startGameSession, createReplySession, restoreSessionFromServer } from "./lib/sessions.js";
import { checkSessionUpdates } from "./lib/session-updates.js";
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
const postedGames = new Set();
const activeSessions = new Map();

client.on("ready", async () => {
  console.log(`✓ Logged in as ${client.user.tag}!`);
  console.log(`🏰 Bot is in ${client.guilds.cache.size} guild(s):`);
  client.guilds.cache.forEach((guild) => {
    console.log(`   - ${guild.name} (${guild.id})`);
  });

  pool = await initializeDatabase(process.env.MYSQL_CONNECTION_STRING);

  setInterval(() => checkForCompletedGames(client, pool, postedGames), 30000);
  console.log("✓ Started polling for completed games");

  setInterval(() => checkSessionUpdates(client, activeSessions, pool), 5000);
  console.log("✓ Started polling for session updates");

  setInterval(() => checkForRecaps(client, pool), 30000);
  console.log("✓ Started polling for session recaps");
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "synapse") {
      await startGameSession(interaction, client, activeSessions);
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
        const yesterday = addDays(today, 0);

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
      await startGameSession(interaction, client, activeSessions);
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
              console.log(`🔄 All players in session ${sessionId} are complete - creating reply session`);
              await createReplySession(interaction, session, client, activeSessions);
              return;
            }

            await handlePlayerJoin(client, interaction, session);
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
