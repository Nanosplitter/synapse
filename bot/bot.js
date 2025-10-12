import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeDatabase, checkForCompletedGames, postDailyPrompt } from "./lib/database.js";
import { startGameSession, createReplySession, restoreSessionFromServer } from "./lib/sessions.js";
import { checkSessionUpdates } from "./lib/session-updates.js";
import { hasActivePlayer, handlePlayerJoin } from "./lib/player-handler.js";
import { launchActivity } from "./lib/discord-utils.js";
import { hasPlayerCompletedGame } from "./lib/server-api.js";
import { getTodayDate } from "./lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
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

  setInterval(() => checkSessionUpdates(client, activeSessions), 5000);
  console.log("✓ Started polling for session updates");
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "synapse") {
      await startGameSession(interaction, client, activeSessions);
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("launch_activity_")) {
      try {
        const sessionId = interaction.customId.replace("launch_activity_", "");
        let session = activeSessions.get(sessionId);

        if (!session) {
          session = await restoreSessionFromServer(sessionId, activeSessions);
        }

        if (session) {
          const userId = interaction.user.id;
          const username = interaction.user.username;
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
        console.log(`🚀 Activity launched silently for ${interaction.user.username}`);
      } catch (error) {
        console.error("Error launching activity:", error);
        await interaction.deferUpdate();
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
