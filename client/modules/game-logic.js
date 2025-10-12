/**
 * Game logic and validation
 */

import {
  getGameData,
  getGameState,
  getCurrentDate,
  addSolvedCategory,
  incrementMistakes,
  completeGame,
  clearSelection,
  recordGuess,
  getGuessHistory,
  shuffleDisplayOrder
} from "./game-state.js";
import { getCurrentUser, getGuildId } from "./discord.js";
import { fetchGameState, saveGameResult as apiSaveGameResult, updateSession } from "./api.js";
import { showMessage, wait } from "../utils/helpers.js";
import { GAME_CONFIG } from "../config.js";

/**
 * Check if the selected words match any unsolved category
 * @param {string[]} selectedWords - Array of selected words
 * @returns {Object|null} - Matched category or null if no match
 */
export function checkCategoryMatch(selectedWords) {
  const gameData = getGameData();
  const gameState = getGameState();
  const selected = new Set(selectedWords);

  return gameData.categories.find((category) => {
    if (gameState.solvedCategories.some((solved) => solved.group === category.group)) {
      return false;
    }

    return category.members.every((member) => selected.has(member));
  });
}

/**
 * Check if selection is "one away" from a correct answer
 * @param {string[]} selectedWords - Array of selected words
 * @returns {boolean} - True if one away
 */
export function isOneAway(selectedWords) {
  const gameData = getGameData();
  const gameState = getGameState();
  const selected = new Set(selectedWords);

  for (const category of gameData.categories) {
    if (gameState.solvedCategories.some((solved) => solved.group === category.group)) {
      continue;
    }

    const matches = category.members.filter((member) => selected.has(member)).length;

    if (matches === 3) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the game is won (all categories solved)
 * @returns {boolean} - True if all categories are solved
 */
export function isGameWon() {
  const gameState = getGameState();
  return gameState.solvedCategories.length === GAME_CONFIG.totalCategories;
}

/**
 * Check if the game is lost (max mistakes reached)
 * @returns {boolean} - True if max mistakes reached
 */
export function isGameLost() {
  const gameState = getGameState();
  return gameState.mistakes >= gameState.maxMistakes;
}

/**
 * Check if a user has already played today
 * @param {Object} serverGameState - Server game state
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if user has played
 */
export function hasUserPlayed(serverGameState, userId) {
  return !!(serverGameState.players && serverGameState.players[userId]);
}

/**
 * Update the session with current guess history
 */
async function updateSessionState() {
  const gameState = getGameState();
  if (gameState.sessionId) {
    await updateSession(gameState.sessionId, getGuessHistory());
  }
}

/**
 * Handle the submit button click
 */
export async function handleSubmit() {
  const gameState = getGameState();

  if (gameState.selectedWords.length !== 4) return;

  const matchedCategory = checkCategoryMatch(gameState.selectedWords);

  if (matchedCategory) {
    recordGuess(gameState.selectedWords, true, matchedCategory.difficulty);
    addSolvedCategory(matchedCategory);
    clearSelection();
    showMessage("Correct! 🎉", "success");

    await updateSessionState();

    if (isGameWon()) {
      completeGame();
      await saveGameResult();
    }

    await wait(1000);
    await refreshGame();
  } else {
    const guessedWords = [...gameState.selectedWords];

    const wordDifficulties = guessedWords.map((word) => {
      const gameData = getGameData();
      const category = gameData.categories.find((cat) => cat.members.includes(word));
      return category ? category.difficulty : null;
    });

    recordGuess(gameState.selectedWords, false, null, wordDifficulties);
    incrementMistakes();

    await updateSessionState();

    if (isOneAway(guessedWords)) {
      showMessage("One away...", "info");
    } else {
      showMessage("Not quite. Try again!", "error");
    }

    if (isGameLost()) {
      await saveGameResult();
    }

    await wait(1500);
    await refreshGame();
  }
}

export async function handleShuffle() {
  clearSelection();
  shuffleDisplayOrder();
  await refreshGame();
}

/**
 * Refresh the game by fetching the latest state
 */
async function refreshGame() {
  const { renderGame } = await import("./renderer.js");
  const guildId = getGuildId();
  const currentDate = getCurrentDate();

  const serverGameState = await fetchGameState(guildId, currentDate);
  renderGame(serverGameState);
}

/**
 * Save the game result to the server
 */
async function saveGameResult() {
  const gameState = getGameState();
  const currentUser = getCurrentUser();
  const guildId = getGuildId();
  const currentDate = getCurrentDate();

  try {
    await apiSaveGameResult(guildId, currentDate, {
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      score: gameState.solvedCategories.length,
      mistakes: gameState.mistakes,
      guessHistory: getGuessHistory()
    });

    gameState.hasPlayed = true;

    await refreshGame();
  } catch (error) {
    console.error("Error saving game result:", error);
  }
}
