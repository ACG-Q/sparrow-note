#!/usr/bin/env node
/**
 * CDP 验收脚本：关于页的 GitHub 更新源。
 *
 * 用 DevTools 协议的 Fetch 域把 https://api.github.com/* 的响应拦下来换成假的，
 * 于是不用真联网、也不用改应用代码，就能验证：
 *   1. 稳定通道读 /releases/latest → 页面显示「有新版本 9.9.9」，说明/日期/下载链接都在
 *   2. 403 + x-ratelimit-remaining: 0 → 状态行给出「限流」提示（status=error，不抛异常）
 *   3. 404 → 「找不到这个仓库」
 *   4. 网络错误（Fetch.failRequest）→ 「连不上 GitHub」，同样只体现在状态行
 *   5. 测试通道读 /releases?per_page=10，挑第一个 prerelease
 *
 * 前置：dev server 在跑（npm run dev → http://localhost:5173）。
 * 跑法：node scripts/cdp-github-update.mjs
 * 产物：evidence/github-update/*.png 截图 + report.json / report.md
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173/";
const PORT = Number(process.env.CDP_PORT ?? 9791);
const REPO = process.env.GITHUB_REPO ?? "ACG-Q/sparrow-note";
const OUT_DIR = path.resolve("evidence/github-update");
const API = "https://api.github.com";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error("找不到 Chrome / Edge，可用 CHROME_PATH 指定");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let seq = 0;
const pending = new Map();

function rpc(method, params = {}, timeoutMs = 30_000) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`CDP 超时：${method}`));
    }, timeoutMs).unref?.();
  });
}

async function ev(expression) {
  const r = await rpc("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result?.value;
}

async function waitFor(expression, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await ev(expression);
      if (last) return last;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await sleep(120);
  }
  throw new Error(`等待超时：${label}（最后取值：${JSON.stringify(last)}）`);
}

/* ---------- 假响应数据 ---------- */

const stableRelease = {
  tag_name: "v9.9.9",
  name: "v9.9.9",
  body: "修了几个 bug\n\n- 导出的文件名不对\n- 中文输入法偶发吞字",
  html_url: "https://github.com/sparrow-note/sparrow/releases/tag/v9.9.9",
  published_at: "2026-11-01T08:30:00Z",
  draft: false,
  prerelease: false,
};

const betaRelease = {
  tag_name: "v2.0.0-beta.1",
  name: "v2.0.0-beta.1",
  body: "测试版：新的汇总布局",
  html_url: "https://github.com/sparrow-note/sparrow/releases/tag/v2.0.0-beta.1",
  published_at: "2026-11-05T02:00:00Z",
  draft: false,
  prerelease: true,
};

/**
 * 每个场景：respond() 决定拦截后的响应；expectStatus 是状态行必须出现的文字。
 * 状态行文字按顺序互不重叠，所以「等这段文字出现」不会撞到上一个场景的残留。
 */
const scenarios = [
  {
    id: "available",
    title: "稳定通道：正常 release 显示「有新版本 9.9.9」",
    channel: "stable",
    respond: () => ({ code: 200, json: stableRelease }),
    expectStatus: ["有新版本 9.9.9"],
    expectStatusAttr: "available",
    expectUrl: `${API}/repos/${REPO}/releases/latest`,
    expectPage: ["9.9.9", "2026-11-01", "修了几个 bug"],
    expectLink: stableRelease.html_url,
  },
  {
    id: "ratelimit",
    title: "403 限流：状态行给出可读提示",
    channel: "stable",
    respond: () => ({
      code: 403,
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "60" },
      json: {
        message: "API rate limit exceeded for 1.2.3.4.",
        documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
      },
    }),
    expectStatus: ["检查失败", "限流"],
    expectStatusAttr: "error",
    expectUrl: `${API}/repos/${REPO}/releases/latest`,
  },
  {
    id: "notfound",
    title: "404：提示找不到仓库",
    channel: "stable",
    respond: () => ({ code: 404, json: { message: "Not Found" } }),
    expectStatus: ["找不到这个仓库"],
    expectStatusAttr: "error",
    expectUrl: `${API}/repos/${REPO}/releases/latest`,
  },
  {
    id: "network",
    title: "网络错误：只写在状态行，不抛到界面",
    channel: "stable",
    respond: () => ({ fail: "InternetDisconnected" }),
    expectStatus: ["连不上 GitHub"],
    expectStatusAttr: "error",
    expectUrl: `${API}/repos/${REPO}/releases/latest`,
  },
  {
    id: "beta",
    title: "测试通道：读 /releases 并挑第一个 prerelease",
    channel: "beta",
    respond: () => ({ code: 200, json: [stableRelease, betaRelease] }),
    expectStatus: ["有新版本 2.0.0-beta.1"],
    expectStatusAttr: "available",
    expectUrl: `${API}/repos/${REPO}/releases?per_page=10`,
  },
];

/* ---------- 拦截器状态 ---------- */

let current = null; // 当前场景（决定怎么应答）
let requests = []; // 本场景内被拦到的 GitHub 请求

