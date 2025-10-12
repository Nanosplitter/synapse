/**
 * Test setup and global mocks
 */

import { vi } from "vitest";

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("import.meta", () => ({
  env: {
    VITE_DISCORD_CLIENT_ID: "test-client-id"
  }
}));
