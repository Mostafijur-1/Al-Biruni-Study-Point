import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "deploy-cpanel");
const zipFile = path.join(projectRoot, "cpanel-deploy.zip");

console.log("==================================================");
console.log(" Packaging ABSP for cPanel (domain: abspoint.top)");
console.log("==================================================");

const skipBuild = process.argv.includes("--no-build");

// 1. Run cPanel build
if (!skipBuild) {
  console.log("\n[1/4] Running production build for cPanel...");
  execSync("npm run build:cpanel", {
    cwd: projectRoot,
    stdio: "inherit",
  });
} else {
  console.log("\n[1/4] Skipping build (--no-build flag detected)...");
}

// 2. Prepare deploy directory
console.log("\n[2/4] Preparing deploy directory...");
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

// 3. Copy essential files
console.log("\n[3/4] Copying deployment files...");
const filesToCopy = [
  "app.js",
  ".cpanel.yml",
  "package.json",
  "package-lock.json",
  ".env.cpanel.example",
];

for (const file of filesToCopy) {
  const src = path.join(projectRoot, file);
  const dest = path.join(outputDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.warn(`  ! File not found: ${file}`);
  }
}

// Copy public folder
function copyDirSync(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("  ✓ Copying public folder...");
copyDirSync(path.join(projectRoot, "public"), path.join(outputDir, "public"));

console.log("  ✓ Copying .next production files (excluding dev/cache/trace)...");
const ignoredNextEntries = new Set([
  "cache",
  "dev",
  "diagnostics",
  "trace",
  "trace-build",
]);

function copyNextDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredNextEntries.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyNextDir(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        console.warn(`  ! Skipping ${entry.name}: ${err.message}`);
      }
    }
  }
}
copyNextDir(path.join(projectRoot, ".next"), path.join(outputDir, ".next"));


// 4. Create ZIP archive
console.log("\n[4/4] Creating cpanel-deploy.zip...");
if (fs.existsSync(zipFile)) {
  fs.rmSync(zipFile, { force: true });
}

try {
  if (process.platform === "win32") {
    execSync(
      `tar.exe -a -c -f "${zipFile}" -C "${outputDir}" .`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`cd "${outputDir}" && zip -r "${zipFile}" .`, {
      stdio: "inherit",
    });
  }
  const stats = fs.statSync(zipFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 SUCCESS! Archive created at: cpanel-deploy.zip (${sizeMb} MB)`);
} catch (err) {
  console.warn("  Could not create zip archive automatically:", err.message);
  console.log(`  Files are ready in the folder: ${outputDir}`);
}

console.log("\nReady for deployment on Procloudify / cPanel!");
