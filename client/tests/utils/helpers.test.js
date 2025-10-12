/**
 * Tests for utility helper functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { escapeHtml, showMessage, wait } from "../../utils/helpers.js";

describe("helpers", () => {
  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it("should escape quotes", () => {
      expect(escapeHtml('"hello"')).toBe('"hello"');
    });

    it("should escape ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("should handle plain text without changes", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });

    it("should handle empty strings", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("should handle special characters", () => {
      expect(escapeHtml("Price: $50 < $100")).toContain("&lt;");
    });
  });

  describe("showMessage", () => {
    let messageDiv;

    beforeEach(() => {
      document.body.innerHTML = '<div id="message"></div>';
      messageDiv = document.getElementById("message");
    });

    afterEach(() => {
      document.body.innerHTML = "";
      vi.clearAllTimers();
    });

    it("should display a message", () => {
      showMessage("Test message", "info");

      expect(messageDiv.innerHTML).toContain("Test message");
      expect(messageDiv.innerHTML).toContain('class="message info"');
    });

    it("should display success messages", () => {
      showMessage("Success!", "success");

      expect(messageDiv.innerHTML).toContain("Success!");
      expect(messageDiv.innerHTML).toContain('class="message success"');
    });

    it("should display error messages", () => {
      showMessage("Error occurred", "error");

      expect(messageDiv.innerHTML).toContain("Error occurred");
      expect(messageDiv.innerHTML).toContain('class="message error"');
    });

    it("should clear message after default duration", async () => {
      vi.useFakeTimers();

      showMessage("Temporary message", "info");
      expect(messageDiv.innerHTML).toContain("Temporary message");

      vi.advanceTimersByTime(2000);

      expect(messageDiv.innerHTML).toBe("");

      vi.useRealTimers();
    });

    it("should clear message after custom duration", async () => {
      vi.useFakeTimers();

      showMessage("Quick message", "info", 500);
      expect(messageDiv.innerHTML).toContain("Quick message");

      vi.advanceTimersByTime(500);

      expect(messageDiv.innerHTML).toBe("");

      vi.useRealTimers();
    });

    it("should handle missing message div gracefully", () => {
      document.body.innerHTML = "";

      expect(() => showMessage("Test", "info")).not.toThrow();
    });

    it("should escape HTML in messages", () => {
      showMessage('<script>alert("xss")</script>', "info");

      expect(messageDiv.innerHTML).toContain("&lt;script&gt;");
      expect(messageDiv.innerHTML).not.toContain("<script>");
    });
  });

  describe("wait", () => {
    it("should wait for the specified duration", async () => {
      vi.useFakeTimers();

      const promise = wait(1000);

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1000);

      await promise;
      expect(resolved).toBe(true);

      vi.useRealTimers();
    });

    it("should work with different durations", async () => {
      vi.useFakeTimers();

      const start = Date.now();
      const promise = wait(500);

      vi.advanceTimersByTime(500);
      await promise;

      vi.useRealTimers();
    });

    it("should resolve with undefined", async () => {
      vi.useFakeTimers();

      const promise = wait(100);
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBeUndefined();

      vi.useRealTimers();
    });
  });
});
