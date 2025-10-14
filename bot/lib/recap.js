import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { getTodayDate, getPuzzleNumber, addDays } from "./utils.js";
import { generateGameImage } from "../image-generator.js";

const channelCompletions = new Map();
const postedRecaps = new Set();

export function trackSessionCompletion(sessionId, guildId, channelId, messageId, players, puzzleNumber, interaction, webhook) {
  const gameDate = getTodayDate();
  const key = `${channelId}_${gameDate}`;

  channelCompletions.set(key, {
    channelId,
    guildId,
    gameDate,
    puzzleNumber,
    lastMessageId: messageId,
    lastInteraction: interaction,
    lastWebhook: webhook
  });

  console.log(`📝 Tracked completion in channel ${channelId} for date ${gameDate}`);
}

export async function checkForRecaps(client, pool) {
  if (channelCompletions.size === 0) return;

  const recapHour = parseInt(process.env.RECAP_HOUR || "9", 10);
  const recapTimeZoneOffset = parseInt(process.env.RECAP_TIMEZONE_OFFSET || "-5", 10);

  const now = new Date();
  const utcHour = now.getUTCHours();
  const localHour = (utcHour + recapTimeZoneOffset + 24) % 24;

  if (localHour < recapHour) return;

  const today = getTodayDate();
  const yesterday = addDays(today, -1);

  const channelsToCheck = new Set();
  for (const [key, completion] of channelCompletions.entries()) {
    if (completion.gameDate === yesterday) {
      channelsToCheck.add(completion.channelId);
    }
  }

  for (const channelId of channelsToCheck) {
    const recapKey = `${channelId}_${yesterday}`;

    if (postedRecaps.has(recapKey)) continue;

    const completionKey = `${channelId}_${yesterday}`;
    const completion = channelCompletions.get(completionKey);

    if (!completion) continue;

    console.log(`📊 Posting recap for channel ${channelId}, date ${yesterday}`);

    try {
      await postRecap(client, completion, pool, yesterday);
      postedRecaps.add(recapKey);

      setTimeout(() => {
        channelCompletions.delete(completionKey);
        console.log(`🗑️ Removed completion tracking for ${recapKey}`);
      }, 60000);
    } catch (error) {
      console.error(`❌ Error posting recap for ${recapKey}:`, error);
    }
  }
}

async function postRecap(client, completion, pool, gameDate) {
  try {
    const puzzleNumber = getPuzzleNumber(gameDate);

    let allResults = [];
    if (pool) {
      const [rows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?
         ORDER BY completed_at ASC`,
        [completion.guildId, gameDate]
      );
      allResults = rows;
    }

    const sortedResults = [...allResults].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;

      const aGuessHistory = typeof a.guess_history === 'string' ? JSON.parse(a.guess_history) : a.guess_history;
      const bGuessHistory = typeof b.guess_history === 'string' ? JSON.parse(b.guess_history) : b.guess_history;

      return calculateTiebreakerScore(bGuessHistory) - calculateTiebreakerScore(aGuessHistory);
    });

    const players = sortedResults.map(result => ({
      username: result.username,
      avatarUrl: result.avatar ? `https://cdn.discordapp.com/avatars/${result.user_id}/${result.avatar}.png` : null,
      guessHistory: typeof result.guess_history === 'string' ? JSON.parse(result.guess_history) : result.guess_history
    }));

    const imageBuffer = await generateGameImage({ players, puzzleNumber });
    const attachment = new AttachmentBuilder(imageBuffer, { name: "synapse-recap.png" });

    const messageText = buildRecapMessage(sortedResults, puzzleNumber);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`start_new_session_${completion.channelId}`)
        .setLabel("Play now!")
        .setStyle(ButtonStyle.Primary)
    );

    if (completion.lastInteraction) {
      try {
        await completion.lastInteraction.followUp({
          content: messageText,
          files: [attachment],
          components: [row]
        });
        console.log(`✅ Posted recap for ${completion.channelId} on ${gameDate} via interaction`);
        return;
      } catch (error) {
        console.warn(`⚠️ Interaction expired, falling back to guild channel:`, error.message);
      }
    }

    if (completion.lastWebhook) {
      try {
        await completion.lastWebhook.send({
          content: messageText,
          files: [attachment],
          components: [row]
        });
        console.log(`✅ Posted recap for ${completion.channelId} on ${gameDate} via webhook`);
        return;
      } catch (error) {
        console.warn(`⚠️ Webhook failed, falling back to guild channel:`, error.message);
      }
    }

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

      await channel.send({
        content: messageText,
        files: [attachment],
        components: [row]
      });

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

function buildRecapMessage(results, puzzleNumber) {
  if (results.length === 0) {
    return `📊 **Synapse #${puzzleNumber}**\n\nNo one completed the puzzle.`;
  }

  const playerCount = results.length;
  const winner = results[0];
  const isPerfect = winner.score === 4 && winner.mistakes === 0;

  let message = `📊 **Synapse #${puzzleNumber}** - ${playerCount} player${playerCount !== 1 ? 's' : ''} completed!\n\n`;

  message += `🏆 ${isPerfect ? '**Perfect!** ' : ''}<@${winner.user_id}>`;

  if (results.length > 1) {
    message += `\n${results.slice(1).map((r, index) => `${index + 2}. <@${r.user_id}>`).join('\n')}`;
  }

  return message;
}
