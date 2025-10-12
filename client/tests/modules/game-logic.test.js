/**
 * Tests for game logic and validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkCategoryMatch, isOneAway, isGameWon, isGameLost, hasUserPlayed } from "../../modules/game-logic.js";
import { resetGameState, setGameData, addSolvedCategory, updateGameState } from "../../modules/game-state.js";

describe("game-logic", () => {
  const mockGameData = {
    categories: [
      { group: "FRUITS", members: ["APPLE", "ORANGE", "BANANA", "GRAPE"], difficulty: 0 },
      { group: "COLORS", members: ["RED", "BLUE", "GREEN", "YELLOW"], difficulty: 1 },
      { group: "ANIMALS", members: ["DOG", "CAT", "BIRD", "FISH"], difficulty: 2 },
      { group: "SHAPES", members: ["CIRCLE", "SQUARE", "TRIANGLE", "STAR"], difficulty: 3 }
    ]
  };

  beforeEach(() => {
    resetGameState();
    setGameData(mockGameData);
  });

  describe("checkCategoryMatch", () => {
    it("should return category when all words match", () => {
      const result = checkCategoryMatch(["APPLE", "ORANGE", "BANANA", "GRAPE"]);

      expect(result).toBeDefined();
      expect(result.group).toBe("FRUITS");
    });

    it("should return null when words do not match any category", () => {
      const result = checkCategoryMatch(["APPLE", "RED", "DOG", "CIRCLE"]);

      expect(result).toBeUndefined();
    });

    it("should return null when only partial match", () => {
      const result = checkCategoryMatch(["APPLE", "ORANGE", "BANANA", "RED"]);

      expect(result).toBeUndefined();
    });

    it("should ignore already solved categories", () => {
      addSolvedCategory(mockGameData.categories[0]);

      const result = checkCategoryMatch(["APPLE", "ORANGE", "BANANA", "GRAPE"]);

      expect(result).toBeUndefined();
    });

    it("should work regardless of word order", () => {
      const result = checkCategoryMatch(["GRAPE", "APPLE", "BANANA", "ORANGE"]);

      expect(result).toBeDefined();
      expect(result.group).toBe("FRUITS");
    });

    it("should match different categories", () => {
      const result1 = checkCategoryMatch(["RED", "BLUE", "GREEN", "YELLOW"]);
      expect(result1.group).toBe("COLORS");

      const result2 = checkCategoryMatch(["DOG", "CAT", "BIRD", "FISH"]);
      expect(result2.group).toBe("ANIMALS");

      const result3 = checkCategoryMatch(["CIRCLE", "SQUARE", "TRIANGLE", "STAR"]);
      expect(result3.group).toBe("SHAPES");
    });
  });

  describe("isOneAway", () => {
    it("should return true when exactly 3 words match a category", () => {
      const result = isOneAway(["APPLE", "ORANGE", "BANANA", "RED"]);

      expect(result).toBe(true);
    });

    it("should return false when all 4 words match", () => {
      const result = isOneAway(["APPLE", "ORANGE", "BANANA", "GRAPE"]);

      expect(result).toBe(false);
    });

    it("should return false when fewer than 3 words match", () => {
      const result = isOneAway(["APPLE", "ORANGE", "RED", "DOG"]);

      expect(result).toBe(false);
    });

    it("should return false when no words match any category", () => {
      const result = isOneAway(["APPLE", "RED", "DOG", "CIRCLE"]);

      expect(result).toBe(false);
    });

    it("should ignore already solved categories", () => {
      addSolvedCategory(mockGameData.categories[0]);

      const result = isOneAway(["APPLE", "ORANGE", "BANANA", "RED"]);

      expect(result).toBe(false);
    });

    it("should work with different categories", () => {
      expect(isOneAway(["RED", "BLUE", "GREEN", "DOG"])).toBe(true);
      expect(isOneAway(["DOG", "CAT", "BIRD", "CIRCLE"])).toBe(true);
      expect(isOneAway(["CIRCLE", "SQUARE", "TRIANGLE", "APPLE"])).toBe(true);
    });
  });

  describe("isGameWon", () => {
    it("should return false when no categories solved", () => {
      expect(isGameWon()).toBe(false);
    });

    it("should return false when some categories solved", () => {
      addSolvedCategory(mockGameData.categories[0]);
      addSolvedCategory(mockGameData.categories[1]);

      expect(isGameWon()).toBe(false);
    });

    it("should return true when all 4 categories solved", () => {
      mockGameData.categories.forEach((cat) => {
        addSolvedCategory(cat);
      });

      expect(isGameWon()).toBe(true);
    });

    it("should return true when exactly 4 categories solved", () => {
      addSolvedCategory(mockGameData.categories[0]);
      addSolvedCategory(mockGameData.categories[1]);
      addSolvedCategory(mockGameData.categories[2]);
      expect(isGameWon()).toBe(false);

      addSolvedCategory(mockGameData.categories[3]);
      expect(isGameWon()).toBe(true);
    });
  });

  describe("isGameLost", () => {
    it("should return false when no mistakes", () => {
      expect(isGameLost()).toBe(false);
    });

    it("should return false when mistakes below max", () => {
      updateGameState({ mistakes: 3 });

      expect(isGameLost()).toBe(false);
    });

    it("should return true when mistakes equal max (4)", () => {
      updateGameState({ mistakes: 4 });

      expect(isGameLost()).toBe(true);
    });

    it("should return true when mistakes exceed max", () => {
      updateGameState({ mistakes: 5 });

      expect(isGameLost()).toBe(true);
    });
  });

  describe("hasUserPlayed", () => {
    it("should return false when user has not played", () => {
      const serverGameState = {
        players: {}
      };

      expect(hasUserPlayed(serverGameState, "user123")).toBe(false);
    });

    it("should return true when user has played", () => {
      const serverGameState = {
        players: {
          user123: {
            username: "TestUser",
            score: 3,
            mistakes: 2
          }
        }
      };

      expect(hasUserPlayed(serverGameState, "user123")).toBe(true);
    });

    it("should return false when players object is empty", () => {
      const serverGameState = {
        players: {}
      };

      expect(hasUserPlayed(serverGameState, "user123")).toBe(false);
    });

    it("should return false when players object is missing", () => {
      const serverGameState = {};

      expect(hasUserPlayed(serverGameState, "user123")).toBe(false);
    });

    it("should return false for different user", () => {
      const serverGameState = {
        players: {
          user123: { username: "TestUser", score: 3, mistakes: 2 }
        }
      };

      expect(hasUserPlayed(serverGameState, "user456")).toBe(false);
    });

    it("should handle multiple players", () => {
      const serverGameState = {
        players: {
          user123: { username: "User1", score: 4, mistakes: 0 },
          user456: { username: "User2", score: 2, mistakes: 4 },
          user789: { username: "User3", score: 3, mistakes: 1 }
        }
      };

      expect(hasUserPlayed(serverGameState, "user123")).toBe(true);
      expect(hasUserPlayed(serverGameState, "user456")).toBe(true);
      expect(hasUserPlayed(serverGameState, "user789")).toBe(true);
      expect(hasUserPlayed(serverGameState, "user999")).toBe(false);
    });
  });
});
