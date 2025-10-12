import mysql from "mysql2/promise";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getTodayDate, formatGuessGrid } from "./utils.js";

export async function initializeDatabase(connectionString) {
  try {
    if (!connectionString) {
      console.log("⚠️  No MySQL connection string found - bot will not function properly");
      return null;
    }

    const pool = mysql.createPool(connectionString);
    const connection = await pool.getConnection();
    console.log("✓ MySQL connected successfully!");
    connection.release();
    return pool;
  } catch (error) {
    console.error("✗ Database initialization error:", error.message);
    return null;
  }
}

export async function checkForCompletedGames(client, pool, postedGames) {
  if (!pool) return;

  try {
    const today = getTodayDate();
    const [rows] = await pool.query(
      `SELECT guild_id, user_id, username, avatar, score, mistakes, guess_history, completed_at
       FROM game_results
       WHERE game_date = ?
       ORDER BY completed_at DESC`,
      [today]
    );

    for (const row of rows) {
      const gameKey = `${row.guild_id}:${row.user_id}:${today}`;
      if (postedGames.has(gameKey)) continue;

      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) continue;

      let channel = guild.channels.cache.find((ch) => ch.name === "synapse" && ch.isTextBased());
      if (!channel) {
        channel = guild.channels.cache.find((ch) => ch.isTextBased());
      }
      if (!channel) continue;

      const guessHistory = typeof row.guess_history === "string" ? JSON.parse(row.guess_history) : row.guess_history;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${row.username} completed Synapse!`,
          iconURL: row.avatar ? `https://cdn.discordapp.com/avatars/${row.user_id}/${row.avatar}.png` : undefined
        })
        .setDescription(formatGuessGrid(guessHistory))
        .addFields(
          { name: "Score", value: `${row.score}/4 categories`, inline: true },
          { name: "Mistakes", value: `${row.mistakes}/4`, inline: true }
        )
        .setColor(row.score === 4 ? 0x57f287 : row.mistakes >= 4 ? 0xed4245 : 0x5865f2)
        .setTimestamp(new Date(row.completed_at));

      const row_buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Play now!")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/activities/${process.env.VITE_DISCORD_CLIENT_ID}`)
      );

      await channel.send({
        embeds: [embed],
        components: [row_buttons]
      });

      postedGames.add(gameKey);
    }
  } catch (error) {
    console.error("Error checking for completed games:", error);
  }
}

export async function postDailyPrompt(client, pool, guildId, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const today = getTodayDate();
    let completedCount = 0;

    if (pool) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM game_results WHERE guild_id = ? AND game_date = ?`,
        [guildId, today]
      );
      completedCount = rows[0]?.count || 0;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎮 Time to play Synapse!")
      .setDescription(
        `Today's puzzle is ready. Can you find all 4 groups?\n\n${completedCount} player${
          completedCount !== 1 ? "s" : ""
        } completed today's puzzle.`
      )
      .setColor(0x5865f2)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Play now!")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/activities/${process.env.VITE_DISCORD_CLIENT_ID}`)
    );

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    console.log(`✓ Posted daily prompt to guild ${guildId}, channel ${channelId}`);
  } catch (error) {
    console.error("Error posting daily prompt:", error);
  }
}
