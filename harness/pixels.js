"use strict";

const PATTERNS = {
  META_PIXEL_ID: /^\d{8,20}$/,
  GOOGLE_ADS_ID: /^AW-\d{6,12}$/,
  GOOGLE_ADS_CONVERSION_LABEL: /^[A-Za-z0-9_-]{1,64}$/,
  GOOGLE_ADS_LEAD_LABEL: /^[A-Za-z0-9_-]{1,64}$/,
  TIKTOK_PIXEL_ID: /^[A-Za-z0-9]{10,32}$/,
};

function pixelError(name, value) {
  if (value == null || String(value).trim() === "") return "";
  const pattern = PATTERNS[name];
  if (!pattern) return "";
  if (!pattern.test(String(value).trim())) return name + " does not match the vendor format";
  return "";
}

module.exports = { pixelError, PATTERNS };
