import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const wasmFlag = "--disable-wasm-trap-handler";

if (!process.allowedNodeEnvironmentFlags.has(wasmFlag)) {
  console.error(
    `This cPanel build requires Node.js 20.15+ or 22.2+ for ${wasmFlag}.`,
  );
  process.exit(1);
}

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const nextCli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const nodeOptions = [process.env.NODE_OPTIONS, wasmFlag]
  .filter(Boolean)
  .join(" ");

const result = spawnSync(process.execPath, [nextCli, "build", "--webpack"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    NODE_OPTIONS: nodeOptions,
    ABSP_CPANEL_BUILD: "1",
  },
});

if (result.error) {
  console.error("Could not start the cPanel build:", result.error);
}

process.exit(result.status ?? 1);
