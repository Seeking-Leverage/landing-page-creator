"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { escapeHtml } = require("../harness/escape");
const { contrast } = require("../harness/contrast");
const { parseSafeHttpUrl } = require("../harness/urls");
const { blockedHost, isPrivateIp } = require("../harness/public-url");
const { validate } = require("../harness/schema");
const { resolveAsset } = require("../harness/assets");
const { buildCsp, originOf } = require("../harness/csp");
const { pixelError } = require("../harness/pixels");
const { inlineJson } = require("../harness/inline-json");
const { qaSafeEnv } = require("../harness/qa-env");
const { svgIsUnsafe } = require("../harness/svg-safe");
const { render } = require("../harness/render");

const root = path.join(__dirname, "..");

test("escape and contrast", () => {
  const amp = String.fromCharCode(38);
  assert.equal(escapeHtml("a<b"), "a" + amp + "lt;b");
  assert.equal(escapeHtml("a" + amp + "b"), "a" + amp + "amp;b");
  assert.ok(contrast("#111111", "#ffffff") > 4.5);
  assert.ok(contrast("#111111", "#222222") < 4.5);
});

test("urls allow localhost only when asked", () => {
  assert.equal(parseSafeHttpUrl("https://example.com/a").hostname, "example.com");
  assert.throws(() => parseSafeHttpUrl("http://localhost:9/lead"));
  assert.equal(parseSafeHttpUrl("http://localhost:9/lead", { allowLocalhost: true }).hostname, "localhost");
});

