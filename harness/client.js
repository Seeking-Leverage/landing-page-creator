(function () {
  "use strict";

  var cfg = window.__HARNESS__ || {};
  var LPC = window.LPCAttribution;
  var params = new URLSearchParams(window.location.search);
  var TRACK = (LPC && LPC.TRACK) || ["source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ccuid", "gclid", "fbclid", "ttclid"];
  var LEGACY_TRACK = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ttclid"];

  function fillHidden() {
    TRACK.forEach(function (key) {
      var nodes = document.querySelectorAll('input[name="' + key + '"]');
      var raw = params.get(key) || "";
      var val = LPC ? LPC.cleanValue(raw) : raw;
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

  function pushEvent(name, extra) {
    if (!window.dataLayer || typeof window.dataLayer.push !== "function") return;
    var payload = { event: name };
    if (extra && extra.step != null) payload.step = extra.step;
    window.dataLayer.push(payload);
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

  function initFlow() {
    if (typeof document.querySelector !== "function") return;
    var root = document.querySelector("[data-flow]");
    if (!root) return;

    var page = cfg.page || {};
    var thanksCfg = page.thankYou || {};
    var thanksOn = Boolean(LPC && thanksCfg.enabled);
    var currentAttr = {};
    var finalUrl = "";
    var redirectTimer = 0;
    var downloadLocked = false;
    var matchGen = 0;

    function readStorage(key) {
      try {
        return sessionStorage.getItem(key) || "";
      } catch (err) {
        return "";
      }
    }

    function writeStorage(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (err) {
        /* Storage can be blocked. The button href still works. */
      }
    }

    function loadAttr() {
      if (!LPC) return;
      var saved = {};
      try {
        saved = JSON.parse(readStorage(LPC.STORAGE_KEY) || "{}") || {};
      } catch (err) {
        saved = {};
      }
      currentAttr = LPC.mergeAttribution(saved, LPC.readAllowlist(params));
      writeStorage(LPC.STORAGE_KEY, JSON.stringify(currentAttr));
    }

    function applyLinks() {
      var outbound = root.querySelector("[data-outbound]");
      var store = root.querySelector("[data-store-link]");
      if (thanksOn) {
        var base = page.oneLink || (outbound ? outbound.getAttribute("href") : "");
        try {
          finalUrl = LPC.buildOneLink(base, currentAttr, page);
        } catch (err) {
          finalUrl = base;
        }
        if (outbound && finalUrl) outbound.href = finalUrl;
        if (store && finalUrl) store.href = finalUrl;
        return;
      }
      if (!outbound) return;
      try {
        var url = new URL(outbound.href, window.location.origin);
        LEGACY_TRACK.forEach(function (key) {
          var val = params.get(key);
          if (val && !url.searchParams.get(key)) url.searchParams.set(key, val);
        });
        outbound.href = url.toString();
      } catch (err) {
        /* Keep the href from the spec when it cannot be parsed. */
      }
    }

    function writeLocation(thanks, mode) {
      if (!thanksOn) return;
      var search = LPC.publicSearch(currentAttr, thanks);
      var path = window.location.pathname;
      var next = path + (search ? "?" + search : "") + window.location.hash;
      var current = path + window.location.search + window.location.hash;
      if (next === current) return;
      try {
        var state = { lpc: thanks ? "thanks" : "land" };
        if (mode === "push") history.pushState(state, "", next);
        else history.replaceState(state, "", next);
      } catch (err) {
        /* The step still shows when history is unavailable. */
      }
    }

    function show(step) {
      if (String(step) === "thanks") matchGen += 1;
      if (String(step) === "4" && LPC) writeStorage(LPC.FLOW_KEY, "1");
      var panels = root.querySelectorAll("[data-step]");
      Array.prototype.forEach.call(panels, function (panel) {
        panel.hidden = panel.getAttribute("data-step") !== String(step);
      });
      var active = root.querySelector('[data-step="' + step + '"]');
      var current = root.querySelector("[data-progress-current]");
      var label = root.querySelector("[data-progress-label]");
      var bar = root.querySelector("[data-progress-bar]");
      if (String(step) === "thanks") {
        if (current) current.textContent = "4";
        if (label) label.textContent = "Thanks";
        if (bar) bar.style.width = "100%";
      } else {
        if (current) current.textContent = String(step);
        if (label && active) label.textContent = active.getAttribute("data-step-label") || "";
        if (bar) bar.style.width = Number(step) * 25 + "%";
      }
      var head = active && active.querySelector("h1, h2");
      var focusTarget = head || active;
      if (focusTarget) {
        if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
        focusTarget.focus();
      }
      window.scrollTo(0, 0);
      if (String(step) === "thanks") pushEvent("lp_thanks_view");
      else pushEvent("lp_step_view", { step: step });
    }

    function syncContinue() {
      var btn = root.querySelector("[data-continue]");
      if (btn) btn.disabled = !root.querySelector('.store[aria-pressed="true"]');
    }

    function syncMatch() {
      var boxes = root.querySelectorAll(".check input");
      var ready = boxes.length > 0 && Array.prototype.every.call(boxes, function (box) {
        return box.checked;
      });
      var btn = root.querySelector("[data-match]");
      if (btn) btn.disabled = !ready;
    }

    function runMatch() {
      var gen = ++matchGen;
      var lines = root.querySelectorAll("[data-match-line]");
      var outcome = root.querySelector("[data-outcome]");
      var index = 0;
      if (outcome) outcome.hidden = true;
      Array.prototype.forEach.call(lines, function (line, idx) {
        line.hidden = idx !== 0;
      });

      function later(fn, ms) {
        setTimeout(function () {
          if (gen !== matchGen) return;
          fn();
        }, ms);
      }

      function frame() {
        Array.prototype.forEach.call(lines, function (line, idx) {
          line.hidden = idx !== index;
        });
        if (index < lines.length - 1) {
          index += 1;
          later(frame, 800);
          return;
        }
        later(function () {
          if (outcome) outcome.hidden = false;
          later(function () {
            show(4);
          }, 1100);
        }, 700);
      }

      frame();
    }

    function loadAppcast() {
      var src = cfg.pixels && cfg.pixels.appcast;
      if (!src || window.__lpcAppcast) return;
      if (src.indexOf("https://click.appcast.io/pixels/") !== 0) return;
      window.__lpcAppcast = true;
      loadScript(src);
    }

    function fireThanks() {
      var delay = thanksCfg.redirectDelayMs;
      if (typeof delay !== "number") delay = 1500;
      redirectTimer = window.setTimeout(function () {
        if (finalUrl) window.location.assign(finalUrl);
      }, delay);
      try {
        loadAppcast();
      } catch (err) {
        /* The redirect timer already started. */
      }
      try {
        trackLead();
      } catch (err2) {
        /* Lead pixels are optional. */
      }
    }

    function openThanks(fromTap) {
      var previous = LPC ? readStorage(LPC.THANKS_KEY) : "";
      var plan = LPC.thanksPlan(previous, fromTap);
      if (plan.next) writeStorage(LPC.THANKS_KEY, plan.next);
      show("thanks");
      writeLocation(true, "push");
      if (plan.fire && plan.redirect) fireThanks();
    }

    root.addEventListener("click", function (event) {
      var store = event.target.closest(".store");
      if (store && root.contains(store)) {
        var pressed = store.getAttribute("aria-pressed") === "true";
        store.setAttribute("aria-pressed", pressed ? "false" : "true");
        syncContinue();
        return;
      }

      var role = event.target.closest(".role");
      if (role && root.contains(role)) {
        var on = role.getAttribute("aria-pressed") === "true";
        role.setAttribute("aria-pressed", on ? "false" : "true");
        return;
      }

      var back = event.target.closest("[data-back]");
      if (back && root.contains(back)) {
        matchGen += 1;
        show(Number(back.getAttribute("data-back")));
        return;
      }

      var cont = event.target.closest("[data-continue]");
      if (cont && root.contains(cont) && !cont.disabled) {
        show(2);
        return;
      }

      var match = event.target.closest("[data-match]");
      if (match && root.contains(match) && !match.disabled) {
        show(3);
        runMatch();
      }
    });

    Array.prototype.forEach.call(root.querySelectorAll(".check input"), function (box) {
      box.addEventListener("change", syncMatch);
    });

    loadAttr();
    applyLinks();

    var outbound = root.querySelector("[data-outbound]");
    if (outbound && thanksOn) {
      outbound.addEventListener("click", function (event) {
        if (readStorage(LPC.FLOW_KEY) !== "1") return;
        event.preventDefault();
        pushEvent("lp_download_tap");
        if (downloadLocked) {
          openThanks(false);
          return;
        }
        downloadLocked = true;
        openThanks(true);
      });
    }

    var openedThanks = thanksOn && LPC.isThanksUrl(window.location.href);
    if (openedThanks) {
      show("thanks");
    } else if (thanksOn) {
      writeLocation(false, "replace");
      pushEvent("lp_step_view", { step: 1 });
    }

    if (!thanksOn) return;

    if (openedThanks) writeLocation(true, "replace");

    window.addEventListener("pagehide", function () {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    });
    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      if (redirectTimer) window.clearTimeout(redirectTimer);
      if (LPC.isThanksUrl(window.location.href)) show("thanks");
    });
    window.addEventListener("popstate", function () {
      if (redirectTimer) window.clearTimeout(redirectTimer);
      if (LPC.isThanksUrl(window.location.href)) show("thanks");
      else show(readStorage(LPC.FLOW_KEY) === "1" ? 4 : 1);
    });
  }

  fillHidden();
  initPixels();
  initFlow();
  var form = document.getElementById("lead-form");
  if (form) form.addEventListener("submit", onSubmit);
})();
