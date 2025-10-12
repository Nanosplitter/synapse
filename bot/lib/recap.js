import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { getTodayDate, getPuzzleNumber, addDays } from "./utils.js";
import { generateGameImage } from "../image-generator.js";

const completedSessions = new Map();

export function trackSessionCompletion(sessionId, guildId, channelId, messageId, players, puzzleNumber, interaction, webhook) {
  const completionTime = Date.now();
  const gameDate = getTodayDate();

  completedSessions.set(sessionId, {
    sessionId,
    guildId,
    channelId,
    messageId,
    players,
    puzzleNumber,
    interaction,
    webhook,
    gameDate,
    completedAt: completionTime,
    recapPosted: false
  });

  console.log(`📝 Tracked session ${sessionId} completion at ${new Date(completionTime).toISOString()}`);
}

export async function checkForRecaps(client, pool) {
  if (completedSessions.size === 0) return;

  const recapDelayHours = parseFloat(process.env.RECAP_DELAY_HOURS || "24");
  const recapDelayMs = recapDelayHours * 60 * 60 * 1000;
  const now = Date.now();

  for (const [sessionId, session] of completedSessions.entries()) {
    if (session.recapPosted) continue;

    const timeSinceCompletion = now - session.completedAt;

    if (timeSinceCompletion >= recapDelayMs) {
      console.log(`📊 Posting recap for session ${sessionId} (${recapDelayHours} hours elapsed)`);

      try {
        await postRecap(client, session, pool);
        session.recapPosted = true;

        setTimeout(() => {
          completedSessions.delete(sessionId);
          console.log(`🗑️ Removed session ${sessionId} from recap tracking`);
        }, 60000);
      } catch (error) {
        console.error(`❌ Error posting recap for session ${sessionId}:`, error);
      }
    }
  }
}

async function postRecap(client, session, pool) {
  try {
    const gameDate = session.gameDate;
    const puzzleNumber = session.puzzleNumber;

    let allResults = [];
    if (pool) {
      const [rows] = await pool.query(
        `SELECT user_id, username, avatar, score, mistakes, guess_history, completed_at
         FROM game_results
         WHERE guild_id = ? AND game_date = ?
         ORDER BY completed_at ASC`,
        [session.guildId, gameDate]
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
        .setCustomId(`start_new_session_${session.channelId}`)
        .setLabel("Play now!")
        .setStyle(ButtonStyle.Primary)
    );

    if (session.interaction) {
      try {
        await session.interaction.followUp({
          content: messageText,
          files: [attachment],
          components: [row]
        });
        console.log(`✅ Posted recap for session ${session.sessionId} via interaction`);
        return;
      } catch (error) {
        console.warn(`⚠️ Interaction expired, falling back to guild channel:`, error.message);
      }
    }

    if (session.webhook) {
      try {
        await session.webhook.send({
          content: messageText,
          files: [attachment],
          components: [row]
        });
        console.log(`✅ Posted recap for session ${session.sessionId} via webhook`);
        return;
      } catch (error) {
        console.warn(`⚠️ Webhook failed, falling back to guild channel:`, error.message);
      }
    }

    if (session.guildId && session.guildId !== "dm") {
      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) {
        console.warn(`❌ Guild ${session.guildId} not found for fallback`);
        return;
      }

      let channel = guild.channels.cache.find((ch) => ch.name === "synapse" && ch.isTextBased());
      if (!channel) {
        channel = guild.channels.cache.find((ch) => ch.isTextBased());
      }

      if (!channel) {
        console.warn(`❌ No text channel found in guild ${session.guildId}`);
        return;
      }

      await channel.send({
        content: messageText,
        files: [attachment],
        components: [row]
      });

      console.log(`✅ Posted recap for session ${session.sessionId} to guild channel ${channel.name}`);
      return;
    }

    console.warn(`❌ Unable to post recap for session ${session.sessionId}`);
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