function corsHeaders() {
  return [
    { name: "Access-Control-Allow-Origin", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
    { name: "Access-Control-Allow-Headers", value: "Accept, Content-Type" },
    { name: "Access-Control-Expose-Headers", value: "x-ratelimit-remaining, x-ratelimit-limit" },
  ];
}

async function onRequestPaused({ requestId, request }) {
  if (!request.url.startsWith(`${API}/`)) {
    await rpc("Fetch.continueRequest", { requestId }).catch(() => {});
    return;
  }
  // 只是保险：Accept 是简单请求头，正常不会触发预检
  if (request.method === "OPTIONS") {
    await rpc("Fetch.fulfillRequest", {
      requestId,
      responseCode: 204,
      responseHeaders: corsHeaders(),
    }).catch(() => {});
    return;
  }

  requests.push({
    url: request.url,
    method: request.method,
    accept: Object.entries(request.headers)
      .filter(([k]) => k.toLowerCase() === "accept")
      .map(([, v]) => v)
      .join(", "),
  });

  const res = current.respond();
  if (res.fail) {
    await rpc("Fetch.failRequest", { requestId, errorReason: res.fail }).catch(() => {});
    return;
  }
  await rpc("Fetch.fulfillRequest", {
    requestId,
    responseCode: res.code,
    responseHeaders: [
      { name: "Content-Type", value: "application/json; charset=utf-8" },
      ...corsHeaders(),
      ...Object.entries(res.headers ?? {}).map(([name, value]) => ({ name, value })),
    ],
    body: Buffer.from(JSON.stringify(res.json ?? {}), "utf8").toString("base64"),
  }).catch(() => {});
}

/* ---------- 断言 ---------- */

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  · ${detail}` : ""}`);
  return Boolean(ok);
}

/* ---------- 页面操作 ---------- */

const SNAPSHOT = `(() => {
  const st = document.querySelector("[data-status]");
  return {
    statusAttr: st ? st.getAttribute("data-status") : null,
    statusText: st ? st.textContent.trim() : "",
    bodyText: document.body.innerText,
    links: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    inputs: [...document.querySelectorAll("input")].map((i) => ({ placeholder: i.placeholder, value: i.value })),
    selects: [...document.querySelectorAll("select")].map((s) => s.value),
    saved: localStorage.getItem("sparrow-update-settings"),
  };
})()`;

const selectSource = (id) =>
  ev(`(() => {
    const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "github"));
    if (!sel) return "没找到更新源选择器";
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, ${JSON.stringify(id)});
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.value;
  })()`);

const selectChannel = (ch) =>
  ev(`(() => {
    const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "beta"));
    if (!sel) return "没找到通道选择器";
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, ${JSON.stringify(ch)});
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.value;
  })()`);

const typeRepo = (repo) =>
  ev(`(() => {
    const inp = [...document.querySelectorAll("input")].find((i) => (i.placeholder || "").includes("owner/repo"));
    if (!inp) return "没找到仓库输入框";
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(inp, ${JSON.stringify(repo)});
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return inp.value;
  })()`);

const clickCheck = () =>
  ev(`(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "检查更新");
    if (!b) return "没找到检查按钮";
    b.click();
    return "clicked";
  })()`);

async function openAboutPage() {
  await rpc("Page.navigate", { url: APP_URL });
  await waitFor(
    `!!document.querySelector('[aria-label="主导航"] button')`,
    "导航栏出现",
    30_000,
  );
  await sleep(500);
  await ev(`(() => {
    const b = [...document.querySelectorAll('[aria-label="主导航"] button')].find((x) => x.textContent.includes("我的"));
    if (!b) return "没找到「我的」";
    b.click();
    return "ok";
  })()`);
  await waitFor(
    `[...document.querySelectorAll("button")].some((b) => b.textContent.includes("关于"))`,
    "「关于」入口出现",
  );
  await ev(`(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("关于"));
    b.click();
    return "ok";
  })()`);
  await waitFor(
    `[...document.querySelectorAll("h1")].some((h) => h.textContent.trim() === "关于")`,
    "关于页出现",
  );
}

/* ---------- 主流程 ---------- */

