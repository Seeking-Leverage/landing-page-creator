"use strict";

const { assertPublicHttps } = require("./public-url");

const MAX_HTML = 1_500_000;
const MAX_CSS = 400_000;
const MAX_HOPS = 3;
const TIMEOUT_MS = 8000;

function parseColor(raw) {
  const s = String(raw).trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) h = h.slice(0, 6);
    return "#" + h.toUpperCase();
  }
  const rgb = s.match(/rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/);
  if (!rgb) return null;
  const parts = rgb.slice(1, 4).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return (
    "#" +
    parts
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function inkOn(hex) {
  return lum(hex) > 0.45 ? "#111111" : "#F7F7F5";
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((shift) => {
    const av = (pa >> shift) & 255;
    const bv = (pb >> shift) & 255;
    return Math.round(av + (bv - av) * t)
      .toString(16)
      .padStart(2, "0");
  });
  return ("#" + ch.join("")).toUpperCase();
}

const ROLE = {
  bg: ["background", "bg", "surface", "canvas", "page"],
  fg: ["foreground", "fg", "text", "ink", "body"],
  accent: ["accent", "primary", "brand", "cta", "action"],
  muted: ["muted", "subtle", "secondary"],
};

function scoreName(name, role) {
  const n = name.toLowerCase();
  let best = 0;
  for (const word of ROLE[role]) {
    if (n === word || n.endsWith("-" + word) || n.endsWith("_" + word)) best = Math.max(best, 3);
    else if (n.includes(word)) best = Math.max(best, 1);
  }
  if (/(image|gradient|shadow|font|radius|space|size)/.test(n)) best = 0;
  return best;
}

function colorsFromCss(css) {
  const found = { bg: [], fg: [], accent: [], muted: [] };
  const re = /--([A-Za-z0-9_-]+)\s*:\s*([^;}{]+)/g;
  let m;
  while ((m = re.exec(css))) {
    const color = parseColor(m[2]);
    if (!color) continue;
    for (const role of Object.keys(found)) {
      const score = scoreName(m[1], role);
      if (score) found[role].push({ color, score });
    }
  }
  const pick = (role) => {
    const list = found[role].sort((a, b) => b.score - a.score);
    return list[0]?.color || null;
  };
  return {
    bg: pick("bg"),
    fg: pick("fg"),
    accent: pick("accent"),
    muted: pick("muted"),
    hits: Object.values(found).reduce((n, list) => n + list.length, 0),
  };
}

function attr(html, tagRe) {
  const m = html.match(tagRe);
  return m ? m[1] : "";
}

function abs(base, href) {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

async function fetchPublic(raw, accept) {
  let current = await assertPublicHttps(raw);
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "SeekingLeverageLandingHarness/0.1 (+https://github.com/Seeking-Leverage/landing-page-harness)",
        Accept: accept,
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect with no location");
      current = await assertPublicHttps(new URL(loc, current).href);
      continue;
    }
    if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    return { url: current, buf, type: res.headers.get("content-type") || "" };
  }
  throw new Error("Too many redirects");
}

function stylesheetHrefs(html, pageUrl) {
  const hrefs = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (!/rel=["'][^"']*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    const url = abs(pageUrl, href[1]);
    if (!url || url.protocol !== "https:" || url.host !== pageUrl.host) continue;
    hrefs.push(url.href);
    if (hrefs.length >= 4) break;
  }
  return hrefs;
}

function logoHref(html, pageUrl) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi,
    /<img\b[^>]*>/gi,
  ];
  const candidates = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      const tag = m[0];
      const href = tag.match(/(?:href|src)=["']([^"']+)["']/i);
      if (!href) continue;
      const url = abs(pageUrl, href[1]);
      if (!url || url.protocol !== "https:" || url.host !== pageUrl.host) continue;
      if (!/\.(svg|png|webp)(\?|$)/i.test(url.pathname)) continue;
      const svg = /\.svg(\?|$)/i.test(url.pathname);
      const inHeader = /<(header|nav)\b/i.test(html.slice(Math.max(0, m.index - 400), m.index));
      candidates.push({ href: url.href, svg, inHeader, icon: /rel=/i.test(tag) });
    }
  }
  candidates.sort((a, b) => Number(b.svg && b.inHeader) - Number(a.svg && a.inHeader) || Number(b.svg) - Number(a.svg) || Number(a.icon) - Number(b.icon));
  return candidates[0]?.href || null;
}

function meta(html, key) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`,
    "i"
  );
  const m = html.match(re);
  return (m && (m[1] || m[2])) || "";
}

async function pullBrand(rawUrl) {
  const page = await fetchPublic(rawUrl, "text/html,application/xhtml+xml");
  if (page.buf.length > MAX_HTML) throw new Error("Page is too large");
  const html = page.buf.toString("utf8");
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  for (const href of stylesheetHrefs(html, page.url)) {
    try {
      const sheet = await fetchPublic(href, "text/css,*/*");
      if (sheet.buf.length > MAX_CSS) continue;
      if (/text\/css|text\/plain|application\/octet-stream/i.test(sheet.type) || sheet.type === "") {
        css += "\n" + sheet.buf.toString("utf8").slice(0, MAX_CSS);
      }
    } catch {
      /* third-party or blocked sheets are skipped */
    }
  }

  const picked = colorsFromCss(css);
  const theme = parseColor(meta(html, "theme-color"));
  const title = attr(html, /<title[^>]*>([^<]{1,120})<\/title>/i).trim();
  const site = meta(html, "og:site_name").trim() || title.split(/[|\-\u2013\u2014]/)[0].trim() || page.url.hostname;
  const privacy = [...html.matchAll(/href=["']([^"']*privacy[^"']*)["']/gi)]
    .map((m) => abs(page.url, m[1]))
    .find((u) => u && u.protocol === "https:");

  const bg = picked.bg || (theme && lum(theme) < 0.2 ? "#0E0F12" : "#F7F6F3");
  const fg = picked.fg || inkOn(bg);
  const accent = picked.accent || theme || (lum(bg) > 0.5 ? "#1F6B4A" : "#C8F54A");
  const muted = picked.muted || mix(fg, bg, 0.45);
  const notes = [];
  if (picked.hits < 2) notes.push("Few design tokens on the page. Colors are a best guess \u2014 check them.");
  if (!picked.accent && theme) notes.push("Accent came from theme-color, not a button style.");
  if (!picked.accent && !theme) notes.push("No accent token found. A placeholder accent was used.");

  return {
    pageUrl: page.url.href,
    brand: {
      name: site.slice(0, 80),
      tagline: "Draft pulled from " + page.url.hostname + ". Replace this.",
      colors: {
        bg,
        fg,
        accent,
        accentFg: inkOn(accent),
        muted,
      },
      logo: { file: "logo.svg", alt: site.slice(0, 80) },
      ...(privacy ? { privacyUrl: privacy.href } : {}),
    },
    logoUrl: logoHref(html, page.url),
    notes,
    confidence: picked.hits >= 2 ? "tokens" : "guess",
  };
}

module.exports = { pullBrand, parseColor };
