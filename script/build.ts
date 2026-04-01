import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google-cloud/storage",
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

function generateVersionFile() {
  try {
    const shortHash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf-8" }).trim();
    const hash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    const date = execSync('git log -1 --format="%ci"', { encoding: "utf-8" }).trim();
    const message = execSync('git log -1 --format="%s"', { encoding: "utf-8" }).trim();
    return { hash, shortHash, date, message, buildTime: new Date().toISOString() };
  } catch {
    return { hash: "unknown", shortHash: "unknown", date: new Date().toISOString(), message: "", buildTime: new Date().toISOString() };
  }
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("generating version info...");
  const version = generateVersionFile();
  console.log(`  version: ${version.shortHash} (${version.date.slice(0, 10)})`);

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const nativeModules = ["canvas", "sharp", "bcrypt", "better-sqlite3"];

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [...externals, ...nativeModules],
    logLevel: "info",
    loader: { ".node": "empty" },
  });

  console.log("writing version.json...");
  await writeFile("dist/version.json", JSON.stringify(version, null, 2));
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
