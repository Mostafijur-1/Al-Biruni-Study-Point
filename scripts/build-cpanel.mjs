import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const wasmFlag = "--disable-wasm-trap-handler";
const supportsWasmFlag = process.allowedNodeEnvironmentFlags?.has(wasmFlag);

if (!supportsWasmFlag) {
  console.warn(
    `[cPanel Build Warning] Node ${process.version} does not support ${wasmFlag}. Continuing with standard memory optimizations...`,
  );
}

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const nextCli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

const userNodeOptions = process.env.NODE_OPTIONS || "";
const hasMaxOldSpace = userNodeOptions.includes("--max-old-space-size");

const nodeOptions = [
  userNodeOptions,
  supportsWasmFlag ? wasmFlag : null,
  hasMaxOldSpace ? null : "--max-old-space-size=1024",
]
  .filter(Boolean)
  .join(" ");


console.log("[cPanel Build] Starting Next.js Webpack production build...");
console.log(`[cPanel Build] Node options: ${nodeOptions}`);

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

