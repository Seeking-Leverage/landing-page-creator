"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { contrast } = require("../harness/contrast");
const { qaSafeEnv } = require("../harness/qa-env");
const { resolveAsset } = require("../harness/assets");

const root = path.join(__dirname, "..");

function fail(msg) {
  throw new Error(msg);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || "";
}

function rgbToHex(rgb) {
  const m = String(rgb).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return null;
  return (
    "#" +
    m
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.normalize(path.join(dir, rel));
    if (!file.startsWith(dir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function parseFrames(state) {
  const out = [];
  let buf = state.buf;
  while (buf.length >= 2) {
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < 4) break;
      len = buf.readUInt16BE(2);
      off = 4;
    } else if (len === 127) {
      if (buf.length < 10) break;
      len = Number(buf.readBigUInt64BE(2));
      off = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) break;
    let payload = buf.slice(off + maskLen, off + maskLen + len);
    if (masked) {
      const mask = buf.slice(off, off + 4);
      payload = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
    }
    buf = buf.slice(off + maskLen + len);
    if (opcode === 1) out.push(payload.toString("utf8"));
  }
  state.buf = buf;
  return out;
}

function connectCdp(wsUrl) {
  const u = new URL(wsUrl);
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(u.port), u.hostname);
    const state = { buf: Buffer.alloc(0), open: false };
    const waiters = new Map();
    const listeners = [];
    let nextId = 1;
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      state.buf = Buffer.concat([state.buf, chunk]);
      if (!state.open) {
        const end = state.buf.indexOf("\r\n\r\n");
        if (end < 0) return;
        const head = state.buf.slice(0, end).toString("utf8");
        if (!/101/.test(head)) {
          reject(new Error("Chrome refused the debugger connection"));
          return;
        }
        state.buf = state.buf.slice(end + 4);
        state.open = true;
        resolve(api);
      }
      for (const text of parseFrames(state)) {
        const msg = JSON.parse(text);
        if (msg.id && waiters.has(msg.id)) {
          waiters.get(msg.id)(msg);
          waiters.delete(msg.id);
        } else if (msg.method) {
          for (const fn of listeners) {
            try {
              fn(msg);
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    });
    const api = {
      send(method, params) {
        const id = nextId++;
        const body = JSON.stringify({ id, method, params });
        const payload = Buffer.from(body);
        const mask = crypto.randomBytes(4);
        const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
        let header;
        if (payload.length < 126) {
          header = Buffer.alloc(6);
          header[0] = 0x81;
          header[1] = 0x80 | payload.length;
          mask.copy(header, 2);
        } else {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0xfe;
          header.writeUInt16BE(payload.length, 2);
          mask.copy(header, 4);
        }
        socket.write(Buffer.concat([header, masked]));
        return new Promise((res) => waiters.set(id, res));
      },
      close() {
        socket.end();
      },
      onEvent(fn) {
        listeners.push(fn);
      },
    };
    const key = crypto.randomBytes(16).toString("base64");
    socket.write(
      "GET " + u.pathname + " HTTP/1.1\r\n" +
        "Host: " + u.host + "\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Key: " + key + "\r\n" +
        "Sec-WebSocket-Version: 13\r\n\r\n"
    );
  });
}

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nodes = Array.from(document.querySelectorAll("a.btn, button[type=submit]"));
  const buttons = [];
  for (const el of nodes) {
    el.scrollIntoView({ block: "center" });
    el.style.outline = "4px solid #e11d48";
    el.style.outlineOffset = "3px";
    await sleep(600);
    const cs = getComputedStyle(el);
    buttons.push({ text: (el.innerText || "").trim(), color: cs.color, background: cs.backgroundColor });
  }
  const flow = document.querySelector("[data-flow]");
  let flowPressed = false;
  if (flow) {
    const store = flow.querySelector(".store");
    if (store) {
      store.click();
      flowPressed = store.getAttribute("aria-pressed") === "true";
    }
  } else {
    const primary = document.querySelector("#action button[type=submit], #action a.btn") || nodes[0];
    document.querySelectorAll("#lead-form input[required]").forEach(function (el) {
      if (!el.value) el.value = el.type === "email" ? "qa@example.com" : "QA";
    });
    if (primary) {
      primary.click();
      await sleep(400);
    }
  }
  const status = document.getElementById("form-status");
  return {
    buttons,
    status: status ? status.textContent : "",
    thanks: document.body.classList.contains("is-thanks"),
    hash: location.hash,
    flowPressed: flowPressed
  };
})()`;

const FLOW_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  sessionStorage.removeItem("lpc_thanks_state");
  sessionStorage.removeItem("lpc_flow_done");
  const store = document.querySelector(".store");
  if (!store) throw new Error("no store");
  store.click();
  const cont = document.querySelector("[data-continue]");
  if (!cont || cont.disabled) throw new Error("continue stayed disabled");
  cont.click();
  const back = document.querySelector('[data-step="2"] [data-back]');
  if (!back) throw new Error("no back button");
  back.click();
  const mid = location.href;
  document.querySelector("[data-continue]").click();
  document.querySelectorAll(".check input").forEach((box) => {
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const match = document.querySelector("[data-match]");
  if (!match || match.disabled) throw new Error("match stayed disabled");
  match.click();
  const start = Date.now();
  let step4 = false;
  while (Date.now() - start < 8000) {
    const panel = document.querySelector('[data-step="4"]');
    if (panel && !panel.hidden) {
      step4 = true;
      break;
    }
    await sleep(100);
  }
  if (!step4) throw new Error("step 4 did not appear");
  const action = document.querySelector("#action");
  action.click();
  action.click();
  const thanks = document.querySelector('[data-step="thanks"]');
  return {
    mid: mid,
    url: location.href,
    href: document.querySelector("[data-store-link]").href,
    thanks: Boolean(thanks && !thanks.hidden),
    scripts: Array.from(document.scripts).filter((s) => (s.src || "").indexOf("click.appcast.io") !== -1).length
  };
})()`;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function runFlowChecks(cdp, pageUrl, campaign) {
  const net = { appcast: [], onelink: [], mode: "stub", hung: null };

  function answer(msg) {
    if (msg.method !== "Fetch.requestPaused") return;
    const requestId = msg.params.requestId;
    const url = (msg.params.request && msg.params.request.url) || "";
    const finish = (method, params) => {
      cdp.send(method, params).catch((err) => {
        console.error("qa fetch:", err.message || err);
      });
    };
    if (url.includes("click.appcast.io")) {
      net.appcast.push(url);
      if (net.mode === "hang") {
        net.hung = requestId;
        return;
      }
      if (net.mode === "block") {
        finish("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
        return;
      }
      finish("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/javascript" }],
        body: Buffer.from("/* qa stub */").toString("base64"),
      });
      return;
    }
    if (url.includes("onelink.me")) net.onelink.push(url);
    finish("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
  }

  cdp.onEvent(answer);
  await cdp.send("Fetch.enable", {
    patterns: [
      { urlPattern: "*click.appcast.io*", requestStage: "Request" },
      { urlPattern: "*onelink.me*", requestStage: "Request" },
      { urlPattern: "*connect.facebook.net*", requestStage: "Request" },
      { urlPattern: "*facebook.com*", requestStage: "Request" },
      { urlPattern: "*googletagmanager.com*", requestStage: "Request" },
      { urlPattern: "*analytics.tiktok.com*", requestStage: "Request" },
    ],
  });

  async function clearStorage() {
    try {
      await evaluate("try { sessionStorage.clear(); } catch (e) {}");
    } catch (err) {
      /* A blocked redirect can leave a page that cannot read storage. */
    }
  }

  async function evaluate(expression, awaitPromise) {
    const reply = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: Boolean(awaitPromise),
      returnByValue: true,
    });
    const details = reply.result && reply.result.exceptionDetails;
    if (details) {
      fail((details.exception && details.exception.description) || details.text || "page script failed");
    }
    return reply.result && reply.result.result && reply.result.result.value;
  }

  async function openPage(url) {
    await cdp.send("Page.navigate", { url });
    const start = Date.now();
    while (Date.now() - start < 8000) {
      const ready = await evaluate("document.readyState === 'complete' && !!document.querySelector('[data-flow]')");
      if (ready) return;
      await sleep(100);
    }
    fail("flow page did not load: " + url);
  }

  async function waitFor(fn, ms, label) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (fn()) return;
      await sleep(50);
    }
    fail(label);
  }

  function assertLink(href) {
    const params = new URL(href).searchParams;
    const problems = [];
    if (params.get("pid") !== "monster") problems.push("pid=" + params.get("pid"));
    if (params.get("c") !== "cleveland-oh") problems.push("c=" + params.get("c"));
    if (params.get("af_sub1") !== "TEST123") problems.push("af_sub1=" + params.get("af_sub1"));
    if (params.get("af_sub2") !== campaign.slug) problems.push("af_sub2=" + params.get("af_sub2"));
    if (params.get("af_sub3") !== "ccuid") problems.push("af_sub3=" + params.get("af_sub3"));
    if (params.get("email") || params.get("phone") || params.get("store")) problems.push("personal param");
    if (problems.length) fail(href + " — " + problems.join(", "));
  }

  function assertClean(href, thanks) {
    const params = new URL(href).searchParams;
    if (params.get("ccuid") !== "TEST123") fail("ccuid missing: " + href);
    if (thanks && params.get("step") !== "thanks") fail("thanks URL missing step: " + href);
    if (/[?&](email|phone|store)=/.test(href) || params.get("email") || params.get("phone") || params.get("store")) {
      fail("personal data in URL: " + href);
    }
  }

  const flowUrl = new URL(pageUrl);
  flowUrl.searchParams.set("source", "monster");
  flowUrl.searchParams.set("utm_source", "jobboard");
  flowUrl.searchParams.set("utm_medium", "monster");
  flowUrl.searchParams.set("utm_campaign", "cleveland-oh");
  flowUrl.searchParams.set("ccuid", "TEST123");
  flowUrl.searchParams.set("email", "person@example.com");
  flowUrl.searchParams.set("phone", "555-123-4567");
  flowUrl.searchParams.set("store", "Walmart");

  await clearStorage();
  await openPage(flowUrl.toString());
  const report = await withTimeout(evaluate(FLOW_SCRIPT, true), 20000, "flow script timed out");
  if (!report || !report.thanks) fail("download did not open the thank-you step");
  assertClean(report.mid, false);
  if (String(report.mid).includes("step=thanks")) fail("thanks was set before download: " + report.mid);
  assertClean(report.url, true);
  assertLink(report.href);
  await waitFor(() => net.appcast.length >= 1, 2000, "Appcast script did not load");
  if (report.scripts !== 1 || net.appcast.length !== 1) {
    fail("Appcast fired " + net.appcast.length + " network / " + report.scripts + " script");
  }
  await waitFor(() => net.onelink.length >= 1, 3000, "stubbed pixel did not redirect");
  assertLink(net.onelink[0]);
  if (net.appcast.length !== 1) fail("redirect caused another Appcast fire");
  console.log("qa flow — one Appcast beacon, ccuid kept, OneLink " + net.onelink[0]);

  const fired = net.appcast.length;
  const redirects = net.onelink.length;
  await openPage(report.url);
  await sleep(1800);
  if (net.appcast.length !== fired) fail("reload fired Appcast again");
  if (net.onelink.length !== redirects) fail("reload redirected again");

  await clearStorage();
  const direct = new URL(pageUrl);
  direct.searchParams.set("step", "thanks");
  direct.searchParams.set("ccuid", "TEST123");
  await openPage(direct.toString());
  const showing = await evaluate(
    "!!(document.querySelector('[data-step=\"thanks\"]') && !document.querySelector('[data-step=\"thanks\"]').hidden)"
  );
  if (!showing) fail("direct thanks URL did not show the thank-you step");
  await sleep(1800);
  if (net.appcast.length !== fired) fail("direct thanks URL fired Appcast");
  if (net.onelink.length !== redirects) fail("direct thanks URL redirected");
  console.log("qa flow — reload and direct ?step=thanks did not fire");

  await clearStorage();
  net.mode = "block";
  await openPage(flowUrl.toString());
  const blockedAt = net.onelink.length;
  await withTimeout(evaluate(FLOW_SCRIPT, true), 20000, "blocked-pixel flow timed out");
  await waitFor(() => net.onelink.length > blockedAt, 3000, "blocked Appcast pixel did not redirect");
  assertLink(net.onelink[net.onelink.length - 1]);
  console.log("qa flow — blocked Appcast still redirected");

  await clearStorage();
  net.mode = "hang";
  await openPage(flowUrl.toString());
  const hungAt = net.onelink.length;
  await withTimeout(evaluate(FLOW_SCRIPT, true), 20000, "hanging-pixel flow timed out");
  await waitFor(() => net.onelink.length > hungAt, 3000, "hanging Appcast pixel blocked the redirect");
  assertLink(net.onelink[net.onelink.length - 1]);
  if (net.hung) {
    await cdp.send("Fetch.failRequest", { requestId: net.hung, errorReason: "BlockedByClient" }).catch(() => {});
  }
  console.log("qa flow — hanging Appcast still redirected");
}

