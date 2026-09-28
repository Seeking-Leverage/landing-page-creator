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
  const primary = document.querySelector("#action button[type=submit], #action a.btn") || nodes[0];
  if (primary) {
    primary.click();
    await sleep(400);
  }
  const status = document.getElementById("form-status");
  return {
    buttons,
    status: status ? status.textContent : "",
    thanks: document.body.classList.contains("is-thanks"),
    hash: location.hash
  };
})()`;

async function main() {
  const chrome = findChrome();
  if (!chrome) fail("no browser. QA will not pass on source alone. Install Chrome or set CHROME_PATH.");

  const env = loadEnv(root);
  const client = env.CLIENT || "_example";
  const clientDir = path.join(root, "clients", client);
  const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
  const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-qa-"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "harness-chrome-"));
  fs.writeFileSync(path.join(dir, "index.html"), render({ brand, campaign, env, assetPrefix: "" }));
  fs.copyFileSync(path.join(root, "harness", "styles.css"), path.join(dir, "styles.css"));
  fs.copyFileSync(path.join(root, "harness", "client.js"), path.join(dir, "client.js"));
  fs.cpSync(path.join(clientDir, "assets"), path.join(dir, "assets"), { recursive: true });

  const { server, port } = await serve(dir);
  const debug = port + 1;
  const pageUrl = "http://127.0.0.1:" + port + "/";
  const child = spawn(
    chrome,
    [
      "--new-window",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--user-data-dir=" + profile,
      "--remote-debugging-port=" + debug,
      "--remote-allow-origins=*",
      pageUrl,
    ],
    { stdio: "ignore" }
  );

  let cdp;
  try {
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
    const reacted =
      campaign.primaryAction.type === "form"
        ? Boolean(report.status) || report.thanks
        : report.hash === "#action";
    if (!reacted) fail("the CTA click did nothing");
    console.log("qa click — button responded");
    await sleep(800);
  } finally {
    if (cdp) cdp.close();
    child.kill("SIGTERM");
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("qa:", err.message || String(err));
  process.exit(1);
});
