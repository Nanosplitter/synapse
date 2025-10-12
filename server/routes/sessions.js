import { Router } from "express";
import {
  createSession,
  joinSession,
  updateSession,
  lookupSession,
  getSession,
  checkLaunchRequest,
  endSession
} from "../services/session.service.js";

const router = Router();

router.post("/api/sessions/start", async (req, res) => {
  const { sessionId, guildId, channelId, messageId } = req.body;
  const session = createSession(sessionId, guildId, channelId);
  res.json({ success: true, session });
});

router.post("/api/sessions/:messageSessionId/join", async (req, res) => {
  const { messageSessionId } = req.params;
  const { userId, username, avatarUrl, guildId, date } = req.body;

  const result = joinSession(messageSessionId, userId, username, avatarUrl, guildId, date);

  if (result.error) {
    return res.status(404).json(result);
  }

  res.json({ success: true, ...result });
});

router.post("/api/sessions/:userSessionId/update", async (req, res) => {
  const { userSessionId } = req.params;
  const { guessHistory } = req.body;

  const result = updateSession(userSessionId, guessHistory);

  if (result.error) {
    return res.status(404).json(result);
  }

  res.json({ success: true, ...result });
});

router.get("/api/sessions/lookup/:channelId/:userId", async (req, res) => {
  const { channelId, userId } = req.params;
  const result = lookupSession(channelId, userId);
  res.json(result);
});

router.get("/api/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json(session);
});

router.post("/api/sessions/:sessionId/launch", async (req, res) => {
  const { sessionId } = req.params;
  const result = checkLaunchRequest(sessionId);
  res.json(result);
});

router.delete("/api/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const result = endSession(sessionId);
  res.json(result);
});

export default router;
