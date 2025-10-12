/**
 * UI rendering functions
 */

import {
  getGameState,
  getGameData,
  getRemainingWords,
  toggleWordSelection,
  clearSelection,
  getCurrentDate,
  getDisplayOrder,
  setDisplayOrder
} from "./game-state.js";
import { handleSubmit, handleShuffle } from "./game-logic.js";
import { getCurrentUser, getDiscordSdk } from "./discord.js";
import { isLocalMode, isDevMode, CATEGORY_COLORS } from "../config.js";
import { escapeHtml } from "../utils/helpers.js";
import { deleteGameResult } from "./api.js";

/**
 * Render the complete game UI
 * @param {Object} serverGameState - Server game state with player data
 */
export function renderGame(serverGameState) {
  const app = document.querySelector("#app");
  const gameState = getGameState();
  const currentUser = getCurrentUser();
  const discordSdk = getDiscordSdk();

  let html = `<h1>Synapse</h1>`;

  if (isDevMode) {
    const modeText = isLocalMode ? "Local Development Mode" : "Dev Mode (Discord SDK Active)";
    html += `
      <div class="dev-mode-banner">
        🔧 ${modeText} | User: ${currentUser?.username || "Unknown"} | Guild: ${discordSdk?.guildId || "default"}
      </div>
    `;
  }

  html += renderCompletedPlayers(serverGameState);

  if (gameState.hasPlayed) {
    html += renderAlreadyPlayed(serverGameState, currentUser);
  } else if (gameState.isGameOver) {
    html += renderGameOver();
  } else {
    html += renderGameBoard();
  }

  app.innerHTML = html;

  if (!gameState.isGameOver && !gameState.hasPlayed) {
    attachEventListeners();
  }

  if (isDevMode && (gameState.isGameOver || gameState.hasPlayed)) {
    attachDeleteListener();
  }
}

/**
 * Render the list of completed players with visual guess history
 * @param {Object} serverGameState - Server game state
 * @returns {string} - HTML string
 */
function renderCompletedPlayers(serverGameState) {
  const completedPlayers = Object.entries(serverGameState.players || {});

  if (completedPlayers.length === 0) {
    return "";
  }

  return `
    <div class="completed-players">
      <h2>Completed Today</h2>
      <div class="player-results-grid">
        ${completedPlayers
          .map(([userId, player]) => {
            const guessHistory =
              typeof player.guessHistory === "string" ? JSON.parse(player.guessHistory) : player.guessHistory;
            return `
          <div class="player-result-card">
            ${renderPlayerAvatar(player, userId)}
            <div class="player-name">${escapeHtml(player.username)}</div>
            ${renderGuessGrid(guessHistory)}
          </div>
        `;
          })
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Render a player's avatar
 * @param {Object} player - Player data
 * @param {string} userId - User ID
 * @returns {string} - HTML string
 */
function renderPlayerAvatar(player, userId) {
  if (player.avatar) {
    const avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${player.avatar}.png?size=128`;
    return `<img src="${avatarUrl}" alt="${escapeHtml(player.username)}" class="player-avatar" />`;
  }

  const initials = player.username.substring(0, 2).toUpperCase();
  return `<div class="player-avatar-fallback">${initials}</div>`;
}

/**
 * Get the difficulty level for a specific word
 * @param {string} word - The word to check
 * @returns {number|null} - Difficulty level (0-3) or null if not found
 */
function getWordDifficulty(word) {
  const gameData = getGameData();
  if (!gameData || !gameData.categories) return null;

  for (const category of gameData.categories) {
    if (category.members.includes(word)) {
      return category.difficulty;
    }
  }
  return null;
}

/**
 * Render the visual guess grid (colored squares)
 * @param {Array} guessHistory - Array of guess objects
 * @returns {string} - HTML string
 */
