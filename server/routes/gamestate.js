import { Router } from "express";
import { getGameState, saveGameResult, deleteGameResult } from "../services/database.service.js";
import { clearUserFromSessions } from "../services/session.service.js";

const router = Router();

router.get("/api/gamestate/:guildId/:date", async (req, res) => {
  const { guildId, date } = req.params;

  try {
    const gameState = await getGameState(guildId, date);
    res.json(gameState);
  } catch (error) {
    console.error("Error fetching game state:", error);
    res.status(500).json({ error: "Failed to fetch game state" });
  }
});

router.post("/api/gamestate/:guildId/:date/complete", async (req, res) => {
  const { guildId, date } = req.params;
  const { userId, username, avatar, score, mistakes, guessHistory } = req.body;

  try {
    const result = await saveGameResult(guildId, date, {
      userId,
      username,
      avatar,
      score,
      mistakes,
      guessHistory
    });
    res.json(result);
  } catch (error) {
    console.error("Error saving game result:", error);
    res.status(500).json({ error: "Failed to save game result" });
  }
});

router.delete("/api/gamestate/:guildId/:date/:userId", async (req, res) => {
  const { guildId, date, userId } = req.params;

  try {
    console.log(`🗑️ Deleting game record for user ${userId} on ${date}`);

    clearUserFromSessions(guildId, userId, date);

    const result = await deleteGameResult(guildId, date, userId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting game result:", error);
    res.status(500).json({ error: "Failed to delete game result" });
  }
});

export default router;
