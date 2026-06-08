import { readFileSync, writeFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.id = "douyin-capture-pro";
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("[postbuild] manifest.json id set to:", manifest.id);
