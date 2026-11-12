import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, loadTasks, loadTeams } from './workbench.mjs';
import { renderConsole } from './console.mjs';
import { renderOrchestra } from './orchestra.mjs';
import { renderStage, renderSpaces } from './stage.mjs';
import { listWorkspaces, resolveWorkspace } from './workspaces.mjs';
import { renderCockpit } from './views/cockpit.mjs';
import { renderKanban } from './views/kanban.mjs';
import { renderTeamArch } from './views/team-arch.mjs';
import { renderDepSwim } from './views/dep-swim.mjs';
import { renderShell, embedCss, stageEmbedCss } from './views/shell.mjs';
import * as store from './store.mjs';

const SERVER_VERSION = 2; // 插件用它判断端口上跑的是不是新代码（旧进程会被替换）
const WS = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'E:/作品/deepseek';
const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || 8787);
// v2.css 随服务端文件走（不随 WS 参数走，临时工作区也能取到全局样式）
const V2_CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'styles', 'v2.css');
// 镜像回写账本默认开启（保持 DSH 左栏一致）；--no-mirror-ledger 关闭。读路径完全不依赖账本。
const MIRROR = !process.argv.includes('--no-mirror-ledger');

const SYNC_LOG = path.join(WS, 'team-view', 'sync.log');

function nowStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  const x = d || new Date();
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}
function logSync(line) {
  try { fs.appendFileSync(SYNC_LOG, '[' + nowStr() + '] ' + line + String.fromCharCode(10), 'utf8'); } catch {}
}

/* 任务数据已迁至自有存储（store.mjs team-view/data/board.json）：
 * 账本与 .agent-teams 只是首次/手动导入源，读写一律走 board.json。
 * 对账自愈（快照/墓碑）已退役，不再新增任何 snapshot/tombstone 写入。 */
function saveBoard(board) {
  store.bump(board);
  store.writeBoard(board);
  store.mirrorLedger(board, MIRROR);
}
function versionOf() {
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(store.BOARD_PATH).mtimeMs; } catch {}
  const board = store.readBoard();
  return {
    ok: true,
    revision: board ? board.revision : -1,
    count: board && Array.isArray(board.tasks) ? board.tasks.length : -1,
    mtimeMs,
    at: Date.now(),
  };
}
function readLinks() {
  const board = store.readBoard();
  return { links: (board && Array.isArray(board.links)) ? board.links : [] };
}


const SESS_ROOT = 'C:/Users/35438/.dsh/sessions';
function readSessionMessages(id) {
  let dir = null;
  const names = String(id).startsWith('session-') ? [String(id)] : [String(id), 'session-' + id];
  try {
    for (const ws of fs.readdirSync(SESS_ROOT)) {
      for (const n of names) {
        const cand = path.join(SESS_ROOT, ws, n);
        if (fs.existsSync(path.join(cand, 'session.v4.jsonl.zstd'))) { dir = cand; break; }
      }
      if (dir) break;
    }
  } catch { return { title: '', messages: [] }; }
  if (!dir) return { title: '', messages: [] };
  const buf = fs.readFileSync(path.join(dir, 'session.v4.jsonl.zstd'));
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const idx = [];
  let i = 0;
  while ((i = buf.indexOf(MAGIC, i)) !== -1) { idx.push(i); i += 4; }
  const chunks = [];
  for (let k = 0; k < idx.length; k++) {
    const start = idx[k];
    const end = k + 1 < idx.length ? idx[k + 1] : buf.length;
    try { chunks.push(zlib.zstdDecompressSync(buf.subarray(start, end))); } catch { /* 跳过坏帧 */ }
  }
  const text = Buffer.concat(chunks).toString('utf8');
  let title = '';
  const messages = [];
  for (const line of text.split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'session/title' && ev.data && ev.data.title) title = ev.data.title;
    if (ev.type === 'user/message') {
      const src = ev.data && ev.data.source;
      if (src && (src.kind === 'time-context' || src.kind === 'system')) continue;
      const txt = (ev.data.content || []).filter(b => b.type === 'text').map(b => b.text).join(String.fromCharCode(10));
      if (txt.trim()) messages.push({ role: 'user', text: txt, time: ev.time });
    }
    if (ev.type === 'assistant/message') {
      const blocks = (ev.data.message && ev.data.message.content) || [];
      const txt = blocks.filter(b => b.type === 'text').map(b => b.text).join(String.fromCharCode(10));
      if (txt.trim()) messages.push({ role: 'assistant', text: txt, time: ev.time });
    }
  }
  return { title, messages: messages.slice(-60) };
}

