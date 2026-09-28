"use strict";

function decodeNumericEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function svgIsUnsafe(buf) {
  const text = decodeNumericEntities(buf.toString("utf8"));
  if (/<\s*script\b/i.test(text)) return true;
  if (/<\s*foreignObject\b/i.test(text)) return true;
  if (/\son[a-z]+\s*=/i.test(text)) return true;
  if (/javascript\s*:/i.test(text)) return true;
  return false;
}

module.exports = { svgIsUnsafe };
