import type { NextConfig } from "next";
import { exec } from "child_process";
import path from "path";

// Automatically start the Design.MD live compiler in development mode
if (process.env.NODE_ENV === "development") {
  console.log("🚀 Starting Design.MD live compiler...");
  const scriptPath = path.join(process.cwd(), "scripts", "sync-design.js");
  const watchProcess = exec(`node "${scriptPath}" --watch`);
  
  watchProcess.stdout?.on("data", (data) => {
    console.log(`[Design-Sync] ${data.trim()}`);
  });
  
  watchProcess.stderr?.on("data", (data) => {
    console.error(`[Design-Sync-Error] ${data.trim()}`);
  });
  
  process.on("exit", () => {
    watchProcess.kill();
  });
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
