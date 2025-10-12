import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "./config/database.js";
import { setupCorsAndSecurity } from "./config/middleware.js";
import authRoutes from "./routes/auth.js";
import synapseRoutes from "./routes/synapse.js";
import gamestateRoutes from "./routes/gamestate.js";
import sessionsRoutes from "./routes/sessions.js";

dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

initializeDatabase();

app.use(setupCorsAndSecurity);
app.use(express.json());

app.use(authRoutes);
app.use(synapseRoutes);
app.use(gamestateRoutes);
app.use(sessionsRoutes);

const distPath = path.join(__dirname, "../client/dist");
console.log("📁 Serving static files from:", distPath);
console.log("📂 Directory contents:", distPath);

app.use(express.static(distPath));

app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  console.log("📄 Serving index.html from:", indexPath);
  res.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