const body = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => resolve(s ? JSON.parse(s) : {}));
  req.on('error', reject);
});


const projectDir = (ws) => path.join(ws.path || String(ws), '项目书');

function readProjectDocs(ws) {
  const dir = projectDir(ws);
  const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      out.push({ name: f.replace(/[.]md$/, ''), txt });
    }
  } catch {}
  return out;
}

/* 项目书文件名清单：与 GET /api/projects 同一来源（项目书目录 *.md，排除 _模板.md） */
function listProjectFiles(ws) {
  const dir = projectDir(ws);
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== '_模板.md'); } catch { return []; }
}

/* 四个 V2 视图共享的数据集：与 GET /api/data 响应同构 */
function v2Data(ws) {
  return {
    ws: { id: ws.id, title: ws.title, path: ws.path },
    tasks: loadTasks(ws.id),
    teams: loadTeams(ws.path),
    links: readLinks().links,
    projects: listProjectFiles(ws),
  };
}

const esc2 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------------------
 * V2 顶部导航（壳层）：驾驶舱 | 任务看板 | 团队架构 | 依赖泳道
 * 自带样式（取 v2.css 同值中性色，无渐变/发光，圆角 ≤ 6px），可注入任何页面
 * ------------------------------------------------------------------------- */
const V2_NAV_CSS = '<style>'
  + '.v2-nav{position:sticky;top:0;z-index:50;background:#ffffff;border-bottom:1px solid rgba(0,0,0,.10);font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5}'
  + '.v2-nav__inner{max-width:1280px;margin:0 auto;padding:7px 16px;display:flex;align-items:center;gap:2px;flex-wrap:wrap}'
  + '.v2-nav__brand{font-weight:700;color:#0f1115;margin-right:8px}'
  + '.v2-nav__item{color:#353638;text-decoration:none;padding:4px 10px;border-radius:4px;border:1px solid transparent;white-space:nowrap}'
  + '.v2-nav__item:hover{background:#f1f3f5}'
  + '.v2-nav__item.on{background:#0f1115;color:#ffffff}'
  + '.v2-nav__sep{width:1px;height:16px;background:rgba(0,0,0,.10);margin:0 8px}'
  + '.v2-nav__gap{flex:1;min-width:12px}'
  + '.v2-nav__ws{color:#61666b;white-space:nowrap}'
  + '.v2-nav__ws b{color:#0f1115;font-weight:600}'
  + '.v2-nav__switch a{color:#4176e6;text-decoration:none;margin-left:6px;border-bottom:1px dashed rgba(0,0,0,.16);white-space:nowrap}'
  + '.v2-nav__switch a:hover{background:#f1f3f5}'
  + '.v2-nav__misc a,.v2-nav__misc button{color:#4176e6;text-decoration:none;padding:4px 8px;border:1px solid rgba(0,0,0,.10);border-radius:4px;background:#ffffff;margin-left:4px;font-size:13px;cursor:pointer;white-space:nowrap}'
  + '.v2-nav__misc a:hover,.v2-nav__misc button:hover{background:#f1f3f5}'
  + '.v2-nav__misc button{font-family:inherit}'
  + '</style>';