function renderGuessGrid(guessHistory) {
  if (!guessHistory || guessHistory.length === 0) {
    return '<div class="guess-grid">No data</div>';
  }

  const colors = {
    0: "#f9df6d", // Yellow (easiest)
    1: "#a0c35a", // Green
    2: "#b0c4ef", // Blue
    3: "#ba81c5" // Purple (hardest)
  };
  const incorrectColor = "#5a5a5a";

  return `
    <div class="guess-grid">
      ${guessHistory
        .map((guess) => {
          if (guess.correct && guess.difficulty !== null) {
            const color = colors[guess.difficulty] || incorrectColor;
            return `
              <div class="guess-row">
                ${Array(4).fill(`<div class="guess-square" style="background-color: ${color}"></div>`).join("")}
              </div>
            `;
          } else {
            const squares = guess.words.map((word) => {
              const difficulty = getWordDifficulty(word);
              const color = difficulty !== null ? colors[difficulty] : incorrectColor;
              return `<div class="guess-square" style="background-color: ${color}"></div>`;
            });
            return `<div class="guess-row">${squares.join("")}</div>`;
          }
        })
        .join("")}
    </div>
  `;
}

/**
 * Helper to render categories with optional solved/unsolved styling
 * @param {Array} categoriesToRender - Array of category objects with `solved` property
 * @returns {string} - HTML string
 */
