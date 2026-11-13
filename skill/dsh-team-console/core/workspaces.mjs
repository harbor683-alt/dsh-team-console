// 工作区登记表：把"每个工作区各有一个工作台"落到数据层
// 登记表：<DSH_HOME>/storages/workspace.json → tables.workspaces
// 会话目录：<DSH_HOME>/sessions/<路径转义目录>/<sid>/session.v4.jsonl.zstd
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
export const DEFAULT_WS_PATH = process.env.WORKBENCH_WS || process.cwd();
const REG = path.join(DSH_HOME, 'storages', 'workspace.json');
const SESS = path.join(DSH_HOME, 'sessions');

export function samePath(a, b) {
  try { return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase(); } catch { return false; }
}

export function listWorkspaces() {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(REG, 'utf8')); } catch { /* 登记表读不到就用默认 */ }
  const tbl = (j && j.tables && j.tables.workspaces) || {};
  const out = [];
  for (const id of Object.keys(tbl)) {
    const v = tbl[id] || {};
    const p = typeof v === 'string' ? v : (v.path || v.root || v.dir || '');
    if (!p) continue;
    const title = (typeof v === 'object' && (v.title || v.name)) || path.basename(p);
    out.push({ id, path: p, title });
  }
  if (!out.length) out.push({ id: 'default', path: DEFAULT_WS_PATH, title: 'deepseek' });
  return out;
}

export function defaultWorkspaceId() {
  const list = listWorkspaces();
  const hit = list.find((w) => samePath(w.path, DEFAULT_WS_PATH));
  return hit ? hit.id : (list[0] ? list[0].id : null);
}

// --E-~4F5C~54C1-deepseek-- → E:\作品\deepseek
export function sessionDirToPath(name) {
  const s = String(name || '');
  if (s.length < 4 || !s.startsWith('--') || !s.endsWith('--')) return null;
  let body = s.slice(2, -2).replace(/~([0-9A-Fa-f]{4,6})/g, (_, h) => {
    try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
  });
  const BS = String.fromCharCode(92);
  body = body.replace(/^([A-Za-z])-/, '$1:' + BS);
  return body.replace(/-/g, BS);
}

function sessionDirs() {
  try { return fs.readdirSync(SESS); } catch { return []; }
}

export function sessionOwnerDir(sid) {
  const raw = String(sid || '').replace(/[^0-9a-zA-Z_-]/g, '');
  if (!raw) return null;
  const names = raw.startsWith('session-') ? [raw] : [raw, 'session-' + raw];
  for (const dir of sessionDirs()) {
    for (const n of names) {
      if (fs.existsSync(path.join(SESS, dir, n, 'session.v4.jsonl.zstd'))) return dir;
    }
  }
  return null;
}

export function workspaceForSessionDir(dir) {
  const p = sessionDirToPath(dir);
  if (!p) return null;
  const hit = listWorkspaces().find((w) => samePath(w.path, p));
  if (hit) return hit;
  // 目录名里的 '-' 还原成 '\\' 有歧义，只有路径真的存在才认
  try { if (fs.statSync(p).isDirectory()) return { id: null, path: p, title: path.basename(p) }; } catch { /* 不存在的就是解错了 */ }
  return null;
}

function newestSession() {
  let best = null;
  for (const dir of sessionDirs()) {
    let kids = [];
    try { kids = fs.readdirSync(path.join(SESS, dir)); } catch { continue; }
    for (const k of kids) {
      try {
        const st = fs.statSync(path.join(SESS, dir, k, 'session.v4.jsonl.zstd'));
        if (!best || st.mtimeMs > best.t) best = { dir, t: st.mtimeMs };
      } catch { /* 不是会话目录 */ }
    }
  }
  return best;
}

// 优先级：?ws=（id / 标题 / 路径）→ ?sid=（会话反查工作区）→ 最近改动过的会话 → 默认工作区
export function resolveWorkspace({ ws, sid } = {}) {
  const list = listWorkspaces();
  if (ws) {
    const key = String(ws);
    const hit = list.find((w) => w.id === key) || list.find((w) => w.title === key) || list.find((w) => samePath(w.path, key));
    if (hit) return hit;
    if (/^[a-zA-Z]:[\\/]/.test(key) || key.startsWith('/')) {
      try { if (fs.statSync(key).isDirectory()) return { id: null, path: key, title: path.basename(key) }; } catch { /* 不是目录 */ }
    }
  }
  if (sid) {
    const dir = sessionOwnerDir(sid);
    if (dir) {
      const w = workspaceForSessionDir(dir);
      if (w) return w;
    }
  }
  const recent = newestSession();
  if (recent) {
    const w = workspaceForSessionDir(recent.dir);
    if (w) return w;
  }
  return list.find((w) => samePath(w.path, DEFAULT_WS_PATH)) || list[0] || { id: null, path: DEFAULT_WS_PATH, title: 'deepseek' };
}
