"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { render } = require("../harness/render");
const {
  cleanValue,
  readAllowlist,
  mergeAttribution,
  publisherBoard,
  buildOneLink,
  publicSearch,
  thanksPlan,
  isThanksUrl,
} = require("../harness/attribution");

const BASE = "https://hetalretail.onelink.me/sfUI/est2cthl";
const MONSTER = { slug: "onboarding-monster", defaultSource: "monster" };

function paramsOf(href) {
  return new URL(href).searchParams;
}

test("cleans allowlisted values and drops personal data", () => {
  assert.equal(cleanValue("TEST123"), "TEST123");
  assert.equal(cleanValue("cleveland%2Doh"), "cleveland-oh");
  assert.equal(cleanValue("a%40b.com"), "");
  assert.equal(cleanValue("person@example.com"), "");
  assert.equal(cleanValue("555-123-4567"), "");
  assert.equal(cleanValue("5551234567"), "");
  assert.equal(cleanValue("555.123.4567"), "");
  assert.equal(cleanValue("has space"), "");
  assert.equal(cleanValue("bad<script>"), "");
  assert.equal(cleanValue("%"), "");
  assert.equal(cleanValue("x".repeat(201)), "x".repeat(200));
  assert.equal(cleanValue("  TEST123  "), "TEST123");

  const incoming = new URLSearchParams(
    "source=monster&utm_campaign=cleveland-oh&ccuid=TEST123&email=person@example.com&phone=555-123-4567&store=Walmart&foo=bar"
  );
  const kept = readAllowlist(incoming);
  assert.deepEqual(kept, {
    source: "monster",
    utm_campaign: "cleveland-oh",
    ccuid: "TEST123",
  });
});

test("merge keeps a saved ccuid unless the URL has a new one", () => {
  const saved = { ccuid: "TEST123", utm_campaign: "cleveland-oh" };
  assert.equal(mergeAttribution(saved, {}).ccuid, "TEST123");
  assert.equal(mergeAttribution(saved, { ccuid: "NEXT" }).ccuid, "NEXT");
  assert.equal(mergeAttribution(saved, { ccuid: "person@example.com" }).ccuid, "TEST123");
  assert.equal(mergeAttribution(saved, { utm_campaign: "akron-oh" }).utm_campaign, "akron-oh");
  assert.equal(mergeAttribution(saved, { utm_campaign: "akron-oh" }).ccuid, "TEST123");
});

test("exact OneLink for a monster click", () => {
  const attr = {
    source: "monster",
    utm_source: "jobboard",
    utm_medium: "monster",
    utm_campaign: "cleveland-oh",
    ccuid: "TEST123",
  };
  const params = paramsOf(buildOneLink(BASE, attr, MONSTER));
  assert.equal(params.get("pid"), "monster");
  assert.equal(params.get("c"), "cleveland-oh");
  assert.equal(params.get("af_sub1"), "TEST123");
  assert.equal(params.get("af_sub2"), "onboarding-monster");
  assert.equal(params.get("af_sub3"), "ccuid");
  assert.equal(params.get("utm_source"), "jobboard");
  assert.equal(params.get("utm_medium"), "monster");
  assert.equal(params.get("utm_campaign"), "cleveland-oh");
  assert.equal(params.get("email"), null);
  assert.equal(params.get("source"), null);
});

test("gclid fills af_sub1 when ccuid is missing", () => {
  const params = paramsOf(buildOneLink(BASE, { gclid: "G1" }, MONSTER));
  assert.equal(params.get("af_sub1"), "G1");
  assert.equal(params.get("af_sub3"), "gclid");
  assert.equal(params.get("ccuid"), null);
});

test("click id fallback order is ccuid, gclid, fbclid, ttclid", () => {
  const params = paramsOf(
    buildOneLink(BASE, { fbclid: "F1", ttclid: "T1", gclid: "G1", ccuid: "C1" }, MONSTER)
  );
  assert.equal(params.get("af_sub1"), "C1");
  assert.equal(params.get("af_sub3"), "ccuid");
});

