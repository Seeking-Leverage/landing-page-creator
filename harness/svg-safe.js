"use strict";

function fromCodePoint(raw, radix) {
  const code = parseInt(raw, radix);
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
    throw new Error("bad code point");
  }
  if (code >= 0xd800 && code <= 0xdfff) throw new Error("bad code point");
  return String.fromCodePoint(code);
}

function decodeNumericEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCodePoint(hex, 16))
    .replace(/&#(\d+);/g, (_, num) => fromCodePoint(num, 10));
}

function svgIsUnsafe(buf) {
  let text;
  try {
    text = decodeNumericEntities(buf.toString("utf8"));
  } catch {
    return true;
  }
  if (/<\s*script\b/i.test(text)) return true;
  if (/<\s*foreignObject\b/i.test(text)) return true;
  if (/<[a-z][^<>]*\/on[a-z]+\s*=/i.test(text)) return true;
  if (/\son[a-z]+\s*=/i.test(text)) return true;
  if (/javascript\s*:/i.test(text)) return true;
  return false;
}

module.exports = { svgIsUnsafe };
