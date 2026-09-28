"use strict";

const dns = require("dns").promises;
const net = require("net");

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const n = ip.toLowerCase();
  if (n === "::1" || n === "::") return true;
  if (n.startsWith("fc") || n.startsWith("fd") || n.startsWith("fe80")) return true;
  if (n.startsWith("::ffff:")) return isPrivateIp(n.slice(7));
  return false;
}

function blockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
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
  if (!net.isIP(url.hostname)) {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!records.length) throw new Error("Could not resolve host");
    for (const rec of records) {
      if (isPrivateIp(rec.address)) throw new Error("Host resolves to a private address");
    }
  }
  return url;
}

module.exports = { assertPublicHttps };