test("no params uses the page source and slug and omits af_sub1", () => {
  const params = paramsOf(buildOneLink(BASE, {}, MONSTER));
  assert.equal(params.get("pid"), "monster");
  assert.equal(params.get("c"), "onboarding-monster");
  assert.equal(params.get("af_sub1"), null);
  assert.equal(params.get("af_sub3"), null);
});

test("publisher board is the text before the first hyphen", () => {
  assert.deepEqual(publisherBoard("talroo-cpc_usd"), { board: "talroo", publisher: "talroo-cpc_usd" });
  assert.deepEqual(publisherBoard("adzuna-cpa_usd"), { board: "adzuna", publisher: "adzuna-cpa_usd" });
  assert.deepEqual(publisherBoard("monster-direct-cpc_usd"), { board: "monster", publisher: "monster-direct-cpc_usd" });
  assert.equal(publisherBoard(""), null);
  assert.equal(publisherBoard(undefined), null);
  assert.equal(publisherBoard("   "), null);
  assert.equal(publisherBoard("Talroo-cpc_usd"), null);
  assert.equal(publisherBoard("talroo.cpc"), null);
  assert.equal(publisherBoard("talroo cpc"), null);
  assert.equal(publisherBoard("-cpc_usd"), null);
  assert.equal(publisherBoard("person@example.com"), null);
  assert.equal(publisherBoard("555-123-4567"), null);
  assert.equal(publisherBoard("5551234567"), null);
});

test("jobboard OneLink uses the board as pid and the publisher as af_sub4", () => {
  const page = { slug: "onboarding-jobboard", defaultSource: "jobboard", publisherBoard: true };
  const samples = [
    ["talroo-cpc_usd", "talroo"],
    ["adzuna-cpa_usd", "adzuna"],
    ["monster-direct-cpc_usd", "monster"],
  ];
  for (const [medium, board] of samples) {
    const params = paramsOf(buildOneLink(BASE, {
      source: "indeed",
      utm_source: "jobboard",
      utm_medium: medium,
      utm_campaign: "cleveland-oh",
      ccuid: "TEST123",
      email: "person@example.com",
      phone: "555-123-4567",
    }, page));
    assert.equal(params.get("pid"), board, medium);
    assert.equal(params.get("af_sub4"), medium, medium);
    assert.equal(params.get("c"), "cleveland-oh", medium);
    assert.equal(params.get("af_sub1"), "TEST123", medium);
    assert.equal(params.get("af_sub2"), "onboarding-jobboard", medium);
    assert.equal(params.get("af_sub3"), "ccuid", medium);
    assert.equal(params.get("utm_source"), "jobboard", medium);
    assert.equal(params.get("utm_medium"), medium, medium);
    assert.equal(params.get("utm_campaign"), "cleveland-oh", medium);
    assert.equal(params.get("email"), null, medium);
    assert.equal(params.get("phone"), null, medium);
  }

  const missing = paramsOf(buildOneLink(BASE, {
    utm_source: "jobboard",
    utm_campaign: "cleveland-oh",
    ccuid: "TEST123",
  }, page));
  assert.equal(missing.get("pid"), "jobboard");
  assert.equal(missing.get("af_sub4"), null);
  assert.equal(missing.get("utm_medium"), null);
  assert.equal(missing.get("c"), "cleveland-oh");
  assert.equal(missing.get("af_sub1"), "TEST123");
  assert.equal(missing.get("af_sub2"), "onboarding-jobboard");
  assert.equal(missing.get("af_sub3"), "ccuid");

  const bad = paramsOf(buildOneLink(BASE, {
    utm_medium: "Talroo-cpc_usd",
    utm_campaign: "cleveland-oh",
    ccuid: "TEST123",
  }, page));
  assert.equal(bad.get("pid"), "jobboard");
  assert.equal(bad.get("af_sub4"), null);
  assert.equal(bad.get("utm_medium"), null);

  const phone = paramsOf(buildOneLink(BASE, { utm_medium: "555-123-4567", ccuid: "TEST123" }, page));
  assert.equal(phone.get("pid"), "jobboard");
  assert.equal(phone.get("af_sub4"), null);
  assert.equal(phone.get("af_sub1"), "TEST123");
  assert.equal(phone.get("af_sub3"), "ccuid");
});