function v2NavHtml({ ws, active, qs, spaces, showCreate }) {
  const items = [['/', '工作台'], ['/cockpit', '驾驶舱'], ['/kanban', '任务看板'], ['/team', '团队架构'], ['/deps', '依赖泳道']];
  const links = items.map(([href, label]) =>
    '<a class="v2-nav__item' + (active === href ? ' on' : '') + '" href="' + href + qs + '">' + label + '</a>').join('');
  const others = (spaces || []).filter((s) => (s.id || s.path) !== (ws.id || ws.path));
  const switcher = others.length
    ? '<span class="v2-nav__switch">切换：' + others.slice(0, 6).map((s) =>
      '<a href="' + (active || '/') + '?ws=' + encodeURIComponent(s.id || s.path) + '">' + esc2(s.title) + '</a>').join('') + '</span>'
    : '';
  return V2_NAV_CSS
    + '<nav class="v2-nav"><div class="v2-nav__inner">'
    + '<span class="v2-nav__brand">工作台 V2</span>'
    + links
    + '<span class="v2-nav__sep"></span>'
    + '<span class="v2-nav__ws">🗂 工作区 <b>' + esc2(ws.title || ws.id || '默认') + '</b></span>'
    + switcher
    + '<span class="v2-nav__gap"></span>'
    + '<span class="v2-nav__misc">'
    + (showCreate ? '<button type="button" id="v2nav-new">＋ 新建任务</button>' : '')
    + '<a href="/spaces">全部工作区 →</a>'
    + '</span></div></nav>';
}

/* 新建任务弹窗（壳层自绘，禁 window.prompt；与 stage 一致走 POST /api/action create） */
function v2CreateModalHtml() {
  return '<div class="v2-nm" id="v2-nm" hidden>'
    + '<div class="v2-nm__panel">'
    + '<div class="v2-nm__title">新建任务</div>'
    + '<input class="v2-nm__input" id="v2-nm-input" placeholder="一句话标题，例如：把刷机过程写成文档" maxlength="200">'
    + '<div class="v2-nm__err" id="v2-nm-err" hidden></div>'
    + '<div class="v2-nm__actions"><button type="button" class="v2-btn" id="v2-nm-cancel">取消</button>'
    + '<button type="button" class="v2-btn v2-btn--primary" id="v2-nm-ok">创建</button></div>'
    + '</div></div>'
    + '<style>'
    + '.v2-nm{position:fixed;inset:0;z-index:80;background:rgba(15,17,21,.38);display:flex;align-items:center;justify-content:center}'
    + '.v2-nm[hidden]{display:none}'
    + '.v2-nm__panel{width:min(420px,90vw);background:#ffffff;border:1px solid rgba(0,0,0,.16);border-radius:6px;padding:14px 16px;font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;box-sizing:border-box}'
    + '.v2-nm__title{font-weight:700;color:#0f1115;margin-bottom:8px}'
    + '.v2-nm__input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.10);border-radius:4px;font:13px/1.5 inherit;outline:none;color:#353638}'
    + '.v2-nm__input:focus{border-color:rgba(0,0,0,.16)}'
    + '.v2-nm__err{color:#b91c1c;font-size:12px;margin-top:6px}'
    + '.v2-nm__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}'
    + '</style>'
    + '<script>'
    + '(function () {'
    + 'var httpMode = /^https?:$/.test(location.protocol);'
    + 'var openBtn = document.getElementById("v2nav-new");'
    + 'var modal = document.getElementById("v2-nm");'
    + 'var input = document.getElementById("v2-nm-input");'
    + 'var err = document.getElementById("v2-nm-err");'
    + 'function open() { modal.hidden = false; err.hidden = true; input.value = ""; setTimeout(function () { input.focus(); }, 30); }'
    + 'function close() { modal.hidden = true; }'
    + 'function fail(msg) { err.textContent = msg; err.hidden = false; }'
    + 'if (openBtn) openBtn.addEventListener("click", function () {'
    + '  if (!httpMode) { open(); fail("预览模式：未连接服务，无法新建任务"); return; }'
    + '  open();'
    + '});'
    + 'document.getElementById("v2-nm-cancel").addEventListener("click", close);'
    + 'document.getElementById("v2-nm-ok").addEventListener("click", function () {'
    + '  var t = (input.value || "").trim();'
    + '  if (!t) { fail("标题不能为空"); return; }'
    + '  fetch("/api/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", title: t, priority: "P2" }) })'
    + '    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })'
    + '    .then(function () { location.reload(); })'
    + '    .catch(function (e) { fail("创建失败：" + e.message); });'
    + '});'
    + 'input.addEventListener("keydown", function (e) {'
    + '  if (e.key === "Enter") document.getElementById("v2-nm-ok").click();'
    + '  if (e.key === "Escape") close();'
    + '});'
    + 'modal.addEventListener("click", function (e) { if (e.target === modal) close(); });'
    + '})();'
    + '</script>';
}

