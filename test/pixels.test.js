"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { appcastPixelUrl, pixelConfig } = require("../harness/pixels");
const { buildCsp } = require("../harness/csp");
const { pageConfig } = require("../harness/page-config");

const APPCAST = "https://click.appcast.io/pixels/generic3-29483.js?ent=325";

test("Appcast pixel URL must be the click.appcast.io script", () => {
  assert.equal(appcastPixelUrl(""), "");
  assert.equal(appcastPixelUrl("  " + APPCAST + "  "), APPCAST);
  assert.throws(() => appcastPixelUrl("http://click.appcast.io/pixels/generic3-29483.js"), /click\.appcast\.io/);
  assert.throws(() => appcastPixelUrl("https://example.com/pixels/generic3-29483.js"), /click\.appcast\.io/);
  assert.throws(() => appcastPixelUrl("https://click.appcast.io/track.js"), /click\.appcast\.io/);
});

test("pixel config stays blank unless env is set", () => {
  assert.deepEqual(pixelConfig({}), {
    meta: "",
    googleAds: "",
    googleLabel: "",
    googleLeadLabel: "",
    tiktok: "",
    tiktokLeadEvent: "",
    appcast: "",
  });
  assert.equal(pixelConfig({ APPCAST_PIXEL_URL: APPCAST }).appcast, APPCAST);
});

test("CSP gains click.appcast.io only when the pixel is set", () => {
  const plain = buildCsp({});
  assert.equal(plain.includes("click.appcast.io"), false);
  assert.equal(plain.includes("facebook"), false);

  const withPixel = buildCsp({ appcast: true });
  assert.match(withPixel, /script-src [^;]*https:\/\/click\.appcast\.io/);
  assert.match(withPixel, /img-src [^;]*https:\/\/click\.appcast\.io/);
  const connect = withPixel.split(";").find((part) => part.trim().startsWith("connect-src"));
  assert.equal(connect.includes("click.appcast.io"), false);
  assert.equal(withPixel.includes("googletagmanager.com"), false);
});

test("page config carries the thank-you delay and leaves pixels off", () => {
  const cfg = pageConfig(
    {
      slug: "onboarding-craigslist",
      defaultSource: "craigslist",
      oneLink: "https://hetalretail.onelink.me/sfUI/est2cthl",
      thankYou: { enabled: true },
      primaryAction: { href: "https://hetalretail.onelink.me/sfUI/est2cthl" },
    },
    {}
  );
  assert.equal(cfg.page.thankYou.enabled, true);
  assert.equal(cfg.page.thankYou.redirectDelayMs, 1500);
  assert.equal(cfg.pixels.appcast, "");
  assert.equal(cfg.page.slug, "onboarding-craigslist");
});
