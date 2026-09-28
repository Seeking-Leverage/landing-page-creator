"use strict";

function qaSafeEnv(env) {
  return Object.assign({}, env, {
    FORM_ENDPOINT: "",
    META_PIXEL_ID: "",
    GOOGLE_ADS_ID: "",
    GOOGLE_ADS_CONVERSION_LABEL: "",
    GOOGLE_ADS_LEAD_LABEL: "",
    TIKTOK_PIXEL_ID: "",
    TIKTOK_LEAD_EVENT: "",
  });
}

module.exports = { qaSafeEnv };