/* 请求参数里带的工作区，原样带到导航链接上（?ws= 或 ?sid=） */
function wsQS(url, ws) {
  if (url.searchParams.get('ws')) return '?ws=' + encodeURIComponent(url.searchParams.get('ws'));
  if (url.searchParams.get('sid')) return '?sid=' + encodeURIComponent(url.searchParams.get('sid'));
  return '?ws=' + encodeURIComponent(ws.id || ws.path || '');
}

/* V2 页面壳：<head> 统一注入 v2.css，正文 = 顶部导航 + 视图片段 + 新建任务弹窗 */
function v2Page({ title, body, ws, active, qs, spaces, showCreate, embed }) {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc2(title) + '</title>'
    + '<link rel="stylesheet" href="/styles/v2.css">'
    + '<style>html,body{margin:0;padding:0;background:#f9fafb}'
    + '.v2-page{max-width:1280px;margin:0 auto;padding:10px 16px 28px;font-family:var(--font-sans)}'
    + '</style>'
    + (embed ? embedCss() : '')
    + '</head><body>'
    + (embed ? '' : v2NavHtml({ ws, active, qs, spaces, showCreate }))
    + '<main class="v2-page">' + body + '</main>'
    + (embed ? '' : (showCreate ? v2CreateModalHtml() : ''))
    + '</body></html>';
}