test("pid prefers source, then utm_medium, then defaultSource, and never ends in _int", () => {
  assert.equal(paramsOf(buildOneLink(BASE, { source: "Monster_int", utm_medium: "other" }, MONSTER)).get("pid"), "monster");
  assert.equal(paramsOf(buildOneLink(BASE, { utm_medium: "Talroo_int" }, MONSTER)).get("pid"), "talroo");
  assert.equal(
    paramsOf(buildOneLink(BASE, {}, { slug: "onboarding-craigslist", defaultSource: "Craigslist_int" })).get("pid"),
    "craigslist"
  );
});

test("listed OneLink params are overwritten and utm params already on the link are kept", () => {
  const base = BASE + "?pid=old&utm_source=preset&af_sub2=old";
  const params = paramsOf(
    buildOneLink(base, { source: "monster", utm_source: "jobboard", utm_campaign: "cleveland-oh", ccuid: "TEST123" }, MONSTER)
  );
  assert.equal(params.get("pid"), "monster");
  assert.equal(params.get("utm_source"), "preset");
  assert.equal(params.get("af_sub2"), "onboarding-monster");
  assert.equal(params.get("c"), "cleveland-oh");
});

test("public URL keeps only the allowlist plus step=thanks", () => {
  const search = publicSearch(
    { source: "craigslist", ccuid: "TEST123", email: "person@example.com", store: "Walmart" },
    true
  );
  const params = new URLSearchParams(search);
  assert.equal(params.get("ccuid"), "TEST123");
  assert.equal(params.get("source"), "craigslist");
  assert.equal(params.get("step"), "thanks");
  assert.equal(params.get("email"), null);
  assert.equal(params.get("store"), null);
});

test("thanks pixel and redirect fire once, only from the download tap", () => {
  assert.deepEqual(thanksPlan("", true), { fire: true, redirect: true, next: "fired" });
  assert.deepEqual(thanksPlan("fired", true), { fire: false, redirect: false, next: "fired" });
  assert.deepEqual(thanksPlan("pending", true), { fire: false, redirect: false, next: "fired" });
  assert.deepEqual(thanksPlan("fired", false), { fire: false, redirect: false, next: "fired" });
  assert.deepEqual(thanksPlan("", false), { fire: false, redirect: false, next: "" });
  assert.equal(thanksPlan("", false).fire, false);
});

test("thanks location is the query or the static path", () => {
  assert.equal(isThanksUrl("https://www.hetalretail.com/h/onboarding-craigslist?ccuid=TEST123&step=thanks"), true);
  assert.equal(isThanksUrl("https://www.hetalretail.com/h/onboarding-craigslist?step=other"), false);
  assert.equal(isThanksUrl("https://lp.example.com/thanks/"), true);
  assert.equal(isThanksUrl("https://lp.example.com/thanks"), true);
  assert.equal(isThanksUrl("https://lp.example.com/indeed/thanks/?ccuid=TEST123"), true);
});

