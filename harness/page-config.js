"use strict";

const { pixelConfig } = require("./pixels");

function pageConfig(campaign, env) {
  const thankYou = (campaign && campaign.thankYou) || {};
  const action = (campaign && campaign.primaryAction) || {};
  const delay = thankYou.redirectDelayMs;
  return {
    formEnabled: Boolean(env && env.FORM_ENDPOINT),
    formEndpoint: env && env.FORM_ENDPOINT ? env.FORM_ENDPOINT : "",
    pixels: pixelConfig(env || {}),
    page: {
      slug: (campaign && campaign.slug) || "",
      defaultSource: (campaign && campaign.defaultSource) || "",
      oneLink: (campaign && campaign.oneLink) || action.href || "",
      thankYou: {
        enabled: thankYou.enabled === true,
        redirectDelayMs: Number.isInteger(delay) ? delay : 1500,
      },
    },
  };
}

module.exports = { pageConfig };
