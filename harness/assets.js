"use strict";

const fs = require("fs");
const path = require("path");

function assertAssetName(name) {
  if (typeof name !== "string" || !/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
    throw new Error("asset name must be a single file name");
  }
}

function resolveAsset(clientDir, name) {
  assertAssetName(name);
  const assets = path.resolve(clientDir, "assets");
  const full = path.resolve(assets, name);
  const rel = path.relative(assets, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("asset escapes the client folder");
  if (!fs.existsSync(full)) throw new Error("missing asset " + name);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new Error("asset cannot be a symlink: " + name);
  if (!stat.isFile()) throw new Error("asset is not a regular file: " + name);
  const realAssets = fs.realpathSync(assets);
  const real = fs.realpathSync(full);
  if (real !== realAssets && !real.startsWith(realAssets + path.sep)) {
    throw new Error("asset escapes the client folder");
  }
  return real;
}

module.exports = { assertAssetName, resolveAsset };