const profile = path.join(process.env.TEMP || process.cwd(), `sparrow-cdp-github-${Date.now()}`);
mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--window-size=1440,1100",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {  // 1. 连上页面 target
  let target = null;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && !target) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      /* Chrome 还没起来 */
    }
  }
  if (!target) throw new Error(`连不上 Chrome 调试端口 ${PORT}`);

  ws = new WebSocket(target);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("WebSocket 连接失败"));
  });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === "Fetch.requestPaused") void onRequestPaused(msg.params);
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("页面异常：", msg.params.exceptionDetails?.text ?? "");
    }
  };

  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Fetch.enable", {
    patterns: [{ urlPattern: `${API}/*`, requestStage: "Request" }],
  });

  // 2. 进关于页，切到 GitHub 源
  await openAboutPage();

  const sourceVal = await selectSource("github");
  await waitFor(
    `[...document.querySelectorAll("input")].some((i) => (i.placeholder || "").includes("owner/repo"))`,
    "GitHub 仓库输入框出现",
  );
  check("选中「GitHub Release」源后出现 owner/repo 输入框", sourceVal === "github", `select=${sourceVal}`);

  const typed = await typeRepo(REPO);
  check("仓库名可填写并写回设置", typed === REPO, `input=${typed}`);

  let snap = await ev(SNAPSHOT);
  check(
    "GitHub 源下不再显示 manifest 的「更新地址」输入框",
    !snap.inputs.some((i) => (i.placeholder || "").includes("latest.json")),
    JSON.stringify(snap.inputs.map((i) => i.placeholder)),
  );

  // 3. 逐个场景：换假响应 → 点检查 → 断言状态行
  const results = [];
  for (const sc of scenarios) {
    current = sc;
    requests = [];
    const ch = await selectChannel(sc.channel);
    if (ch !== sc.channel) throw new Error(`通道没切到 ${sc.channel}：${ch}`);
    await sleep(150);

    const clicked = await clickCheck();
    if (clicked !== "clicked") throw new Error(`点不到「检查更新」：${clicked}`);

    // 等状态行出现本场景特有的文字（各场景文字互不重叠，不会撞到上一次的残留）
    await waitFor(
      `(() => {
        const st = document.querySelector("[data-status]");
        return !!st && st.textContent.includes(${JSON.stringify(sc.expectStatus[0])});
      })()`,
      `状态行出现「${sc.expectStatus[0]}」`,
      20_000,
    );
    snap = await ev(SNAPSHOT);

    const scChecks = [];
    const push = (name, ok, detail = "") => {
      scChecks.push({ name, ok: Boolean(ok), detail });
      check(`[${sc.id}] ${name}`, ok, detail);
    };

    push(
      `状态行包含「${sc.expectStatus.join(" / ")}」`,
      sc.expectStatus.every((t) => snap.statusText.includes(t)),
      snap.statusText,
    );
    push(`data-status=${sc.expectStatusAttr}`, snap.statusAttr === sc.expectStatusAttr, String(snap.statusAttr));

    const req = requests[0];
    push(`请求打到 ${sc.expectUrl.replace(API, "")}`, !!req && req.url === sc.expectUrl, req?.url ?? "没有请求");
    push(
      "请求头 Accept: application/vnd.github+json",
      !!req && req.accept.includes("application/vnd.github+json"),
      req?.accept ?? "",
    );
    push("一次检查只发一个请求", requests.length === 1, `${requests.length} 个`);

    if (sc.expectPage) {
      push(
        "页面展示版本号 / 日期 / 更新说明",
        sc.expectPage.every((t) => snap.bodyText.includes(t)),
        sc.expectPage.join(" / "),
      );
      push(
        "「去下载」指向 release 页面",
        snap.links.includes(sc.expectLink),
        snap.links.join(" | "),
      );
    }
    if (sc.expectStatusAttr === "error") {
      push("界面没有崩（正文仍在）", snap.bodyText.includes("关于"), "正文长度 " + snap.bodyText.length);
    }

    // 截图留证：把状态行滚到视口中间
    await ev(`document.querySelector("[data-status]")?.scrollIntoView({ block: "center" }); true`);
    await sleep(200);
    const shot = await rpc("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT_DIR, `${sc.id}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    results.push({
      id: sc.id,
      title: sc.title,
      channel: sc.channel,
      statusText: snap.statusText,
      statusAttr: snap.statusAttr,
      requests,
      checks: scChecks,
      screenshot: path.relative(process.cwd(), file),
    });
    console.log(`\n— ${sc.title}\n  状态行：${snap.statusText}\n`);
  }

  current = scenarios[0];
  snap = await ev(SNAPSHOT);
  const saved = JSON.parse(snap.saved ?? "{}");
  check("设置里存下了 githubRepo", saved.githubRepo === REPO, JSON.stringify(saved.githubRepo));
  check("设置里存下了 source=github", saved.source === "github", String(saved.source));

  const report = {
    generatedAt: new Date().toISOString(),
    appUrl: APP_URL,
    repo: REPO,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    checks,
    scenarios: results,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
  const md = [
    "# GitHub 更新源 · CDP 验收报告",
    "",
    `- 时间：${report.generatedAt}`,
    `- 页面：${APP_URL}`,
    `- 仓库：${REPO}（GitHub API 由 CDP Fetch 拦截伪造）`,
    `- 结果：${report.passed} 通过 / ${report.failed} 失败`,
    "",
    "| 场景 | 状态行 | 截图 |",
    "| --- | --- | --- |",
    ...results.map((r) => `| ${r.title} | ${r.statusText} | ${r.screenshot} |`),
    "",
  ].join("\n");
  writeFileSync(path.join(OUT_DIR, "report.md"), md, "utf8");

  console.log(`\n===== ${report.passed} 通过 / ${report.failed} 失败 =====`);
  console.log(`报告：${path.relative(process.cwd(), path.join(OUT_DIR, "report.json"))}`);
  if (report.failed > 0) process.exitCode = 1;
} catch (e) {
  console.error("脚本失败：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* 临时目录删不掉不影响结论 */
  }
}
