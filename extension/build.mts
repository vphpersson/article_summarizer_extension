import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const distDir = "dist";

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

const commonOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: "browser",
  target: ["firefox128"],
  sourcemap: true,
};

await esbuild.build({
  ...commonOptions,
  entryPoints: ["src/sidebar/sidebar.ts"],
  outfile: path.join(distDir, "sidebar", "sidebar.js"),
  format: "esm",
});

await esbuild.build({
  ...commonOptions,
  entryPoints: ["src/content/extract.ts"],
  outfile: path.join(distDir, "content", "extract.js"),
  format: "iife",
});

await esbuild.build({
  ...commonOptions,
  entryPoints: ["src/content/inject_source.ts"],
  outfile: path.join(distDir, "content", "inject_source.js"),
  format: "iife",
});

await esbuild.build({
  ...commonOptions,
  entryPoints: ["src/background.ts"],
  outfile: path.join(distDir, "background.js"),
  format: "iife",
});

const staticFiles: [string, string][] = [
  ["src/manifest.json", path.join(distDir, "manifest.json")],
  ["src/sidebar/sidebar.html", path.join(distDir, "sidebar", "sidebar.html")],
  ["src/sidebar/sidebar.css", path.join(distDir, "sidebar", "sidebar.css")],
  ["src/icon.svg", path.join(distDir, "icon.svg")],
];

for (const [src, dest] of staticFiles) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

console.log("Build complete.");
