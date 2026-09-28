"use strict";

function originOf(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("FORM_ENDPOINT must be https in a build");
  return url.origin;
}

function buildCsp(opts) {
  const script = ["'self'", "'unsafe-inline'"];
  const connect = ["'self'"];
  const img = ["'self'", "data:"];
  const frame = [];
  if (opts.meta) {
    script.push("https://connect.facebook.net");
    connect.push("https://www.facebook.com", "https://connect.facebook.net");
  }
  if (opts.google) {
    script.push("https://www.googletagmanager.com", "https://googleads.g.doubleclick.net");
    connect.push("https://www.google.com", "https://www.googleadservices.com", "https://googleads.g.doubleclick.net");
    img.push("https://www.google.com", "https://googleads.g.doubleclick.net");
    frame.push("https://www.googletagmanager.com");
  }
  if (opts.tiktok) {
    script.push("https://analytics.tiktok.com");
    connect.push("https://analytics.tiktok.com", "https://analytics-ipv6.tiktokw.us");
    img.push("https://analytics.tiktok.com", "https://ads.tiktok.com");
    frame.push("https://ads.tiktok.com");
  }
  if (opts.formOrigin) connect.push(opts.formOrigin);
  const parts = [
    "default-src 'self'",
    "img-src " + img.join(" "),
    "style-src 'self' 'unsafe-inline'",
    "script-src " + script.join(" "),
    "connect-src " + connect.join(" "),
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ];
  if (frame.length) parts.push("frame-src " + frame.join(" "));
  return parts.join("; ");
}

module.exports = { buildCsp, originOf };
