"use strict";

const ALLOWED_DEV = new Set(["http://127.0.0.1", "http://localhost"]);

function parseSafeHttpUrl(raw, { allowLocalhost = false } = {}) {
  if (raw == null || String(raw).trim() === "") return null;
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol === "https:") return url;
  if (
    allowLocalhost &&
    url.protocol === "http:" &&
    ALLOWED_DEV.has(`${url.protocol}//${url.hostname}`)
  ) {
    return url;
  }
  throw new Error(`URL must be https (or localhost in dev): ${raw}`);
}

function isSafeHref(raw, opts) {
  try {
    parseSafeHttpUrl(raw, opts);
    return true;
  } catch {
    return false;
  }
}

module.exports = { parseSafeHttpUrl, isSafeHref };
