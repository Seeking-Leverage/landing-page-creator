"use strict";

const fs = require("fs");
const path = require("path");
const { pullBrand } = require("../harness/brand-from-url");
const { fetchPublic } = require("../harness/fetch-public");
const { svgIsUnsafe } = require("../harness/svg-safe");

const root = path.join(__dirname, "..");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? "" : process.argv[i + 1] || "";
}

function slugFrom(host, override) {
  const raw = (override || host.replace(/^www\./, "")).toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!slug || slug === "_example") throw new Error("Could not make a client folder name. Pass --name acme");
  return slug;
}

function xml(value) {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return String(value)
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot);
}

function monogram(brand) {
  const letters = brand.name
    .split(/\s+/)
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="28" viewBox="0 0 140 28" role="img" aria-label="${xml(brand.logo.alt)}">
  <rect width="28" height="28" rx="6" fill="${brand.colors.accent}"/>
  <text x="14" y="19" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="700" fill="${brand.colors.accentFg}">${xml(letters || "LP")}</text>
  <text x="38" y="19" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="700" fill="${brand.colors.fg}">${xml(brand.name.slice(0, 18))}</text>
</svg>
`;
}

function hero(brand) {
  const c = brand.colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Draft hero">
  <rect width="1200" height="800" fill="${c.bg}"/>
  <rect x="80" y="80" width="1040" height="640" rx="24" fill="${c.fg}" fill-opacity="0.06"/>
  <rect x="120" y="160" width="360" height="28" rx="8" fill="${c.accent}"/>
  <rect x="120" y="220" width="560" height="18" rx="6" fill="${c.muted}"/>
  <rect x="120" y="260" width="460" height="18" rx="6" fill="${c.muted}" fill-opacity="0.7"/>
  <rect x="120" y="330" width="220" height="52" rx="12" fill="${c.accent}"/>
</svg>
`;
}

function campaign(brand, pageUrl) {
  return {
    icp: "Draft — replace with who this ad is for",
    headline: brand.name + ": one page for paid traffic.",
    subhead: "Colors and logo were drafted from " + pageUrl + ". Rewrite the offer before you spend.",
    offer: [
      "Message matches the ad",
      "One action on the page",
      "Brand tokens came from the public site",
    ],
    proof: [{ quote: "Replace this with a real result.", who: "Example" }],
    faq: [
      {
        q: "Is this the finished page?",
        a: "No. It is a draft spec so you can see the brand. Edit campaign.json before launch.",
      },
    ],
    hero: { file: "hero.svg", alt: brand.name + " draft" },
    primaryAction: {
      type: "form",
      label: "Request a walkthrough",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "email", label: "Work email", type: "email", required: true },
      ],
    },
    legal: "Draft page. Do not send paid traffic here yet.",
  };
}

async function maybeLogo(url) {
  if (!url) return null;
  let res;
  try {
    res = await fetchPublic(url, "*/*", 40 * 1024);
  } catch {
    return null;
  }
  const safe = res.url;
  const buf = res.buf;
  if (buf.length > 40 * 1024) return null;
  const type = res.type || "";
  if (/svg/i.test(type) || safe.pathname.endsWith(".svg")) {
    if (svgIsUnsafe(buf)) return null;
    return { file: "logo.svg", buf };
  }
  if (/png/i.test(type) || safe.pathname.endsWith(".png")) return { file: "logo.png", buf };
  return null;
}

async function main() {
  const target = process.argv.slice(2).find((a) => a.startsWith("https://"));
  if (!target) {
    console.error("Usage: npm run brand -- https://client-site.com --name acme");
    process.exit(1);
  }
  const force = process.argv.includes("--force");
  const pulled = await pullBrand(target);
  const host = new URL(pulled.pageUrl).hostname;
  const slug = slugFrom(host, argValue("--name"));
  const dir = path.join(root, "clients", slug);
  if (fs.existsSync(dir) && !force) {
    console.error("clients/" + slug + " already exists. Pass --force to replace the draft.");
    process.exit(1);
  }
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });

  let logoFile = "logo.svg";
  const remote = await maybeLogo(pulled.logoUrl).catch(() => null);
  if (remote) {
    logoFile = remote.file;
    fs.writeFileSync(path.join(dir, "assets", remote.file), remote.buf);
  } else {
    fs.writeFileSync(path.join(dir, "assets", "logo.svg"), monogram(pulled.brand));
  }
  pulled.brand.logo.file = logoFile;
  fs.writeFileSync(path.join(dir, "assets", "hero.svg"), hero(pulled.brand));
  fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify(pulled.brand, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "campaign.json"), JSON.stringify(campaign(pulled.brand, pulled.pageUrl), null, 2) + "\n");

  console.log("draft client: clients/" + slug);
  console.log("confidence: " + pulled.confidence);
  console.log(JSON.stringify(pulled.brand.colors, null, 2));
  for (const note of pulled.notes) console.log("note: " + note);
  console.log("");
  console.log("Try it:");
  console.log("  CLIENT=" + slug + " npm run dev");
}

main().catch((err) => {
  console.error("brand:", err.message);
  process.exit(1);
});
