import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Generate a Synapse game grid image for multiple players
 * @param {Object} options - Image generation options
 * @param {Array} options.players - Array of player objects: { username, avatarUrl, guessHistory, isComplete }
 * @param {number} options.puzzleNumber - Puzzle number
 * @returns {Buffer} PNG image buffer
 */
export async function generateGameImage({ players = [], puzzleNumber = null }) {
  // If no players, show empty state
  if (players.length === 0) {
    return generateEmptyImage(puzzleNumber);
  }

  // Single player: horizontal layout
  if (players.length === 1) {
    return generateSinglePlayerImage(players[0], puzzleNumber);
  }

  // Multiple players: side-by-side columns
  const playerWidth = 280;
  const playerSpacing = 7;
  const headerHeight = 170;
  const gridHeight = 380;

  const width = Math.max(600, players.length * playerWidth + (players.length - 1) * playerSpacing + 40);
  const height = headerHeight + gridHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, width, height);

  // Draw each player's section
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const x = 20 + i * (playerWidth + playerSpacing);

    await drawPlayerSection(ctx, player, x, headerHeight, playerWidth);
  }

  return canvas.toBuffer("image/png");
}

/**
 * Generate empty image when no players have joined
 */
function generateEmptyImage(puzzleNumber) {
  const width = 500;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  const title = puzzleNumber ? `Synapse #${puzzleNumber}` : "Synapse";
  ctx.fillText(title, 20, 40);

  // Message
  ctx.font = "18px Arial";
  ctx.fillStyle = "#999999";
  ctx.fillText("Waiting for players...", 20, 100);
  ctx.font = "14px Arial";
  ctx.fillText("Click 'Play' to join!", 20, 130);

  return canvas.toBuffer("image/png");
}

/**
 * Generate single player image (horizontal layout)
 */
async function generateSinglePlayerImage(player, puzzleNumber) {
  const width = 500;
  const height = 400; // Taller to fit all guesses
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, width, height);

  const { username, avatarUrl, guessHistory = [] } = player;

  // Draw large circular avatar on the left
  const avatarSize = 120;
  const avatarX = 60;
  const avatarY = height / 2 - avatarSize / 2; // Vertically centered

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);

      // Create circular clipping path
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the avatar
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch (error) {
      console.error(`Failed to load avatar for ${username}:`, error.message);
    }
  }

  // Draw grid on the right side
  const cellSize = 40;
  const cellSpacing = 5;
  const gridWidth = 4 * cellSize + 3 * cellSpacing;
  const gridX = avatarX + avatarSize + 60; // 60px spacing between avatar and grid
  const gridStartY = 40; // Start higher to fit more rows

  // Color mapping
  const colors = {
    0: "#f9df6d", // Yellow
    1: "#a0c35a", // Green
    2: "#b0c4ef", // Blue
    3: "#ba81c5" // Purple
  };
  const incorrectColor = "#5a5a5a";

  // Check if game is complete (4 correct OR 4 mistakes)
  const correctCount = guessHistory.filter((g) => g.correct).length;
  const mistakeCount = guessHistory.filter((g) => !g.correct).length;
  const isGameComplete = correctCount === 4 || mistakeCount >= 4;

  const totalRows = 7;
  const emptyColor = "#2a2a2a"; // Darker gray for empty squares

  // Draw all 7 rows
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowY = gridStartY + rowIndex * (cellSize + cellSpacing);
    const guess = guessHistory[rowIndex];

    if (guess) {
      // Draw actual guess
      if (guess.correct && guess.difficulty !== null) {
        // Correct guess - all same color
        const color = colors[guess.difficulty] || incorrectColor;
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          ctx.fillStyle = color;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      } else if (isGameComplete && guess.wordDifficulties && guess.wordDifficulties.length === 4) {
        // Incorrect guess - show word colors ONLY if game is complete
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          const wordDiff = guess.wordDifficulties[col];
          ctx.fillStyle = wordDiff !== null ? colors[wordDiff] || incorrectColor : incorrectColor;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      } else {
        // Game in progress OR no word difficulties - gray squares
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          ctx.fillStyle = incorrectColor;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      }
    } else {
      // Draw empty squares with border
      for (let col = 0; col < 4; col++) {
        const cellX = gridX + col * (cellSize + cellSpacing);
        ctx.fillStyle = emptyColor;
        ctx.fillRect(cellX, rowY, cellSize, cellSize);

        // Add border to empty squares
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX, rowY, cellSize, cellSize);
      }
    }
  }

  return canvas.toBuffer("image/png");
}