test("private and bracketed addresses are blocked before DNS", async () => {
  assert.equal(blockedHost("[::1]"), true);
  assert.equal(blockedHost("[::ffff:7f00:1]"), true);
  assert.equal(blockedHost("[64:ff9b::a00:1]"), true);
  assert.equal(blockedHost("224.0.0.1"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
  const { assertPublicHttps } = require("../harness/public-url");
  await assert.rejects(assertPublicHttps("https://[::1]/"), /not a public site/);
});

test("schemas reject unknown keys and bad enums", () => {
  const brand = JSON.parse(fs.readFileSync(path.join(root, "clients/_example/brand.json"), "utf8"));
  const campaign = JSON.parse(fs.readFileSync(path.join(root, "clients/_example/campaign.json"), "utf8"));
  const brandSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas/brand.schema.json"), "utf8"));
  const campaignSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas/campaign.schema.json"), "utf8"));
  assert.deepEqual(validate(brand, brandSchema, "brand.json"), []);
  assert.deepEqual(validate(campaign, campaignSchema, "campaign.json"), []);
  const bad = Object.assign({}, brand, { extra: true });
  assert.ok(validate(bad, brandSchema, "brand.json").some((e) => e.includes("extra")));
  const long = Object.assign({}, campaign, { headline: "x".repeat(200) });
  assert.ok(validate(long, campaignSchema, "campaign.json").some((e) => e.includes("too long")));
  const type = JSON.parse(JSON.stringify(campaign));
  type.primaryAction.type = "popup";
  assert.ok(validate(type, campaignSchema, "campaign.json").some((e) => e.includes("must be one of")));
});

test("asset names cannot escape the client folder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "assets", "logo.svg"), "<svg></svg>");
  fs.symlinkSync(path.join(dir, "assets", "logo.svg"), path.join(dir, "assets", "link.svg"));
  assert.ok(resolveAsset(dir, "logo.svg").endsWith("logo.svg"));
  assert.throws(() => resolveAsset(dir, "../brand.json"));
  assert.throws(() => resolveAsset(dir, "a/b.svg"));
  assert.throws(() => resolveAsset(dir, "link.svg"));
});

test("CSP uses only the endpoint origin and only the vendors that are on", () => {
  const bare = buildCsp({});
  assert.equal(bare.includes("facebook"), false);
  assert.equal(bare.includes("google"), false);
  assert.equal(bare.includes("tiktok"), false);
  const injected = buildCsp({ formOrigin: originOf("https://api.example.com/lead;script-src *") });
  assert.match(injected, /connect-src 'self' https:\/\/api\.example\.com/);
  assert.equal(injected.includes("script-src *"), false);
  const all = buildCsp({ meta: true, google: true, tiktok: true });
  assert.match(all, /connect\.facebook\.net/);
  assert.match(all, /googleads\.g\.doubleclick\.net/);
  assert.match(all, /analytics\.tiktok\.com/);
});

test("pixel ids and inline script escaping", () => {
  assert.equal(pixelError("META_PIXEL_ID", "1570763517329516"), "");
  assert.match(pixelError("META_PIXEL_ID", "1</script><script>alert(1)</script>"), /vendor format/);
  assert.equal(pixelError("GOOGLE_ADS_ID", "AW-123456789"), "");
  assert.match(pixelError("GOOGLE_ADS_ID", "G-123"), /vendor format/);
  const html = inlineJson({ id: "</script><script>alert(1)</script>" });
  assert.equal(html.includes("</script>"), false);
});

test("QA render does not keep the form endpoint or pixel ids", () => {
  const brand = JSON.parse(fs.readFileSync(path.join(root, "clients/_example/brand.json"), "utf8"));
  const campaign = JSON.parse(fs.readFileSync(path.join(root, "clients/_example/campaign.json"), "utf8"));
  const html = render({
    brand,
    campaign,
    env: qaSafeEnv({
      FORM_ENDPOINT: "https://crm.example/lead",
      META_PIXEL_ID: "1570763517329516",
      GOOGLE_ADS_ID: "AW-123456789",
      TIKTOK_PIXEL_ID: "C9ABCDEFGHIJKLMNOP",
    }),
    assetPrefix: "",
  });
  assert.equal(html.includes("crm.example"), false);
  assert.equal(html.includes("1570763517329516"), false);
  assert.equal(html.includes("connect.facebook.net"), false);
  assert.equal(html.includes('"formEndpoint":""'), true);
});

test("scriptable SVG logos are refused", () => {
  assert.equal(svgIsUnsafe(Buffer.from('<svg onload="alert(1)"></svg>')), true);
  assert.equal(svgIsUnsafe(Buffer.from("<svg/onload=alert(1)>")), true);
  assert.equal(svgIsUnsafe(Buffer.from("<svg><script>alert(1)</script></svg>")), true);
  assert.equal(svgIsUnsafe(Buffer.from("<svg>&#x110000;</svg>")), true);
  assert.equal(svgIsUnsafe(Buffer.from("<svg><path d='M0 0'/></svg>")), false);
});

test("QA env drops the form endpoint and Appcast with the other pixels", () => {
  const safe = qaSafeEnv({
    CLIENT: "acme",
    FORM_ENDPOINT: "https://crm.example/lead",
    META_PIXEL_ID: "1570763517329516",
    GOOGLE_ADS_ID: "AW-123456789",
    TIKTOK_PIXEL_ID: "C9ABCDEFGHIJKLMNOP",
    APPCAST_PIXEL_URL: "https://click.appcast.io/pixels/generic3-29483.js",
  });
  assert.equal(safe.CLIENT, "acme");
  assert.equal(safe.FORM_ENDPOINT, "");
  assert.equal(safe.META_PIXEL_ID, "");
  assert.equal(safe.GOOGLE_ADS_ID, "");
  assert.equal(safe.TIKTOK_PIXEL_ID, "");
  assert.equal(safe.APPCAST_PIXEL_URL, "");
});

test("a lead fires once after a 2xx and not for an empty or honeypot submit", async () => {
  const script = fs.readFileSync(path.join(root, "harness/client.js"), "utf8");

  function submit(cfg, opts) {
    const state = { handler: null };
    const button = { disabled: false };
    const form = {
      checkValidity() {
        return opts.valid !== false;
      },
      reportValidity() {},
      querySelector(sel) {
        return sel === 'button[type="submit"]' ? button : null;
      },
      addEventListener(_type, fn) {
        state.handler = fn;
      },
    };
    const status = { textContent: "" };
    const document = {
      body: { classList: { add() {}, contains() { return false; } } },
      head: { appendChild() {} },
      getElementById(id) {
        if (id === "lead-form") return form;
        if (id === "form-status") return status;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return {};
      },
      getElementsByTagName() {
        return [{ parentNode: { insertBefore() {} } }];
      },
    };
    const posts = [];
    const leads = [];
    const sandbox = {
      window: { __HARNESS__: cfg, location: { search: "" } },
      document,
      URLSearchParams,
      console,
      FormData: class {
        forEach(cb) {
          cb(opts.honeypot || "", "website");
        }
      },
      fetch: async (url) => {
        posts.push(url);
        return { ok: opts.ok !== false, status: opts.ok === false ? 500 : 200 };
      },
    };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox);
    sandbox.window.fbq = function (cmd, name) {
      if (cmd === "track" && name === "Lead") leads.push("meta");
    };
    if (sandbox.window.gtag) {
      const gtag = sandbox.window.gtag;
      sandbox.window.gtag = function () {
        if (arguments[0] === "event") leads.push("google");
        return gtag.apply(this, arguments);
      };
    }
    if (sandbox.window.ttq) {
      sandbox.window.ttq.track = function () {
        leads.push("tiktok");
      };
    }
    const event = { preventDefault() {}, target: form };
    state.handler(event);
    if (opts.twice) state.handler(event);
    return { posts, leads, status, button };
  }

  const cfg = {
    formEnabled: true,
    formEndpoint: "https://crm.example/lead",
    pixels: {
      meta: "1570763517329516",
      googleAds: "AW-123456789",
      googleLabel: "leadLabel",
      tiktok: "C9ABCDEFGHIJKLMNOP",
    },
  };
  const ok = submit(cfg, { valid: true, twice: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(ok.posts, ["https://crm.example/lead"]);
  assert.equal(ok.button.disabled, true);
  assert.deepEqual(ok.leads.sort(), ["google", "meta", "tiktok"]);

  const empty = submit(cfg, { valid: false });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(empty.posts, []);

  const honey = submit(cfg, { valid: true, honeypot: "http://spam.example" });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(honey.posts, []);

  const fail = submit(cfg, { valid: true, ok: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(fail.leads, []);
});
