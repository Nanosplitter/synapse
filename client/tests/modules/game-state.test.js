/**
 * Tests for game state management
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getGameState,
  resetGameState,
  updateGameState,
  toggleWordSelection,
  clearSelection,
  addSolvedCategory,
  incrementMistakes,
  completeGame,
  setGameData,
  getGameData,
  setCurrentDate,
  getCurrentDate,
  getRemainingWords
} from "../../modules/game-state.js";

describe("game-state", () => {
  beforeEach(() => {
    resetGameState();
  });

  describe("getGameState", () => {
    it("should return the current game state", () => {
      const state = getGameState();

      expect(state).toBeDefined();
      expect(state).toHaveProperty("selectedWords");
      expect(state).toHaveProperty("solvedCategories");
      expect(state).toHaveProperty("mistakes");
      expect(state).toHaveProperty("isGameOver");
      expect(state).toHaveProperty("hasPlayed");
    });

    it("should have correct initial values", () => {
      const state = getGameState();

      expect(state.selectedWords).toEqual([]);
      expect(state.solvedCategories).toEqual([]);
      expect(state.mistakes).toBe(0);
      expect(state.maxMistakes).toBe(4);
      expect(state.isGameOver).toBe(false);
      expect(state.hasPlayed).toBe(false);
    });
  });

  describe("resetGameState", () => {
    it("should reset state to initial values", () => {
      const state = getGameState();
      state.mistakes = 3;
      state.isGameOver = true;
      state.selectedWords = ["word1", "word2"];

      resetGameState();

      const newState = getGameState();
      expect(newState.selectedWords).toEqual([]);
      expect(newState.mistakes).toBe(0);
      expect(newState.isGameOver).toBe(false);
    });
  });

  describe("updateGameState", () => {
    it("should update state properties", () => {
      updateGameState({ mistakes: 2, isGameOver: true });

      const state = getGameState();
      expect(state.mistakes).toBe(2);
      expect(state.isGameOver).toBe(true);
    });

    it("should only update specified properties", () => {
      updateGameState({ mistakes: 1 });

      const state = getGameState();
      expect(state.mistakes).toBe(1);
      expect(state.isGameOver).toBe(false);
    });
  });

  describe("toggleWordSelection", () => {
    it("should add a word when not selected", () => {
      const wasSelected = toggleWordSelection("APPLE");

      const state = getGameState();
      expect(state.selectedWords).toContain("APPLE");
      expect(wasSelected).toBe(true);
    });

    it("should remove a word when already selected", () => {
      toggleWordSelection("APPLE");
      const wasSelected = toggleWordSelection("APPLE");

      const state = getGameState();
      expect(state.selectedWords).not.toContain("APPLE");
      expect(wasSelected).toBe(false);
    });

    it("should not add more than 4 words", () => {
      toggleWordSelection("WORD1");
      toggleWordSelection("WORD2");
      toggleWordSelection("WORD3");
      toggleWordSelection("WORD4");
      const result = toggleWordSelection("WORD5");

      const state = getGameState();
      expect(state.selectedWords).toHaveLength(4);
      expect(state.selectedWords).not.toContain("WORD5");
      expect(result).toBe(false);
    });

    it("should allow toggling off when at max capacity", () => {
      toggleWordSelection("WORD1");
      toggleWordSelection("WORD2");
      toggleWordSelection("WORD3");
      toggleWordSelection("WORD4");

      toggleWordSelection("WORD2");

      const state = getGameState();
      expect(state.selectedWords).toHaveLength(3);
      expect(state.selectedWords).not.toContain("WORD2");
    });
  });

  describe("clearSelection", () => {
    it("should clear all selected words", () => {
      toggleWordSelection("WORD1");
      toggleWordSelection("WORD2");
      toggleWordSelection("WORD3");

      clearSelection();

      const state = getGameState();
      expect(state.selectedWords).toEqual([]);
    });

    it("should work when no words are selected", () => {
      clearSelection();

      const state = getGameState();
      expect(state.selectedWords).toEqual([]);
    });
  });

  describe("addSolvedCategory", () => {
    it("should add a category to solved categories", () => {
      const category = {
        group: "TEST GROUP",
        members: ["WORD1", "WORD2", "WORD3", "WORD4"],
        difficulty: 0
      };

      addSolvedCategory(category);

      const state = getGameState();
      expect(state.solvedCategories).toHaveLength(1);
      expect(state.solvedCategories[0]).toEqual(category);
    });

    it("should add multiple categories", () => {
      const cat1 = { group: "CAT1", members: ["A", "B", "C", "D"], difficulty: 0 };
      const cat2 = { group: "CAT2", members: ["E", "F", "G", "H"], difficulty: 1 };

      addSolvedCategory(cat1);
      addSolvedCategory(cat2);

      const state = getGameState();
      expect(state.solvedCategories).toHaveLength(2);
    });
  });

  describe("incrementMistakes", () => {
    it("should increment the mistake counter", () => {
      incrementMistakes();

      const state = getGameState();
      expect(state.mistakes).toBe(1);
    });

    it("should set game over when max mistakes reached", () => {
      incrementMistakes();
      incrementMistakes();
      incrementMistakes();
      incrementMistakes();

      const state = getGameState();
      expect(state.mistakes).toBe(4);
      expect(state.isGameOver).toBe(true);
    });

    it("should not exceed max mistakes", () => {
      for (let i = 0; i < 10; i++) {
        incrementMistakes();
      }

      const state = getGameState();
      expect(state.mistakes).toBe(10);
      expect(state.isGameOver).toBe(true);
    });
  });

  describe("completeGame", () => {
    it("should mark the game as over", () => {
      completeGame();

      const state = getGameState();
      expect(state.isGameOver).toBe(true);
    });
  });

  describe("game data management", () => {
    const mockGameData = {
      categories: [
        { group: "FRUITS", members: ["APPLE", "ORANGE", "BANANA", "GRAPE"], difficulty: 0 },
        { group: "COLORS", members: ["RED", "BLUE", "GREEN", "YELLOW"], difficulty: 1 }
      ]
    };

    it("should set and get game data", () => {
      setGameData(mockGameData);

      const data = getGameData();
      expect(data).toEqual(mockGameData);
    });

    it("should set and get current date", () => {
      setCurrentDate("2024-10-02");

      const date = getCurrentDate();
      expect(date).toBe("2024-10-02");
    });
  });

  describe("getRemainingWords", () => {
    beforeEach(() => {
      const mockGameData = {
        categories: [
          { group: "FRUITS", members: ["APPLE", "ORANGE", "BANANA", "GRAPE"], difficulty: 0 },
          { group: "COLORS", members: ["RED", "BLUE", "GREEN", "YELLOW"], difficulty: 1 },
          { group: "ANIMALS", members: ["DOG", "CAT", "BIRD", "FISH"], difficulty: 2 },
          { group: "SHAPES", members: ["CIRCLE", "SQUARE", "TRIANGLE", "STAR"], difficulty: 3 }
        ]
      };
      setGameData(mockGameData);
    });

    it("should return all words when nothing is solved", () => {
      const remaining = getRemainingWords();

      expect(remaining).toHaveLength(16);
      expect(remaining).toContain("APPLE");
      expect(remaining).toContain("RED");
      expect(remaining).toContain("DOG");
      expect(remaining).toContain("CIRCLE");
    });

    it("should exclude solved category words", () => {
      addSolvedCategory({
        group: "FRUITS",
        members: ["APPLE", "ORANGE", "BANANA", "GRAPE"],
        difficulty: 0
      });

      const remaining = getRemainingWords();

      expect(remaining).toHaveLength(12);
      expect(remaining).not.toContain("APPLE");
      expect(remaining).not.toContain("ORANGE");
      expect(remaining).toContain("RED");
    });

    it("should preserve category order", () => {
      const remaining = getRemainingWords();

      const fruitIndex = remaining.indexOf("APPLE");
      const colorIndex = remaining.indexOf("RED");
      const animalIndex = remaining.indexOf("DOG");
      const shapeIndex = remaining.indexOf("CIRCLE");

      expect(fruitIndex).toBeLessThan(colorIndex);
      expect(colorIndex).toBeLessThan(animalIndex);
      expect(animalIndex).toBeLessThan(shapeIndex);
    });

    it("should handle multiple solved categories", () => {
      addSolvedCategory({
        group: "FRUITS",
        members: ["APPLE", "ORANGE", "BANANA", "GRAPE"],
        difficulty: 0
      });
      addSolvedCategory({
        group: "COLORS",
        members: ["RED", "BLUE", "GREEN", "YELLOW"],
        difficulty: 1
      });

      const remaining = getRemainingWords();

      expect(remaining).toHaveLength(8);
      expect(remaining).toContain("DOG");
      expect(remaining).toContain("CIRCLE");
    });

    it("should return empty array when all categories solved", () => {
      const gameData = getGameData();
      gameData.categories.forEach((cat) => {
        addSolvedCategory(cat);
      });

      const remaining = getRemainingWords();

      expect(remaining).toHaveLength(0);
    });

    it("should handle missing game data", () => {
      setGameData(null);

      const remaining = getRemainingWords();

      expect(remaining).toEqual([]);
    });
  });
});
