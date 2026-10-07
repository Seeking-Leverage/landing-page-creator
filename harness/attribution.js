"use strict";

// Pure helpers for click attribution. Loaded in the browser and required by tests.
// Appcast's pixel reads sessionStorage.jobId, #pid, and input[name=jid]. Never use those names.
(function (root) {
  var TRACK = ["source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ccuid", "gclid", "fbclid", "ttclid"];
  var CLICK_IDS = ["ccuid", "gclid", "fbclid", "ttclid"];
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var STORAGE_KEY = "lpc_attribution";
  var FLOW_KEY = "lpc_flow_done";
  var THANKS_KEY = "lpc_thanks_state";
  var SAFE = /^[A-Za-z0-9._~:-]+$/;
  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

  function decodeOnce(value) {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch (err) {
      return null;
    }
  }

  function looksLikePhone(value) {
    var digits = value.replace(/\D/g, "");
    if (/^\d{3}[-.]\d{3}[-.]\d{4}$/.test(value)) return true;
    if (/^\d{10,11}$/.test(value)) return true;
    if (digits.length >= 10 && digits.length <= 11 && /^[\d.\-]+$/.test(value)) return true;
    return false;
  }

  function cleanValue(raw) {
    if (raw == null) return "";
    var value = String(raw).replace(/^\s+|\s+$/g, "");
    if (!value) return "";
    var decoded = decodeOnce(value);
    if (decoded == null) return "";
    value = decoded.replace(/^\s+|\s+$/g, "");
    if (!value) return "";
    if (value.length > 200) value = value.slice(0, 200);
    if (EMAIL.test(value) || value.indexOf("@") !== -1) return "";
    if (looksLikePhone(value)) return "";
    if (!SAFE.test(value)) return "";
    return value;
  }

  function readAllowlist(searchParams) {
    var out = {};
    var i;
    for (i = 0; i < TRACK.length; i++) {
      var key = TRACK[i];
      var raw = searchParams && searchParams.get ? searchParams.get(key) : searchParams ? searchParams[key] : "";
      var clean = cleanValue(raw);
      if (clean) out[key] = clean;
    }
    return out;
  }

  function mergeAttribution(saved, incoming) {
    var next = {};
    var i;
    for (i = 0; i < TRACK.length; i++) {
      var key = TRACK[i];
      var kept = cleanValue(saved && saved[key]);
      if (kept) next[key] = kept;
    }
    for (i = 0; i < TRACK.length; i++) {
      var name = TRACK[i];
      var fresh = cleanValue(incoming && incoming[name]);
      if (fresh) next[name] = fresh;
    }
    return next;
  }

  function stripInt(value) {
    var pid = String(value || "").toLowerCase();
    if (pid.length >= 4 && pid.slice(-4) === "_int") pid = pid.slice(0, -4);
    return pid;
  }

  function sitePid(attr, defaultSource) {
    var raw = (attr && (attr.source || attr.utm_medium)) || "";
    var pid = stripInt(raw);
    if (!pid) pid = stripInt(defaultSource || "");
    return pid;
  }

  function buildOneLink(base, attr, page) {
    var url = new URL(base);
    var slug = (page && page.slug) || "";
    var defaultSource = (page && page.defaultSource) || "";
    var pid = sitePid(attr || {}, defaultSource);
    var campaign = (attr && attr.utm_campaign) || slug;
    var i;
    if (pid) url.searchParams.set("pid", pid);
    if (campaign) url.searchParams.set("c", campaign);
    var clickName = "";
    var clickId = "";
    for (i = 0; i < CLICK_IDS.length; i++) {
      if (attr && attr[CLICK_IDS[i]]) {
        clickName = CLICK_IDS[i];
        clickId = attr[CLICK_IDS[i]];
        break;
      }
    }
    if (clickId) {
      url.searchParams.set("af_sub1", clickId);
      url.searchParams.set("af_sub3", clickName);
    }
    if (slug) url.searchParams.set("af_sub2", slug);
    for (i = 0; i < UTM.length; i++) {
      var key = UTM[i];
      if (attr && attr[key] && !url.searchParams.get(key)) url.searchParams.set(key, attr[key]);
    }
    return url.toString();
  }

  function publicSearch(attr, thanks) {
    var sp = new URLSearchParams();
    var i;
    for (i = 0; i < TRACK.length; i++) {
      if (attr && attr[TRACK[i]]) sp.set(TRACK[i], attr[TRACK[i]]);
    }
    if (thanks) sp.set("step", "thanks");
    return sp.toString();
  }

  function isThanksUrl(href) {
    var url = new URL(href, "https://example.com");
    if (url.searchParams.get("step") === "thanks") return true;
    return /\/thanks\/?$/.test(url.pathname);
  }

  // previous is "", "pending", or "fired". fromTap is true only for the download
  // click in this document. Reloads, Back, and a direct thanks URL pass false.
  function thanksPlan(previous, fromTap) {
    if (!fromTap) return { fire: false, redirect: false, next: previous || "" };
    if (previous === "fired" || previous === "pending") {
      return { fire: false, redirect: false, next: "fired" };
    }
    return { fire: true, redirect: true, next: "fired" };
  }

  var api = {
    TRACK: TRACK,
    CLICK_IDS: CLICK_IDS,
    STORAGE_KEY: STORAGE_KEY,
    FLOW_KEY: FLOW_KEY,
    THANKS_KEY: THANKS_KEY,
    cleanValue: cleanValue,
    readAllowlist: readAllowlist,
    mergeAttribution: mergeAttribution,
    sitePid: sitePid,
    buildOneLink: buildOneLink,
    publicSearch: publicSearch,
    isThanksUrl: isThanksUrl,
    thanksPlan: thanksPlan,
  };

  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && root.window === root) root.LPCAttribution = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
