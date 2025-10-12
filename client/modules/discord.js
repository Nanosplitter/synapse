/**
 * Discord SDK setup and authentication
 */

import { DiscordSDK } from "@discord/embedded-app-sdk";
import { MockDiscordSDK, mockTokenEndpoint } from "../mock-discord.js";
import { isLocalMode, DISCORD_CLIENT_ID, API_ENDPOINTS } from "../config.js";

let auth;
let currentUser;
let discordSdk;

/**
 * Initialize the Discord SDK (real or mock)
 * @returns {Object} - Discord SDK instance
 */
export function initializeDiscordSdk() {
  discordSdk = isLocalMode ? new MockDiscordSDK(DISCORD_CLIENT_ID) : new DiscordSDK(DISCORD_CLIENT_ID);

  return discordSdk;
}

/**
 * Set up and authenticate with Discord SDK
 * @returns {Promise<Object>} - Authentication result with user info
 */
export async function setupDiscordSdk() {
  if (!discordSdk) {
    initializeDiscordSdk();
  }

  await discordSdk.ready();
  console.log("Discord SDK is ready");

  console.log("Requesting authorization with client_id:", DISCORD_CLIENT_ID);
  let authResult;
  try {
    authResult = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"]
    });
  } catch (authError) {
    console.error("Authorization failed:", authError);
    throw new Error(`Discord authorization failed: ${authError.message}`);
  }

  const { code } = authResult;
  console.log("Authorization code received:", code ? "YES" : "NO");

  let tokenData;
  if (isLocalMode) {
    tokenData = await mockTokenEndpoint(code);
  } else {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    tokenData = await response.json();
  }

  const { access_token } = tokenData;

  auth = await discordSdk.commands.authenticate({
    access_token
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }

  currentUser = auth.user;
  console.log("Current user:", currentUser);

  return { auth, user: currentUser, sdk: discordSdk };
}

/**
 * Get the current authenticated user
 * @returns {Object} - Current user object
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get the Discord SDK instance
 * @returns {Object} - Discord SDK instance
 */
export function getDiscordSdk() {
  return discordSdk;
}

/**
 * Get the guild ID (or default for local mode)
 * @returns {string} - Guild ID
 */
export function getGuildId() {
  return discordSdk?.guildId || "default";
}

/**
 * Get the channel ID (or default for local mode)
 * @returns {string} - Channel ID
 */
export function getChannelId() {
  return discordSdk?.channelId || "default";
}

/**
 * Get the instance ID if available
 * @returns {string|null} - Instance ID or null
 */
export function getInstanceId() {
  return discordSdk?.instanceId || null;
}