/**
 * Draw a single player's section (avatar, name, grid, stats)
 */
async function drawPlayerSection(ctx, player, x, y, width) {
  const { username, avatarUrl, guessHistory = [] } = player;

  // Draw avatar
  if (avatarUrl) {
    try {
      console.log(`🖼️ Loading avatar for ${username}`);
      const avatar = await loadImage(avatarUrl);
      const avatarSize = 110;
      const avatarX = x + (width - avatarSize) / 2; // Center avatar
      const avatarY = y - 130;

      // Create circular clipping path
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the avatar
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      console.log(`✅ Avatar loaded for ${username}`);
    } catch (error) {
      console.error(`❌ Failed to load avatar for ${username}:`, error.message);
    }
  }

  // Draw username centered below avatar
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(username, x + width / 2, y - 10);
  ctx.textAlign = "left"; // Reset alignment

  // Grid settings
  const cellSize = 40;
  const cellSpacing = 6;
  const gridWidth = 4 * cellSize + 3 * cellSpacing;
  const gridX = x + (width - gridWidth) / 2; // Center grid
  let gridY = y + 10;

  // Color mapping for difficulties
  const colors = {
    0: "#f9df6d", // Yellow
    1: "#a0c35a", // Green
    2: "#b0c4ef", // Blue
    3: "#ba81c5" // Purple
  };

  const incorrectColor = "#5a5a5a"; // Gray

  // Check if this player's game is complete
  const correctCount = guessHistory.filter((g) => g.correct).length;
  const mistakeCount = guessHistory.filter((g) => !g.correct).length;
  const isGameComplete = correctCount === 4 || mistakeCount >= 4;

  const totalRows = 7;
  const emptyColor = "#2a2a2a"; // Darker gray for empty squares

  // Draw all 7 rows
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowY = gridY + rowIndex * (cellSize + cellSpacing);
    const guess = guessHistory[rowIndex];

    if (guess) {
      // Draw actual guess
      if (guess.correct && guess.difficulty !== null) {
        // Correct guess - show 4 squares of the same color
        const color = colors[guess.difficulty] || incorrectColor;
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          ctx.fillStyle = color;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      } else if (isGameComplete && guess.wordDifficulties && guess.wordDifficulties.length === 4) {
        // Incorrect guess - show word colors ONLY if game is complete
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          const wordDiff = guess.wordDifficulties[col];
          ctx.fillStyle = wordDiff !== null ? colors[wordDiff] || incorrectColor : incorrectColor;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      } else {
        // Game in progress OR no word difficulties - gray squares
        for (let col = 0; col < 4; col++) {
          const cellX = gridX + col * (cellSize + cellSpacing);
          ctx.fillStyle = incorrectColor;
          ctx.fillRect(cellX, rowY, cellSize, cellSize);
        }
      }
    } else {
      // Draw empty squares with border
      for (let col = 0; col < 4; col++) {
        const cellX = gridX + col * (cellSize + cellSpacing);
        ctx.fillStyle = emptyColor;
        ctx.fillRect(cellX, rowY, cellSize, cellSize);

        // Add border to empty squares
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX, rowY, cellSize, cellSize);
      }
    }
  }

  // Stats removed - just show the grid
}

/**
 * Format guess history into emoji grid for text display
 * @param {Array} guessHistory - Array of guess objects
 * @param {Object} gameData - Game data with categories (optional, for incorrect guesses)
 */
export function formatGuessGrid(guessHistory, gameData = null) {
  const colorEmojis = {
    0: "🟨", // Yellow (easiest)
    1: "🟩", // Green
    2: "🟦", // Blue
    3: "🟪" // Purple (hardest)
  };

  if (!guessHistory || guessHistory.length === 0) {
    return "No data";
  }

  return guessHistory
    .map((guess) => {
      if (guess.correct && guess.difficulty !== null) {
        // Correct guess - show 4 squares of the same color
        const emoji = colorEmojis[guess.difficulty] || "⬜";
        return emoji.repeat(4);
      } else {
        // Incorrect guess - try to get word difficulties from game data
        if (gameData && guess.words) {
          const emojis = guess.words.map((word) => {
            // Find which category this word belongs to
            const category = gameData.categories?.find((cat) => cat.members.includes(word));
            if (category) {
              return colorEmojis[category.difficulty] || "⬜";
            }
            return "⬜";
          });
          return emojis.join("");
        }
        // Fallback if no game data
        return "⬜⬜⬜⬜";
      }
    })
    .join("\n");
}
