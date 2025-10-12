import "./style.css";
import { isLocalMode, DATE_CONFIG } from "./config.js";
import { setupDiscordSdk, getCurrentUser, getGuildId, getChannelId } from "./modules/discord.js";
import { fetchGameData, fetchGameState, lookupUserSession } from "./modules/api.js";
import {
  setGameData,
  setCurrentDate,
  updateGameState,
  restoreFromGuessHistory,
  setDisplayOrder
} from "./modules/game-state.js";
import { hasUserPlayed } from "./modules/game-logic.js";
import { renderGame } from "./modules/renderer.js";

console.log(`Running in ${isLocalMode ? "LOCAL" : "DISCORD"} mode`);

/**
 * Initialize and start the game
 */
async function initializeGame() {
  const app = document.querySelector("#app");

  try {
    await setupDiscordSdk();
    console.log("Discord SDK is authenticated");

    let gameDate = DATE_CONFIG.current;

    let gameData;
    try {
      gameData = await fetchGameData(gameDate);
    } catch (error) {
      console.log(`No game found for ${gameDate}, using fallback date ${DATE_CONFIG.fallback}`);
      gameDate = DATE_CONFIG.fallback;
      gameData = await fetchGameData(gameDate);
    }

    console.log("Game data received:", gameData);
    console.log("Categories:", gameData.categories);

    setGameData(gameData);
    setCurrentDate(gameDate);

    if (gameData.startingOrder) {
      setDisplayOrder(gameData.startingOrder);
      console.log("Initial display order set from API positions");
    }

    const guildId = getGuildId();
    const channelId = getChannelId();
    const currentUser = getCurrentUser();
    const serverGameState = await fetchGameState(guildId, gameDate);

    console.log("Server game state:", serverGameState);
    console.log("Current user:", currentUser);

    const sessionLookup = await lookupUserSession(channelId, currentUser.id);

    const sessionId = `${guildId}_${currentUser.id}_${gameDate}`;

    if (sessionLookup.found) {
      console.log("✅ Found existing session:", sessionLookup.messageSessionId);

      if (sessionLookup.guessHistory && sessionLookup.guessHistory.length > 0) {
        restoreFromGuessHistory(sessionLookup.guessHistory);
        console.log(`🔄 Restored ${sessionLookup.guessHistory.length} guesses from server`);
      }

      updateGameState({ sessionId });
    } else {
      console.log("❌ No active session found, checking completion status");

      if (hasUserPlayed(serverGameState, currentUser.id)) {
        updateGameState({
          hasPlayed: true,
          isGameOver: true,
          sessionId
        });
      } else {
        updateGameState({
          sessionId
        });
      }
    }

    console.log("Session ID:", sessionId);

    console.log("Rendering game...");

    renderGame(serverGameState);
  } catch (error) {
    console.error("Error initializing game:", error);
    app.innerHTML = `
      <div id="loading">
        <h1>Error Loading Game</h1>
        <p>Could not load today's Synapse game. Please try again later.</p>
        <p style="color: #888; font-size: 0.9rem;">Error: ${error.message}</p>
      </div>
    `;
  }
}

initializeGame();
