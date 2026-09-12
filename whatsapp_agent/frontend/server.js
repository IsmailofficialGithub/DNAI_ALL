import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 5173;

function startDevServer() {
  console.log("No production build found. Starting Vite dev server...");
  const viteArgs = ["vite", "--host", "0.0.0.0", "--port", String(port)];
  const child = spawn("npx", viteArgs, {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

function startProductionServer() {
  const app = express();
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Frontend running at http://localhost:${port}`);
  });
}

if (fs.existsSync(path.join(distPath, "index.html"))) {
  startProductionServer();
} else {
  startDevServer();
}
