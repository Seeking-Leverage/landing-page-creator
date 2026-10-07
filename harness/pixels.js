"use strict";

const PATTERNS = {
  META_PIXEL_ID: /^\d{8,20}$/,
  GOOGLE_ADS_ID: /^AW-\d{6,12}$/,
  GOOGLE_ADS_CONVERSION_LABEL: /^[A-Za-z0-9_-]{1,64}$/,
  GOOGLE_ADS_LEAD_LABEL: /^[A-Za-z0-9_-]{1,64}$/,
  TIKTOK_PIXEL_ID: /^[A-Za-z0-9]{10,32}$/,
};

// https://click.appcast.io/pixels/<file>.js with an optional query, nothing else.
const APPCAST_PIXEL = /^https:\/\/click\.appcast\.io\/pixels\/[A-Za-z0-9._~/-]+\.js(?:\?[A-Za-z0-9._~%=&-]*)?$/;

function pixelError(name, value) {
  if (value == null || String(value).trim() === "") return "";
  const pattern = PATTERNS[name];
  if (!pattern) return "";
  if (!pattern.test(String(value).trim())) return name + " does not match the vendor format";
  return "";
}

function appcastPixelUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (!APPCAST_PIXEL.test(url)) {
    throw new Error("APPCAST_PIXEL_URL must be https://click.appcast.io/pixels/….js");
  }
  return url;
}

function pixelConfig(env) {
  return {
    meta: (env && env.META_PIXEL_ID) || "",
    googleAds: (env && env.GOOGLE_ADS_ID) || "",
    googleLabel: (env && env.GOOGLE_ADS_CONVERSION_LABEL) || "",
    googleLeadLabel: (env && env.GOOGLE_ADS_LEAD_LABEL) || "",
    tiktok: (env && env.TIKTOK_PIXEL_ID) || "",
    tiktokLeadEvent: (env && env.TIKTOK_LEAD_EVENT) || "",
    appcast: appcastPixelUrl(env && env.APPCAST_PIXEL_URL),
  };
}

module.exports = { pixelError, PATTERNS, APPCAST_PIXEL, appcastPixelUrl, pixelConfig };
