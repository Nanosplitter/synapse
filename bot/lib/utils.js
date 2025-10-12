const COLOR_EMOJIS = {
  0: "🟨",
  1: "🟩",
  2: "🟦",
  3: "🟪"
};

export function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export function getPuzzleNumber() {
  const firstPuzzleDate = new Date("2023-06-12");
  const today = new Date();
  const diffTime = Math.abs(today - firstPuzzleDate);
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
