"use strict";

const dns = require("dns").promises;
const net = require("net");

function isPrivateV4(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  return false;
}

function hexMappedV4(raw) {
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const hex = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return "";
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join(".");
}

function isPrivateIp(ip) {
  const raw = String(ip).toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (net.isIPv4(raw)) return isPrivateV4(raw);
  if (!net.isIPv6(raw)) return false;
  if (raw === "::1" || raw === "::") return true;
  if (raw.startsWith("fc") || raw.startsWith("fd") || raw.startsWith("fe80") || raw.startsWith("ff")) return true;
  if (raw.startsWith("64:ff9b:")) return true;
  if (raw.startsWith("::ffff:")) return true;
  const mapped = hexMappedV4(raw);
  if (mapped) return true;
  return false;
}

function hostLiteral(hostname) {
  const host = String(hostname).toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

function blockedHost(hostname) {
  const host = hostLiteral(hostname);
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  return net.isIP(host) ? isPrivateIp(host) : false;
}

async function lookupPublic(hostname) {
  const host = hostLiteral(hostname);
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("That host is not a public site");
    return [{ address: host, family: net.isIPv4(host) ? 4 : 6 }];
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error("Could not resolve host");
  for (const rec of records) {
    if (isPrivateIp(rec.address)) throw new Error("Host resolves to a private address");
  }
  return records;
}

async function assertPublicHttps(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") throw new Error("Only https URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  if (blockedHost(url.hostname)) throw new Error("That host is not a public site");
  const records = await lookupPublic(url.hostname);
  return { url, records };
}

module.exports = { assertPublicHttps, isPrivateIp, blockedHost, lookupPublic };
