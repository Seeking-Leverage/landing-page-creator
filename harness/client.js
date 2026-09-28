(function () {
  "use strict";

  var cfg = window.__HARNESS__ || {};
  var params = new URLSearchParams(window.location.search);
  var TRACK = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ttclid"];

  function fillHidden() {
    TRACK.forEach(function (key) {
      var nodes = document.querySelectorAll('input[name="' + key + '"]');
      var val = params.get(key) || "";
      nodes.forEach(function (n) {
        n.value = val;
      });
    });
  }

  function loadScript(src) {
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  function initPixels() {
    if (!cfg.pixels) return;
    if (cfg.pixels.meta) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
      }(window, document);
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", cfg.pixels.meta);
      window.fbq("track", "PageView");
    }
    if (cfg.pixels.googleAds) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", cfg.pixels.googleAds);
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.pixels.googleAds));
    }
    if (cfg.pixels.tiktok) {
      !(function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
        ttq.setAndDefer = function (obj, method) {
          obj[method] = function () {
            obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (id) {
          ttq._i = ttq._i || {};
          ttq._i[id] = [];
          ttq._t = ttq._t || {};
          ttq._t[id] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[id] = {};
          var src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + encodeURIComponent(id) + "&lib=" + t;
          loadScript(src);
        };
        ttq.load(cfg.pixels.tiktok);
        ttq.page();
      })(window, document, "ttq");
    }
  }

  function trackLead() {
    if (window.fbq) window.fbq("track", "Lead");
    var ads = cfg.pixels && cfg.pixels.googleAds;
    var label = cfg.pixels && (cfg.pixels.googleLeadLabel || cfg.pixels.googleLabel);
    if (window.gtag && ads && label) {
      window.gtag("event", "conversion", { send_to: ads + "/" + label });
    }
    if (window.ttq) window.ttq.track((cfg.pixels && cfg.pixels.tiktokLeadEvent) || "Lead");
  }

  function payloadFromForm(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = String(value);
    });
    return data;
  }

  function onSubmit(e) {
    var form = e.target;
    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      if (typeof form.reportValidity === "function") form.reportValidity();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    var form = e.target;
    var status = document.getElementById("form-status");
    var data = payloadFromForm(form);
    if (data.website) {
      document.body.classList.add("is-thanks");
      return;
    }
    if (!cfg.formEnabled || !cfg.formEndpoint) {
      if (status) status.textContent = "Form endpoint is not configured. Set FORM_ENDPOINT in .env.";
      return;
    }
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (status) status.textContent = "Sending…";
    fetch(cfg.formEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
      mode: "cors",
      credentials: "omit",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        document.body.classList.add("is-thanks");
        trackLead();
      })
      .catch(function () {
        if (status) status.textContent = "Could not send. Try again.";
      });
  }

  fillHidden();
  initPixels();
  var form = document.getElementById("lead-form");
  if (form) form.addEventListener("submit", onSubmit);
})();
