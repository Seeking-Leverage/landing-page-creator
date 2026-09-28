"use strict";

const https = require("https");
const { assertPublicHttps, isPrivateIp } = require("./public-url");

const UA = "SeekingLeverageLandingCreator/0.1 (+https://github.com/Seeking-Leverage/landing-page-creator)";

function requestOnce(url, records, accept, maxBytes, timeout) {
  const pinned = records[0];
  if (!pinned || isPrivateIp(pinned.address)) {
    return Promise.reject(new Error("That host is not a public site"));
  }
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        servername: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Host: url.host,
          Accept: accept || "*/*",
          "User-Agent": UA,
        },
        timeout,
        lookup(_hostname, _options, cb) {
          if (isPrivateIp(pinned.address)) {
            cb(new Error("That host is not a public site"));
            return;
          }
          cb(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new Error("response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buf: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchPublic(raw, accept, maxBytes) {
  const limit = maxBytes || 1500000;
  let current = await assertPublicHttps(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await requestOnce(current.url, current.records, accept, limit, 8000);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.location;
      if (!loc) throw new Error("Redirect with no location");
      current = await assertPublicHttps(new URL(loc, current.url).href);
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error("Fetch failed: HTTP " + res.status);
    return { url: current.url, buf: res.buf, type: res.headers["content-type"] || "" };
  }
  throw new Error("Too many redirects");
}

module.exports = { fetchPublic };
