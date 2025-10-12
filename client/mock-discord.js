export class MockDiscordSDK {
  constructor(clientId) {
    this.clientId = clientId;
    this.channelId = "mock-channel-123";
    this.guildId = "mock-guild-456";

    this.commands = {
      authorize: async (config) => {
        console.log("[Mock Discord] Authorize called with:", config);
        return { code: "mock-auth-code-12345" };
      },

      authenticate: async (config) => {
        console.log("[Mock Discord] Authenticate called with:", config);
        return {
          access_token: config.access_token,
          user: {
            id: "mock-user-" + Math.random().toString(36).substr(2, 9),
            username: "TestUser" + Math.floor(Math.random() * 1000),
            discriminator: "0001",
            avatar: null,
            public_flags: 0
          },
          scopes: ["identify", "guilds"],
          expires: Date.now() + 604800000,
          application: {
            id: this.clientId,
            name: "Synapse Game"
          }
        };
      },

      getChannel: async (config) => {
        console.log("[Mock Discord] Get channel called");
        return {
          id: this.channelId,
          type: 2, // Voice channel
          name: "Mock Voice Channel"
        };
      }
    };
  }

  async ready() {
    console.log("[Mock Discord] SDK Ready");
    return Promise.resolve();
  }
}

export async function mockTokenEndpoint(code) {
  console.log("[Mock Server] Token endpoint called with code:", code);

  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    access_token: "mock-access-token-" + Math.random().toString(36).substr(2, 16),
    token_type: "Bearer",
    expires_in: 604800,
    refresh_token: "mock-refresh-token",
    scope: "identify guilds"
  };
}