test("renderer hides the earnings card and the old match copy unless the claim is sourced", () => {
  const brand = {
    name: "Hetal",
    colors: { bg: "#EAEAEA", fg: "#26417B", accent: "#26417B", accentFg: "#FFFFFF", muted: "#495E90" },
    logo: { file: "logo.png", alt: "Hetal" },
  };
  const campaign = {
    icp: "Paid per audit",
    headline: "Audit shelves",
    subhead: "On your schedule.",
    hero: { file: "hero.svg", alt: "Shelf" },
    primaryAction: { type: "link", label: "Download the app", href: BASE },
    slug: "onboarding-craigslist",
    defaultSource: "craigslist",
    oneLink: BASE,
    thankYou: { enabled: true, redirectDelayMs: 1500 },
    showEarningsPotential: false,
    flow: {
      stores: ["Walmart"],
      continueLabel: "Continue",
      roleTitle: "The role",
      roles: [{ title: "Task", body: "Film the aisle." }],
      checks: ["I have a phone."],
      matchLabel: "Check",
      matchLines: ["Loading audit details…", "Almost done…", "Next step: download the app to see audits available near you"],
      matchOutcome: "Next step: download the app to see audits available near you",
      payTitle: "Pay",
      pay: [
        { value: "$10", label: "First audit", detail: "Qualifying audit." },
        { value: "$40–$60/hr", label: "Earnings potential", detail: "Experienced analysts." },
      ],
      finalTitle: "Ready",
      finalBody: "Download the app.",
    },
  };
  const html = render({ brand, campaign, env: {}, assetPrefix: "" });
  assert.equal(html.includes("Match found!"), false);
  assert.equal(html.includes("You qualify for immediate onboarding."), false);
  assert.equal(html.includes("$40–$60/hr"), false);
  assert.equal(html.includes("Earnings potential"), false);
  assert.equal(html.includes("$10"), true);
  assert.match(html, /Thanks! Opening the app store/);
  assert.match(html, /Open the app store/);
  assert.match(html, /data-step="thanks"/);
  assert.doesNotMatch(html, /id="pid"|name="jid"|jobId/);

  campaign.showEarningsPotential = true;
  campaign.earningsSource = "2026-10-06 rate card";
  const shown = render({ brand, campaign, env: {}, assetPrefix: "" });
  assert.equal(shown.includes("$40–$60/hr"), true);

  const classic = render({
    brand,
    campaign: {
      icp: "Example",
      headline: "Example",
      subhead: "Example page.",
      hero: { file: "hero.svg", alt: "Hero" },
      primaryAction: { type: "form", label: "Request a walkthrough", fields: [{ name: "email", label: "Work email", type: "email", required: true }] },
    },
    env: {},
    assetPrefix: "",
  });
  assert.equal(classic.includes("data-step=\"thanks\""), false);
  assert.equal(classic.includes("click.appcast.io"), false);
});

test("both Hetal campaigns use the honest copy and their own source", () => {
  const expected = {
    "hetal-retail": {
      slug: "onboarding-craigslist",
      defaultSource: "craigslist",
      oneLink: "https://hetalretail.onelink.me/sfUI/est2cthl",
    },
    "hetal-indeed": {
      slug: "onboarding-indeed",
      defaultSource: "indeed",
      oneLink: "https://hetalretail.onelink.me/sfUI/ivko2j6b",
    },
    "hetal-jobboard": {
      slug: "onboarding-jobboard",
      defaultSource: "jobboard",
      oneLink: "https://hetalretail.onelink.me/sfUI/est2cthl",
      publisherBoard: true,
    },
  };
  const names = Object.keys(expected).filter((name) => {
    return fs.existsSync(path.join(__dirname, "..", "clients", name, "campaign.json"));
  });
  // Hetal client folders are gitignored, so a public checkout has nothing to assert.
  if (names.length === 0) return;
  for (const name of names) {
    const spec = expected[name];
    const file = path.join(__dirname, "..", "clients", name, "campaign.json");
    const campaign = JSON.parse(fs.readFileSync(file, "utf8"));
    const blob = JSON.stringify(campaign);
    assert.equal(blob.includes("Match found!"), false, name);
    assert.equal(blob.includes("You qualify for immediate onboarding."), false, name);
    assert.equal(blob.includes("$40"), false, name);
    assert.equal(blob.includes("Next step: download the app to see audits available near you"), true, name);
    assert.equal(campaign.slug, spec.slug);
    assert.equal(campaign.defaultSource, spec.defaultSource);
    assert.equal(campaign.oneLink, spec.oneLink);
    assert.equal(campaign.primaryAction.href, spec.oneLink);
    assert.equal(campaign.thankYou.enabled, true);
    assert.equal(campaign.showEarningsPotential, false);
    assert.equal(Boolean(campaign.publisherBoard), Boolean(spec.publisherBoard), name);
    assert.equal(blob.includes("Loading audit details…"), true, name);
    assert.equal(blob.includes("Almost done…"), true, name);
    assert.equal(blob.includes("Checking retail coverage in your area..."), false, name);
    assert.equal(blob.includes("Verifying active Brand Analyst openings..."), false, name);
  }
});
