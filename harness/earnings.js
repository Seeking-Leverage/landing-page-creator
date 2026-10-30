"use strict";

function isEarningsCard(item) {
  if (!item) return false;
  if (/earnings potential/i.test(item.label || "")) return true;
  return /\$40/.test(item.value || "");
}

module.exports = { isEarningsCard };
