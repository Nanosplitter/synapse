const COLOR_EMOJIS = {
  0: "🟨",
  1: "🟩",
  2: "🟦",
  3: "🟪"
};

/**
 * Get current date in EST timezone in YYYY-MM-DD format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getTodayDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Add days to a date string and return in YYYY-MM-DD format (EST timezone)
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {number} days - Number of days to add
 * @returns {string} New date in YYYY-MM-DD format
 */
export function addDays(dateString, days) {
  const date = new Date(dateString + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function getPuzzleNumber(dateString = null) {
  const firstPuzzleDate = new Date("2023-06-12");
  const targetDate = dateString ? new Date(dateString) : new Date();
  const diffTime = Math.abs(targetDate - firstPuzzleDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function formatGuessGrid(guessHistory, gameData = null) {
  if (!guessHistory || guessHistory.length === 0) {
    return "No data";
  }

  return guessHistory
    .map((guess) => {
      if (guess.correct && guess.difficulty !== null) {
        const emoji = COLOR_EMOJIS[guess.difficulty] || "⬜";
        return emoji.repeat(4);
      } else {
        if (gameData && guess.words) {
          const emojis = guess.words.map((word) => {
            const category = gameData.categories?.find((cat) => cat.members.includes(word));
            if (category) {
              return COLOR_EMOJIS[category.difficulty] || "⬜";
            }
            return "⬜";
          });
          return emojis.join("");
        }
        return "⬜⬜⬜⬜";
      }
    })
    .join("\n");
}
