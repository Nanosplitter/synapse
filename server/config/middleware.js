export function setupCorsAndSecurity(req, res, next) {
  const allowedOrigins = [
    "https://discord.com",
    "https://canary.discord.com",
    "https://ptb.discord.com",
    "https://connections-3wdu.onrender.com",
    "null"
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.discordapp.com https://static.cloudflareinsights.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https: wss: https://discord.com https://*.discord.com; " +
      "frame-ancestors https://discord.com https://*.discord.com;"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}
