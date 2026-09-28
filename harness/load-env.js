"use strict";

const fs = require("fs");
const path = require("path");

function loadEnv(root) {
  const envPath = path.join(root, ".env");
  const out = { ...process.env };
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (out[key] == null || out[key] === "") out[key] = val;
  }
  return out;
}

module.exports = { loadEnv };
