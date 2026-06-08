import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

manifest.id = "douyin-capture-pro";
manifest.name = "Douyin Capture Pro";
manifest.version = pkg.version;

writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("[postbuild] manifest.json id set to:", manifest.id);
console.log("[postbuild] manifest.json name set to:", manifest.name);
console.log("[postbuild] manifest.json version set to:", manifest.version);
