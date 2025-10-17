import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { getTodayDate, addDays } from "./utils.js";
import { generateGameImage } from "../image-generator.js";

/**
 * Build recap response data (message, files, components) for a given guild and date
 * @param {string} guildId - Guild ID
 * @param {string} gameDate - Date to create recap for (YYYY-MM-DD)
 * @param {*} pool - Database pool
 * @returns {Promise<Object|null>} - Recap data or null if no games found
 */
export async function buildRecapResponse(guildId, gameDate, pool) {
  try {
    let completedResults = [];
    let incompletePlayers = [];

    if (pool) {
      const [completedRows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?
         ORDER BY completed_at ASC`,
        [guildId, gameDate]
      );
      completedResults = completedRows;

      const completedUserIds = completedResults.map(r => r.user_id);

      const [sessionRows] = await pool.query(
        `SELECT DISTINCT sp.user_id, sp.username, sp.avatar_url, sp.guess_history
         FROM session_players sp
         JOIN active_sessions s ON sp.session_id = s.session_id
         WHERE s.guild_id = ? AND s.game_date = ?`,
        [guildId, gameDate]
      );

      incompletePlayers = sessionRows
        .filter(sp => !completedUserIds.includes(sp.user_id))
        .map(sp => ({
          user_id: sp.user_id,
          username: sp.username,
          avatar: sp.avatar_url ? sp.avatar_url.split('/').pop().split('.')[0] : null,
          guessHistory: typeof sp.guess_history === 'string' ? JSON.parse(sp.guess_history) : sp.guess_history || [],
          completed: false
        }));
    }

    if (completedResults.length === 0 && incompletePlayers.length === 0) {
      return null;
    }

    const sortedResults = [...completedResults].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;

      const aGuessHistory = typeof a.guess_history === "string" ? JSON.parse(a.guess_history) : a.guess_history;
      const bGuessHistory = typeof b.guess_history === "string" ? JSON.parse(b.guess_history) : b.guess_history;

      return calculateTiebreakerScore(bGuessHistory) - calculateTiebreakerScore(aGuessHistory);
    });

    const allPlayers = [
      ...sortedResults.map((result) => ({
        username: result.username,
        avatarUrl: result.avatar ? `https://cdn.discordapp.com/avatars/${result.user_id}/${result.avatar}.png` : null,
        guessHistory: typeof result.guess_history === "string" ? JSON.parse(result.guess_history) : result.guess_history
      })),
      ...incompletePlayers.map((player) => ({
        username: player.username,
        avatarUrl: player.avatar ? `https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png` : null,
        guessHistory: player.guessHistory
      }))
    ];

    const imageBuffer = await generateGameImage({ players: allPlayers, gameDate });
    const attachment = new AttachmentBuilder(imageBuffer, { name: "synapse-recap.png" });

    const messageText = buildRecapMessage(sortedResults, incompletePlayers, gameDate);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`start_new_session_any`).setLabel("Play now!").setStyle(ButtonStyle.Primary)
    );

    return {
      message: messageText,
      files: [attachment],
      components: [row]
    };
  } catch (error) {
    console.error("Error building recap response:", error);
    throw error;
  }
}

export async function trackSessionCompletion(guildId, channelId, pool) {
  if (!pool) return;

  const gameDate = getTodayDate();

  try {
    await pool.query(
      `INSERT INTO pending_recaps (channel_id, guild_id, game_date, recap_posted)
       VALUES (?, ?, ?, FALSE)
       ON DUPLICATE KEY UPDATE game_date = VALUES(game_date)`,
      [channelId, guildId, gameDate]
    );
    console.log(`📝 Tracked completion in DB for channel ${channelId} on ${gameDate}`);
  } catch (error) {
    console.error(`⚠️ Failed to track completion in DB:`, error.message);
  }
}

