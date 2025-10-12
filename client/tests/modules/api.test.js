/**
 * Tests for API communication
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGameData, fetchGameState, saveGameResult } from "../../modules/api.js";

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchGameData", () => {
    it("should fetch and transform game data successfully", async () => {
      const mockResponse = {
        categories: [
          {
            title: "FRUITS",
            cards: [{ content: "APPLE" }, { content: "ORANGE" }, { content: "BANANA" }, { content: "GRAPE" }]
          },
          {
            title: "COLORS",
            cards: [{ content: "RED" }, { content: "BLUE" }, { content: "GREEN" }, { content: "YELLOW" }]
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await fetchGameData("2024-10-02");

      expect(global.fetch).toHaveBeenCalledWith("/api/connections/2024-10-02");
      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        group: "FRUITS",
        members: ["APPLE", "ORANGE", "BANANA", "GRAPE"],
        difficulty: 0
      });
      expect(result.categories[1]).toEqual({
        group: "COLORS",
        members: ["RED", "BLUE", "GREEN", "YELLOW"],
        difficulty: 1
      });
    });

    it("should throw error when fetch fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(fetchGameData("2099-01-01")).rejects.toThrow("Failed to fetch game data for 2099-01-01");
    });

    it("should assign difficulty levels correctly", async () => {
      const mockResponse = {
        categories: [
          { title: "CAT1", cards: [{ content: "A" }, { content: "B" }, { content: "C" }, { content: "D" }] },
          { title: "CAT2", cards: [{ content: "E" }, { content: "F" }, { content: "G" }, { content: "H" }] },
          { title: "CAT3", cards: [{ content: "I" }, { content: "J" }, { content: "K" }, { content: "L" }] },
          { title: "CAT4", cards: [{ content: "M" }, { content: "N" }, { content: "O" }, { content: "P" }] }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await fetchGameData("2024-10-02");

      expect(result.categories[0].difficulty).toBe(0); // Yellow
      expect(result.categories[1].difficulty).toBe(1); // Green
      expect(result.categories[2].difficulty).toBe(2); // Blue
      expect(result.categories[3].difficulty).toBe(3); // Purple
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchGameData("2024-10-02")).rejects.toThrow("Network error");
    });
  });

  describe("fetchGameState", () => {
    it("should fetch game state successfully", async () => {
      const mockState = {
        players: {
          user123: {
            username: "TestUser",
            score: 3,
            mistakes: 1
          }
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockState
      });

      const result = await fetchGameState("guild123", "2024-10-02");

      expect(global.fetch).toHaveBeenCalledWith("/api/gamestate/guild123/2024-10-02");
      expect(result).toEqual(mockState);
    });

    it("should throw error when fetch fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(fetchGameState("guild123", "2024-10-02")).rejects.toThrow("Failed to fetch game state");
    });

    it("should handle empty player list", async () => {
      const mockState = {
        players: {}
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockState
      });

      const result = await fetchGameState("guild123", "2024-10-02");

      expect(result.players).toEqual({});
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(fetchGameState("guild123", "2024-10-02")).rejects.toThrow("Connection refused");
    });
  });

  describe("saveGameResult", () => {
    it("should save game result successfully", async () => {
      const mockResult = {
        userId: "user123",
        username: "TestUser",
        score: 4,
        mistakes: 0
      };

      const mockResponse = {
        success: true,
        message: "Result saved"
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await saveGameResult("guild123", "2024-10-02", mockResult);

      expect(global.fetch).toHaveBeenCalledWith("/api/gamestate/guild123/2024-10-02/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(mockResult)
      });
      expect(result).toEqual(mockResponse);
    });

    it("should throw error when save fails", async () => {
      const mockResult = {
        userId: "user123",
        username: "TestUser",
        score: 2,
        mistakes: 4
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(saveGameResult("guild123", "2024-10-02", mockResult)).rejects.toThrow("Failed to save game result");
    });

    it("should send correct data format", async () => {
      const mockResult = {
        userId: "user456",
        username: "AnotherUser",
        score: 3,
        mistakes: 2
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await saveGameResult("guild456", "2024-10-03", mockResult);

      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[0]).toBe("/api/gamestate/guild456/2024-10-03/complete");

      const body = JSON.parse(fetchCall[1].body);
      expect(body.userId).toBe("user456");
      expect(body.username).toBe("AnotherUser");
      expect(body.score).toBe(3);
      expect(body.mistakes).toBe(2);
    });

    it("should handle network errors", async () => {
      const mockResult = {
        userId: "user123",
        username: "TestUser",
        score: 1,
        mistakes: 3
      };

      global.fetch.mockRejectedValueOnce(new Error("Timeout"));

      await expect(saveGameResult("guild123", "2024-10-02", mockResult)).rejects.toThrow("Timeout");
    });
  });
});