function renderCategoriesWithState(categoriesToRender) {
  let html = `<div class="solved-categories">`;
  categoriesToRender.forEach((category) => {
    const colorClass = CATEGORY_COLORS[category.difficulty] || "yellow";
    const opacity = category.solved ? "" : " unsolved";
    html += `
      <div class="category ${colorClass}${opacity}">
        <div class="category-title">${escapeHtml(category.group)}</div>
        <div class="category-words">${category.members.map(escapeHtml).join(", ")}</div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

/**
 * Render categories from completed game data
 * @param {Array} guessHistory - Player's guess history
 * @returns {string} - HTML string
 */
function renderCompletedCategories(guessHistory) {
  const gameData = getGameData();

  if (!gameData || !gameData.categories) {
    return "";
  }

  const correctGuesses = guessHistory.filter((g) => g.correct);
  const solvedGroups = new Set(
    correctGuesses
      .map((guess) => {
        const category = gameData.categories.find((cat) => cat.members.every((member) => guess.words.includes(member)));
        return category?.group;
      })
      .filter(Boolean)
  );

  const allCategories = gameData.categories.map((cat) => ({
    ...cat,
    solved: solvedGroups.has(cat.group)
  }));

  allCategories.sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return 0;
  });

  return renderCategoriesWithState(allCategories);
}

/**
 * Render message for players who already completed the game
 * @param {Object} serverGameState - Server game state
 * @param {Object} currentUser - Current user object
 * @returns {string} - HTML string
 */
function renderAlreadyPlayed(serverGameState, currentUser) {
  const playerData = serverGameState.players[currentUser.id];
  const guessHistory =
    typeof playerData.guessHistory === "string" ? JSON.parse(playerData.guessHistory) : playerData.guessHistory;

  return `
    <div class="game-over">
      <h2>You've already completed today's Synapse!</h2>
      <div class="final-score">
        Score: ${playerData.score}/4 categories<br>
        Mistakes: ${playerData.mistakes}/4
      </div>
      ${renderCompletedCategories(guessHistory)}
      ${isDevMode ? '<button id="delete-record" class="dev-delete-btn">Delete My Record</button>' : ""}
    </div>
  `;
}

/**
 * Render all categories at game end (solved first, then unsolved)
 * @returns {string} - HTML string
 */
function renderFinalCategories() {
  const gameState = getGameState();
  const gameData = getGameData();

  if (!gameData || !gameData.categories) {
    return "";
  }

  const solvedGroups = new Set(gameState.solvedCategories.map((cat) => cat.group));
  const allCategories = [
    ...gameState.solvedCategories.map((cat) => ({ ...cat, solved: true })),
    ...gameData.categories.filter((cat) => !solvedGroups.has(cat.group)).map((cat) => ({ ...cat, solved: false }))
  ];

  return renderCategoriesWithState(allCategories);
}

/**
 * Render the game over screen
 * @returns {string} - HTML string
 */
function renderGameOver() {
  const gameState = getGameState();
  const score = gameState.solvedCategories.length;
  const won = score === 4;

  return `
    <div class="game-over">
      <h2>${won ? "🎉 Congratulations!" : "Game Over"}</h2>
      <div class="final-score">
        You solved ${score}/4 categories<br>
        Mistakes: ${gameState.mistakes}/${gameState.maxMistakes}
      </div>
      ${renderFinalCategories()}
      ${isDevMode ? '<button id="delete-record" class="dev-delete-btn">Delete My Record (Dev Mode)</button>' : ""}
    </div>
  `;
}

/**
 * Render the active game board
 * @returns {string} - HTML string
 */
function renderGameBoard() {
  const gameState = getGameState();

  let html = `
    <div class="game-status">
      <div class="mistakes">
        Mistakes remaining: ${gameState.maxMistakes - gameState.mistakes}
      </div>
      <div class="mistake-dots">
        ${Array.from(
          { length: gameState.maxMistakes },
          (_, i) => `<div class="mistake-dot ${i < gameState.mistakes ? "used" : ""}"></div>`
        ).join("")}
      </div>
    </div>
  `;

  html += renderSolvedCategories();
  html += `<div id="message"></div>`;
  html += renderWordGrid();
  html += renderControls();

  return html;
}

/**
 * Render solved categories
 * @returns {string} - HTML string
 */
function renderSolvedCategories() {
  const gameState = getGameState();

  if (gameState.solvedCategories.length === 0) {
    return "";
  }

  let html = `<div class="solved-categories">`;

  gameState.solvedCategories.forEach((category) => {
    const colorClass = CATEGORY_COLORS[category.difficulty] || "yellow";
    html += `
      <div class="category ${colorClass}">
        <div class="category-title">${escapeHtml(category.group)}</div>
        <div class="category-words">${category.members.map(escapeHtml).join(", ")}</div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

/**
 * Render the word grid
 * @returns {string} - HTML string
 */
function renderWordGrid() {
  const remainingWords = getRemainingWords();
  const remainingSet = new Set(remainingWords);
  let displayWords;
  let html = "";

  if (isDevMode) {
    displayWords = remainingWords;
  } else {
    let displayOrder = getDisplayOrder();
    if (displayOrder) {
      displayWords = displayOrder.filter((word) => remainingSet.has(word));
    } else {
      displayWords = remainingWords;
    }
  }

  const gameState = getGameState();
  const selectedWords = gameState.selectedWords || [];

  html += `
    <div class="game-grid ${isDevMode ? "dev-mode" : ""}">
      ${displayWords
        .map((word) => {
          const isSelected = selectedWords.includes(word);
          return `
        <button class="word-button ${isSelected ? "selected" : ""}" data-word="${escapeHtml(word)}">
          ${escapeHtml(word)}
        </button>
      `;
        })
        .join("")}
    </div>
  `;

  return html;
}

/**
 * Render game controls
 * @returns {string} - HTML string
 */
function renderControls() {
  return `
    <div class="game-controls">
      <button id="shuffle" class="secondary">Shuffle</button>
      <button id="deselect" class="secondary">Deselect All</button>
      <button id="submit" disabled>Submit</button>
    </div>
  `;
}

/**
 * Attach event listeners to interactive elements
 */
function attachEventListeners() {
  document.querySelectorAll(".word-button").forEach((button) => {
    button.addEventListener("click", () => {
      const word = button.dataset.word;
      const isSelected = toggleWordSelection(word);

      if (isSelected) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }

      updateSubmitButton();
    });
  });

  document.getElementById("shuffle")?.addEventListener("click", handleShuffle);

  document.getElementById("deselect")?.addEventListener("click", () => {
    clearSelection();
    document.querySelectorAll(".word-button").forEach((btn) => {
      btn.classList.remove("selected");
    });
    updateSubmitButton();
  });

  document.getElementById("submit")?.addEventListener("click", handleSubmit);
}

/**
 * Update the submit button's enabled state
 */
function updateSubmitButton() {
  const gameState = getGameState();
  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    submitBtn.disabled = gameState.selectedWords.length !== 4;
  }
}

/**
 * Attach event listener to delete button (dev mode only)
 */
function attachDeleteListener() {
  const deleteBtn = document.getElementById("delete-record");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const currentUser = getCurrentUser();
      const discordSdk = getDiscordSdk();
      const guildId = discordSdk?.guildId || "default";
      const currentDate = getCurrentDate();

      try {
        deleteBtn.disabled = true;
        deleteBtn.textContent = "Deleting...";

        await deleteGameResult(guildId, currentDate, currentUser.id);

        window.location.reload();
      } catch (error) {
        console.error("Error deleting game result:", error);
        alert("Failed to delete record. Please try again.");
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Delete My Record (Dev Mode)";
      }
    });
  }
}