export async function checkForRecaps(client, pool) {
  console.log("🔍 Checking for pending recaps...");
  if (!pool) return;

  const recapHour = parseInt(process.env.RECAP_HOUR || "9", 10);
  const recapMinute = parseInt(process.env.RECAP_MINUTE || "05", 10);
  const recapTimeZoneOffset = parseInt(process.env.RECAP_TIMEZONE_OFFSET || "-4", 10);

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const localHour = (utcHour + recapTimeZoneOffset + 24) % 24;

  if (localHour < recapHour) return;
  if (localHour === recapHour && utcMinute < recapMinute) return;

  const today = getTodayDate();
  const yesterday = addDays(today, -1);

  try {
    const [rows] = await pool.query(
      `SELECT channel_id, guild_id, game_date
       FROM pending_recaps
       WHERE game_date = ? AND recap_posted = FALSE`,
      [yesterday]
    );

    if (rows.length === 0) return;

    for (const pending of rows) {
      const channelId = pending.channel_id;

      console.log(`📊 Posting recap for channel ${channelId}, date ${yesterday}`);

      const completion = {
        channelId: pending.channel_id,
        guildId: pending.guild_id,
        gameDate: pending.game_date
      };

      try {
        await postRecap(client, completion, pool, yesterday);

        await pool.query(
          `UPDATE pending_recaps SET recap_posted = TRUE, posted_at = NOW()
           WHERE channel_id = ? AND game_date = ?`,
          [channelId, yesterday]
        );
      } catch (error) {
        console.error(`❌ Error posting recap for channel ${channelId}:`, error);
      }
    }
  } catch (error) {
    console.error(`⚠️ Failed to check for recaps:`, error.message);
  }
}

async function postRecap(client, completion, pool, gameDate) {
  try {
    const recapData = await buildRecapResponse(completion.guildId, gameDate, pool);

    if (!recapData) {
      console.warn(`No completed games found for ${completion.guildId} on ${gameDate}`);
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`start_new_session_${completion.channelId}`)
        .setLabel("Play now!")
        .setStyle(ButtonStyle.Primary)
    );

    const messageOptions = {
      content: recapData.message,
      files: recapData.files,
      components: [row]
    };

    if (completion.guildId && completion.guildId !== "dm") {
      const guild = client.guilds.cache.get(completion.guildId);
      if (!guild) {
        console.warn(`❌ Guild ${completion.guildId} not found`);
        return;
      }

      const channel = guild.channels.cache.get(completion.channelId);
      if (!channel) {
        console.warn(`❌ Channel ${completion.channelId} not found in guild ${completion.guildId}`);
        return;
      }

      await channel.send(messageOptions);
      console.log(`✅ Posted recap for ${completion.channelId} on ${gameDate}`);
      return;
    }

    console.warn(`❌ Unable to post recap for ${completion.channelId} on ${gameDate}`);
  } catch (error) {
    console.error("Error posting recap:", error);
    throw error;
  }
}

function calculateTiebreakerScore(guessHistory) {
  let score = 0;
  const difficultyWeights = { 3: 1000, 2: 100, 1: 10, 0: 1 };

  guessHistory.forEach((guess, index) => {
    if (guess.correct && guess.difficulty !== null) {
      const positionMultiplier = 10 - index;
      score += difficultyWeights[guess.difficulty] * positionMultiplier;
    }
  });

  return score;
}

function buildRecapMessage(completedResults, incompletePlayers, gameDate) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const totalPlayers = completedResults.length + incompletePlayers.length;

  if (totalPlayers === 0) {
    return `📊 **Synapse - ${formattedDate}**\n\nNo one played the puzzle.`;
  }

  let message = `📊 **Synapse - ${formattedDate}**`;

  if (completedResults.length > 0) {
    const winner = completedResults[0];
    const isPerfect = winner.score === 4 && winner.mistakes === 0;

    message += ` - ${completedResults.length} player${
      completedResults.length !== 1 ? "s" : ""
    } completed!\n\n`;

    message += `🏆 ${isPerfect ? "**Perfect!** " : ""}<@${winner.user_id}>`;

    if (completedResults.length > 1) {
      message += `\n${completedResults
        .slice(1)
        .map((r, index) => `${index + 2}. <@${r.user_id}>`)
        .join("\n")}`;
    }

    if (incompletePlayers.length > 0) {
      message += `\n\n**Started:** ${incompletePlayers.map(p => `<@${p.user_id}>`).join(", ")}`;
    }
  } else {
    message += `\n\n${incompletePlayers.length} player${
      incompletePlayers.length !== 1 ? "s" : ""
    } started but didn't complete.\n\n`;
    message += incompletePlayers.map(p => `<@${p.user_id}>`).join(", ");
  }

  return message;
}