async function main() {
  const chrome = findChrome();
  if (!chrome) fail("no browser. QA will not pass on source alone. Install Chrome or set CHROME_PATH.");

  const env = qaSafeEnv(loadEnv(root));
  const client = env.CLIENT || "_example";
  const clientDir = path.join(root, "clients", client);
  const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
  const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
  const qaEnv = { ...env };
  if (campaign.flow && campaign.thankYou && campaign.thankYou.enabled && !qaEnv.APPCAST_PIXEL_URL) {
    qaEnv.APPCAST_PIXEL_URL = "https://click.appcast.io/pixels/generic3-29483.js?ent=325";
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-qa-"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "harness-chrome-"));
  fs.writeFileSync(path.join(dir, "index.html"), render({ brand, campaign, env: qaEnv, assetPrefix: "" }));
  fs.copyFileSync(path.join(root, "harness", "styles.css"), path.join(dir, "styles.css"));
  fs.copyFileSync(path.join(root, "harness", "attribution.js"), path.join(dir, "attribution.js"));
  fs.copyFileSync(path.join(root, "harness", "client.js"), path.join(dir, "client.js"));
  for (const name of fs.readdirSync(path.join(clientDir, "assets"))) {
    const file = resolveAsset(clientDir, name);
    const destDir = path.join(dir, "assets");
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(file, path.join(destDir, name));
  }

  const { server, port } = await serve(dir);
  const headless = process.env.QA_HEADLESS === "1" || process.env.QA_HEADLESS === "true" || process.env.CI === "true";
  const pageUrl = "http://127.0.0.1:" + port + "/";
  const chromeArgs = [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--user-data-dir=" + profile,
    "--remote-debugging-port=0",
  ];
  if (headless) chromeArgs.push("--headless=new", "--disable-gpu");
  else chromeArgs.push("--new-window");
  if (process.env.CI === "true") chromeArgs.push("--no-sandbox", "--disable-dev-shm-usage");
  chromeArgs.push(pageUrl);
  const child = spawn(chrome, chromeArgs, { stdio: "ignore" });

  let cdp;
  try {
    let debug = "";
    for (let i = 0; i < 50 && !debug; i++) {
      await sleep(200);
      const portFile = path.join(profile, "DevToolsActivePort");
      if (fs.existsSync(portFile)) debug = fs.readFileSync(portFile, "utf8").split("\n")[0].trim();
    }
    if (!debug) fail("Chrome opened but the page never attached. QA cannot pass without the click.");
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const res = await fetch("http://127.0.0.1:" + debug + "/json/list");
        const list = await res.json();
        target = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      } catch {
        target = null;
      }
    }
    if (!target) fail("Chrome opened but the page never attached. QA cannot pass without the click.");
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      const check = await cdp.send("Runtime.evaluate", {
        expression: "document.readyState !== 'loading' && !!document.querySelector('a.btn, button[type=submit]')",
        returnByValue: true,
      });
      ready = Boolean(check.result && check.result.result && check.result.result.value);
      if (!ready) await sleep(100);
    }
    if (!ready) {
      const where = await cdp.send("Runtime.evaluate", {
        expression: "location.href + ' ' + document.readyState + ' ' + (document.body ? document.body.innerText.length : 0)",
        returnByValue: true,
      });
      const detail = where.result && where.result.result && where.result.result.value;
      fail("no CTA button on the page (" + detail + ")");
    }
    const reply = await cdp.send("Runtime.evaluate", {
      expression: PROBE,
      awaitPromise: true,
      returnByValue: true,
    });
    if (reply.result && reply.result.exceptionDetails) fail("the button check threw inside the page");
    const report = reply.result && reply.result.result && reply.result.result.value;
    if (!report || !report.buttons || !report.buttons.length) fail("no CTA button on the page");

    for (const button of report.buttons) {
      if (!button.text) fail("CTA has no label");
      const fill = rgbToHex(button.background);
      const ink = rgbToHex(button.color);
      if (!fill || !ink) fail("could not read the CTA colors from the window");
      const ratio = contrast(fill, ink);
      if (ratio < 4.5) {
        fail("button is unreadable on screen: " + ink + " on " + fill + " is " + ratio.toFixed(1) + ":1");
      }
      console.log("qa click — \"" + button.text + "\" " + ink + " on " + fill + " " + ratio.toFixed(1) + ":1");
    }
    const reacted = campaign.flow
      ? report.flowPressed
      : campaign.primaryAction.type === "form"
        ? Boolean(report.status) || report.thanks
        : report.hash === "#action";
    if (!reacted) fail("the CTA click did nothing");
    console.log("qa click — button responded");
    if (campaign.flow && campaign.thankYou && campaign.thankYou.enabled) {
      await runFlowChecks(cdp, pageUrl, campaign);
    }
    await sleep(800);
  } finally {
    if (cdp) cdp.close();
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((err) => {
  console.error("qa:", err.message || String(err));
  process.exit(1);
});