function pickProjectContext(ws, title) {
  const docs = readProjectDocs(ws).map((d) => {
    let mtime = 0;
    try { mtime = fs.statSync(path.join(projectDir(ws), d.name + '.md')).mtimeMs; } catch {}
    return Object.assign({}, d, { mtime });
  });
  if (!docs.length) return '';
  const norm = (v) => Array.from(String(v || '')).filter((c) => {
    const n = c.codePointAt(0);
    return (n >= 48 && n <= 57) || (n >= 65 && n <= 90) || (n >= 97 && n <= 122) || (n >= 0x4e00 && n <= 0x9fff);
  }).join('');
  const kw = norm(title);
  const grams = (v) => {
    const out = new Set();
    for (let i = 0; i + 1 < v.length; i++) out.add(v.slice(i, i + 2));
    return out;
  };
  const kg = grams(kw);
  let best = null;
  let bestScore = 0;
  for (const d of docs) {
    const dg = grams(norm(d.name + d.txt.slice(0, 4000)));
    let score = 0;
    for (const g of kg) if (dg.has(g)) score += 1;
    const dn = grams(norm(d.name));
    for (const g of kg) if (dn.has(g)) score += 5;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  const doc = best || docs.slice().sort((a, b) => b.mtime - a.mtime)[0];
  if (!doc) return '';
  const CRLF = new RegExp(String.fromCharCode(13) + '?' + String.fromCharCode(10));
  const lines = doc.txt.split(CRLF);
  const hitIdx = [];
  const kwLong = norm(title);
  for (let i = 0; i < lines.length; i++) {
    const ln = norm(lines[i]);
    if (!ln) continue;
    let hit = false;
    for (let k = 0; k + 1 < kwLong.length && !hit; k++) {
      if (ln.includes(kwLong.slice(k, k + 2))) hit = true;
    }
    if (hit) hitIdx.push(i);
  }
  let excerpt;
  if (hitIdx.length) {
    const at = Math.max(0, hitIdx[0] - 3);
    excerpt = lines.slice(at, at + 24).join(String.fromCharCode(10));
  } else {
    const H1 = new RegExp('^##' + String.fromCharCode(92) + 's*1');
    const at = lines.findIndex((l) => H1.test(l));
    excerpt = lines.slice(at >= 0 ? at : 0, (at >= 0 ? at : 0) + 18).join(String.fromCharCode(10));
  }
  return ('【项目书 · ' + doc.name + '】' + String.fromCharCode(10) + excerpt).slice(0, 1600);
}

function upstreamBrief(ledger, taskId) {
  const t = (ledger.tasks || []).find((x) => x.id === taskId);
  if (!t || !Array.isArray(t.dependencies) || !t.dependencies.length) return '';
  const parts = [];
  for (const id of t.dependencies) {
    const up = (ledger.tasks || []).find((x) => x.id === id);
    if (!up) continue;
    let brief = '';
    if (Array.isArray(up.teamResults) && up.teamResults.length) {
      brief = String(up.teamResults[up.teamResults.length - 1].output || '').slice(0, 600);
    } else if (Array.isArray(up.executions) && up.executions.length) {
      brief = String(up.executions[up.executions.length - 1].result || '').slice(0, 300);
    } else {
      brief = '(尚未产出)';
    }
    parts.push('- ' + (up.title || id) + '：' + brief);
  }
  return parts.length ? ('【上游产出】' + String.fromCharCode(10) + parts.join(String.fromCharCode(10))) : '';
}

function buildContractPrompt(ledger, t, extraPrompt, ws) {
  if (extraPrompt && String(extraPrompt).trim()) return String(extraPrompt);
  const c = t.contract || {};
  const blocks = [];
  blocks.push('【任务】' + (t.title || ''));
  if (c.goal) blocks.push('【目标】' + c.goal);
  if (c.inputs) blocks.push('【输入】' + c.inputs);
  if (c.outputs) blocks.push('【产出】' + c.outputs);
  if (c.acceptance) blocks.push('【验收标准】' + c.acceptance);
  if (c.iface) blocks.push('【接口约定】' + c.iface);
  if (!c.goal && t.description) blocks.push('【说明】' + t.description);
  const kwctx = [t.title, c.goal, c.inputs, c.outputs, c.acceptance].filter(Boolean).join(' ');
  const pj = pickProjectContext(ws, kwctx);
  if (pj) blocks.push(pj);
  const up = upstreamBrief(ledger, t.id);
  if (up) blocks.push(up);
  blocks.push('【要求】严格按上面的产出与验收标准交付；不确定时先说明假设，不要自行扩大范围。');
  return blocks.join(String.fromCharCode(10) + String.fromCharCode(10));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  // 每个请求各自解析工作区：?ws=id/title/path → ?sid=会话反查 → 最近会话 → 默认
  const ws = resolveWorkspace({ ws: url.searchParams.get('ws'), sid: url.searchParams.get('sid') });
  // 对账自愈已退役（t11）；healed 固定空值保持 /api/data、/api/version 对外 JSON 形状不变
  const healed = { healed: 0, titles: [] };
  // 每个请求先确保自有存储已就绪（首次自动从账本与团队文件导入；损坏自动重建）
  store.readBoard(ws.path);
  try {
    if (req.method === 'GET' && (url.searchParams.get('view') === 'stage' || url.pathname === '/stage')) {
      const embed = url.searchParams.get('embed') === '1';
      let html = renderStage(ws, { demo: url.searchParams.has('demo'), spaces: listWorkspaces() });
      if (embed) html = html.replace('</head>', stageEmbedCss() + '</head>');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.searchParams.get('view') === 'orchestra') {
      const html = renderOrchestra(ws.path, { demo: url.searchParams.has('demo') });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.searchParams.get('view') === 'console') {
      const html = renderConsole(ws.path, { demo: url.searchParams.has('demo') });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/classic') {
      const html = render(ws.path, { demo: url.searchParams.has('demo') });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/styles/v2.css') {
      let css = '';
      try { css = fs.readFileSync(V2_CSS, 'utf8'); } catch (e) { throw new Error('v2.css not found: ' + e.message); }
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(css);
    }
    if (req.method === 'GET' && url.pathname === '/kanban') {
      const embed = url.searchParams.get('embed') === '1';
      const html = v2Page({ title: '任务看板', body: renderKanban(v2Data(ws)), ws, active: '/kanban', qs: wsQS(url, ws), spaces: listWorkspaces(), showCreate: true, embed });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/team') {
      const embed = url.searchParams.get('embed') === '1';
      const html = v2Page({ title: '团队架构', body: renderTeamArch(v2Data(ws)), ws, active: '/team', qs: wsQS(url, ws), spaces: listWorkspaces(), showCreate: true, embed });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/deps') {
      const embed = url.searchParams.get('embed') === '1';
      const html = v2Page({ title: '依赖泳道', body: renderDepSwim(v2Data(ws)), ws, active: '/deps', qs: wsQS(url, ws), spaces: listWorkspaces(), showCreate: true, embed });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/cockpit') {
      // 总览驾驶舱（6.2）：作为独立视图保留；embed=1 时只出内容（供单页工作台内嵌）
      const embed = url.searchParams.get('embed') === '1';
      let html = renderCockpit(v2Data(ws));
      if (embed) {
        html = html.replace('</head>', embedCss() + '</head>');
      } else {
        html = html.replace('<body>', '<body>' + v2NavHtml({ ws, active: '/cockpit', qs: wsQS(url, ws), spaces: listWorkspaces(), showCreate: true }) + v2CreateModalHtml());
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      // 单页工作台壳：一个界面 = 驾驶舱 + 项目书/任务（V1 原布局） + 团队架构 + 依赖泳道
      const html = renderShell({
        ws,
        spaces: listWorkspaces(),
        qs: wsQS(url, ws),
        demo: url.searchParams.has('demo'),
        counts: (() => {
          // 与驾驶舱"队伍在岗"同源：按团队成员状态计数，保证两处数字一致
          const c = { idle: 0, running: 0, done: 0, error: 0, decision: 0, archived: 0 };
          const key = (s) => {
            const st = String(s || '').toLowerCase();
            if (st === 'working' || st === 'busy' || st === 'running') return 'running';
            if (st === 'done' || st === 'completed' || st === 'complete') return 'done';
            if (st === 'failed' || st === 'error' || st === 'blocked') return 'error';
            if (st === 'waiting' || st === 'paused' || st === 'decision') return 'decision';
            if (st === 'archived') return 'archived';
            return 'idle';
          };
          loadTeams(ws.path).forEach((t) => {
            (t.members || []).forEach((m) => { c[key(m.status)] += 1; });
          });
          return c;
        })(),
      });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/legacy') {
      const html = renderStage(ws, { demo: url.searchParams.has('demo'), spaces: listWorkspaces() });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && (url.pathname === '/spaces' || url.searchParams.get('view') === 'spaces')) {
      const stats = listWorkspaces().map((w) => {
        let projects = 0;
        try { projects = fs.readdirSync(path.join(w.path, '项目书')).filter((f) => f.endsWith('.md') && f !== '_模板.md').length; } catch {}
        return { id: w.id, title: w.title, path: w.path, tasks: loadTasks(w.id), teams: loadTeams(w.path), projects };
      });
      const html = renderSpaces(stats, { current: ws.id });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/api/session') {
      const id = url.searchParams.get('id') || '';
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(readSessionMessages(id)));
    }
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(listProjectFiles(ws)));
    }
    if (req.method === 'GET' && url.pathname === '/api/project') {
      const name = url.searchParams.get('id') || '';
      const file = path.join(ws.path, '项目书', name.endsWith('.md') ? name : name + '.md');
      let text = '';
      try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = '# 未找到项目书' + String.fromCharCode(10) + e.message; }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(text);
    }
    if (req.method === 'GET' && url.pathname === '/api/requests') {
      const root = path.join(ws.path, '.agent-teams');
      const out = [];
      try {
        for (const n of fs.readdirSync(root)) {
          const f = path.join(root, n, 'requests.jsonl');
          if (!fs.existsSync(f)) continue;
          for (const line of fs.readFileSync(f, 'utf8').split(String.fromCharCode(10))) {
            if (!line.trim()) continue;
            try { const j = JSON.parse(line); if (!j.status || j.status === 'queued') out.push(j); } catch {}
          }
        }
      } catch {}
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(out));
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, server: 'workbench', v: SERVER_VERSION, pid: process.pid, workspaces: listWorkspaces().length }));
    }
    if (req.method === 'GET' && url.pathname === '/api/version') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(Object.assign(versionOf(), { healed })));
    }
    if (req.method === 'GET' && url.pathname === '/api/data') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(Object.assign(v2Data(ws), { healed })));
    }
    if (req.method === 'POST' && url.pathname === '/api/resync') {
      // 手动触发重新导入（账本/团队文件被外部改动后按需同步；deleted 中的任务不会复活）
      const r = store.resyncBoard(ws.path);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(r));
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      const payload = await body(req);
      if (payload.action === 'move') {
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.id);
        if (!t) throw new Error('task not found: ' + payload.id);
        // V2：无条件覆盖目标状态（done/archived 也可作为移动目标），映射保持原语义
        const map = { line: 'todo', start: 'running', done: 'done', failed: 'failed', backlog: 'backlog', archived: 'archived' };
        const next = map[payload.to];
        if (!next) throw new Error('bad target: ' + payload.to);
        t.status = next;
        t.updatedAt = Date.now();
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t.id, status: next }));
      }
      if (payload.action === 'archive') {
        // 契约见 kanban.API-NEEDS.md §2.2：note 必填（trim 后非空、≤200），成功落 status/archiveNote/log
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.id);
        if (!t) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'task not found: ' + payload.id }));
        }
        const note = String(payload.note == null ? '' : payload.note).trim();
        if (!note || note.length > 200) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'archive note required' }));
        }
        t.status = 'archived';
        t.updatedAt = Date.now();
        t.archiveNote = note;
        t.log = (Array.isArray(t.log) ? t.log : []).concat([{ at: Date.now(), act: 'archive', text: '归档：' + note }]);
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t.id, status: 'archived' }));
      }
      if (payload.action === 'unarchive') {
        // 契约见 kanban.API-NEEDS.md §2.3：无 to → backlog；to:'start' → running（看板也会显式发 to:'backlog'）
        if (payload.to !== undefined && payload.to !== 'start' && payload.to !== 'backlog') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'bad target: ' + payload.to }));
        }
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.id);
        if (!t) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'task not found: ' + payload.id }));
        }
        t.status = payload.to === 'start' ? 'running' : 'backlog';
        delete t.archiveNote;
        t.updatedAt = Date.now();
        t.log = (Array.isArray(t.log) ? t.log : []).concat([{ at: Date.now(), act: 'unarchive', text: '取消归档' }]);
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t.id, status: t.status }));
      }
      if (payload.action === 'create') {
        const title = String(payload.title || '').trim();
        if (!title) throw new Error('title required');
        const board = store.readBoard(ws.path);
        const now = Date.now();
        const t = {
          id: (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : 't' + now,
          title,
          description: String(payload.note || ''),
          prompt: '',
          status: payload.backlog ? 'backlog' : 'todo',
          createdAt: now,
          updatedAt: now,
          executions: [],
          workspaceId: ws.id || undefined,
          workspacePath: ws.path,
          tags: payload.priority ? [{ name: String(payload.priority) }] : [],
          // 自有存储规范字段
          wsId: String(ws.id || ''),
          project: String(payload.project || ''),
          assignee: '',
          archiveNote: '',
          log: [],
          origin: { source: 'local', ref: '' },
        };
        board.tasks.push(t);
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t }));
      }
      if (payload.action === 'delete') {
        // t11：只写 board.json（deleted[] + revision），不再写快照/墓碑
        const board = store.readBoard(ws.path);
        const i = board.tasks.findIndex((x) => x.id === payload.id);
        if (i < 0) throw new Error('task not found: ' + payload.id);
        const [gone] = board.tasks.splice(i, 1);
        board.deleted = (Array.isArray(board.deleted) ? board.deleted : []).concat([{ id: gone.id, at: Date.now(), note: String(payload.note || '') }]);
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, deleted: gone.id }));
      }
      if (payload.action === 'link') {
        const board = store.readBoard(ws.path);
        const id = 'l' + Date.now();
        board.links.push({ id, a: payload.a, b: payload.b, kind: payload.kind === 'merge' ? 'merge' : 'link', at: Date.now() });
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, id }));
      }


      if (payload.action === 'contract') {
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.boardTaskId);
        if (!t) throw new Error('task not found: ' + payload.boardTaskId);
        t.contract = {
          goal: String(payload.goal || '').slice(0, 2000),
          inputs: String(payload.inputs || '').slice(0, 2000),
          outputs: String(payload.outputs || '').slice(0, 2000),
          acceptance: String(payload.acceptance || '').slice(0, 2000),
          iface: String(payload.iface || '').slice(0, 2000),
        };
        if (payload.deps !== undefined) {
          const raw = String(payload.deps || '').split(new RegExp('[,，;' + String.fromCharCode(10) + ']')).map((x) => x.trim()).filter(Boolean);
          const resolved = [];
          for (const k of raw) {
            const hit = board.tasks.find((x) => x.id === k || (x.title || '').includes(k));
            if (hit && hit.id !== t.id) resolved.push(hit.id);
          }
          t.dependencies = resolved;
        }
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t }));
      }
      if (payload.action === 'dispatch') {
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.boardTaskId);
        if (!t) throw new Error('task not found: ' + payload.boardTaskId);
        const reqId = 'r' + Date.now();
        const dir = path.join(ws.path, '.agent-teams', String(payload.teamId));
        if (!fs.existsSync(dir)) throw new Error('team not found: ' + payload.teamId);
        const rec = {
          id: reqId, boardTaskId: payload.boardTaskId, teamId: payload.teamId,
          title: payload.title || t.title, prompt: buildContractPrompt(board, t, payload.prompt, ws),
          priority: payload.priority || '', ts: Date.now(), status: 'queued',
        };
        fs.appendFileSync(path.join(dir, 'requests.jsonl'), JSON.stringify(rec) + String.fromCharCode(10));
        t.dispatch = { teamId: rec.teamId, requestId: reqId, at: rec.ts, status: 'queued' };
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, requestId: reqId, task: t }));
      }
      if (payload.action === 'writeback') {
        const board = store.readBoard(ws.path);
        const t = board.tasks.find((x) => x.id === payload.boardTaskId);
        if (!t) throw new Error('task not found: ' + payload.boardTaskId);
        t.teamResults = t.teamResults || [];
        t.teamResults.push({ teamId: payload.teamId || '', teamTaskId: payload.teamTaskId || '', output: String(payload.output || ''), status: payload.status || 'completed', at: Date.now() });
        if (t.dispatch) t.dispatch.status = 'done';
        if (payload.closeTask) t.status = 'done';
        saveBoard(board);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task: t }));
      }
      throw new Error('unknown action');
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    const msg = String((e && e.message) || e).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    console.error('[workbench] render error:', msg);
    try {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end('<meta charset=utf-8><body style="font:14px/1.7 system-ui;padding:30px;color:#0f1115"><h3 style="margin:0 0 8px">工作台这次没渲染出来</h3><pre style="white-space:pre-wrap;color:#b91c1c;background:#fee2e2;padding:10px;border-radius:8px">' + msg + '</pre><p><a href="/">重试</a> · <a href="/classic">用旧版工作台</a> · 数据没丢，只是这次渲染失败</p></body>');
      }
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: msg }));
    } catch (_) { try { res.statusCode = 500; res.end('render error'); } catch (__) {} }
  }
});

// --resync：启动时先重新导入一次（账本/团队文件被外部改动后按需同步；deleted 中的任务不会复活）
if (process.argv.includes('--resync')) {
  try {
    const r = store.resyncBoard(WS);
    console.log('[resync] 启动时重新导入完成：', JSON.stringify(r));
  } catch (e) { console.error('[resync] 启动时重新导入失败：', (e && e.message) || e); }
}

server.listen(PORT, '127.0.0.1', () => console.log(`workbench serving http://127.0.0.1:${PORT} default=${WS} workspaces=${listWorkspaces().length} board=${store.BOARD_PATH} mirror=${MIRROR}`));
