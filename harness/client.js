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
    if (cfg.pixels && cfg.pixels.meta) {
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
  }

  function trackLead() {
    if (window.fbq) window.fbq("track", "Lead");
  }

  function payloadFromForm(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = String(value);
    });
    return data;
  }

  function onSubmit(e) {
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
