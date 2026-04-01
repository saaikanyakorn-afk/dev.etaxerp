import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PUSH_HOUR_TH = 3;
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const VERSION_FILE = path.join(process.cwd(), "VERSION");

function getThaiHour(): number {
  const now = new Date();
  const thaiOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const thaiMinutes = (utcMinutes + thaiOffset) % (24 * 60);
  return Math.floor(thaiMinutes / 60);
}

function readVersion(): string {
  try {
    return fs.readFileSync(VERSION_FILE, "utf-8").trim();
  } catch {
    return "1.0.0";
  }
}

function bumpVersion(): string {
  const current = readVersion();
  const parts = current.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  const next = parts.join(".");
  fs.writeFileSync(VERSION_FILE, next + "\n");
  return next;
}

let lastPushDate = "";

function getAuthRemoteUrl(): string | null {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return null;
  return `https://saaikanyakorn-afk:${pat}@github.com/saaikanyakorn-afk/etaxcenter.git`;
}

function pushToGitHub(): boolean {
  const today = new Date().toISOString().split("T")[0];
  if (lastPushDate === today) return false;

  const authUrl = getAuthRemoteUrl();
  if (!authUrl) {
    console.error("[GitHub Auto-Push] GITHUB_PAT not set — skipping push");
    return false;
  }

  try {
    const cwd = process.cwd();
    const newVersion = bumpVersion();
    const tag = `v${newVersion}`;
    const commitMsg = `${tag} — Auto-push ${today}`;

    execSync("git checkout --orphan deploy-temp", { cwd, stdio: "pipe" });
    execSync("git add -A", { cwd, stdio: "pipe" });
    execSync(`git commit -m "${commitMsg}"`, { cwd, stdio: "pipe" });
    execSync(`git tag -f ${tag}`, { cwd, stdio: "pipe" });
    execSync(`git push ${authUrl} deploy-temp:main --force`, { cwd, stdio: "pipe", timeout: 120000 });
    execSync(`git push ${authUrl} ${tag} --force`, { cwd, stdio: "pipe", timeout: 30000 });
    execSync("git checkout replit-agent", { cwd, stdio: "pipe" });
    execSync("git branch -D deploy-temp", { cwd, stdio: "pipe" });
    lastPushDate = today;
    console.log(`[GitHub Auto-Push] ✓ ${tag} pushed (${today})`);
    return true;
  } catch (err: any) {
    try { execSync("git checkout replit-agent", { cwd: process.cwd(), stdio: "pipe" }); } catch {}
    try { execSync("git branch -D deploy-temp", { cwd: process.cwd(), stdio: "pipe" }); } catch {}
    console.error(`[GitHub Auto-Push] Failed:`, err.message);
    return false;
  }
}

export function startGitHubPushScheduler() {
  const ver = readVersion();
  console.log(`[GitHub Auto-Push] Scheduler started — current ${ver}, pushes daily at ${PUSH_HOUR_TH}:00 TH`);

  setInterval(() => {
    const thaiHour = getThaiHour();
    if (thaiHour === PUSH_HOUR_TH) {
      pushToGitHub();
    }
  }, CHECK_INTERVAL_MS);
}
