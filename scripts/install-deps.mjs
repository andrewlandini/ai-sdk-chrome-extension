import { execSync } from "child_process";
execSync("cd /vercel/share/v0-project && pnpm install --no-frozen-lockfile", { stdio: "inherit" });
