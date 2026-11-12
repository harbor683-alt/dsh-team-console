// store.mjs —— 工作台自有任务存储（V2 数据层）
// 目的：任务数据脱钩社区账本（ledger-v2.json）schema，读写只走 board.json。
// 账本与 <ws>/.agent-teams 仅为一次性导入源（读），可选镜像回写账本。
// 契约：所有函数不因数据形状变化抛错；字段缺失一律给默认值。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- 路径 ----
export const BOARD_PATH = process.env.WORKBENCH_BOARD
  || path.join(HERE, 'data', 'board.json');
export function ledgerPath() {
  return process.env.WORKBENCH_LEDGER
    || path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'task-board', 'ledger-v2.json');
}
export function linksPath(wsPath) {
  return path.join(wsPath || '.', 'team-view', 'links.json');
}
export function teamsRoot(wsPath) {
  return path.join(wsPath || '.', '.agent-teams');
}

// ---- 状态归一 ----
const STATUS_ALIAS = { pending: 'todo', in_progress: 'running', completed: 'done', cancelled: 'failed' };
export function normalizeStatus(s) {
  const v = String(s == null ? '' : s).trim();
  return STATUS_ALIAS[v] || v || 'todo';
}

// ---- 工具 ----
function readJSON(file, fb) {
  try {
    if (!fs.existsSync(file)) return fb;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fb;
  }
}
function writeJSONAtomic(file, obj) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
const WS_RE = new RegExp(String.fromCharCode(92) + 's+', 'g');
function normTitle(s) {
  return String(s == null ? '' : s).replace(WS_RE, '').toLowerCase();
}
function now() { return Date.now(); }
// 推断工作区根（服务端 argv[2] 约定：node serve-workbench.mjs <ws> [--port=N]）
export function inferWsPath() {
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) continue;
    try { if (fs.statSync(a).isDirectory()) return path.resolve(a); } catch (e) { /* 跳过 */ }
  }
  return process.cwd();
}

// ---- 空库与规范化 ----
export function emptyBoard() {
  return { schemaVersion: 1, revision: 0, tasks: [], deleted: [], links: [] };
}
export function normalizeBoard(b) {
  const out = emptyBoard();
  if (!b || typeof b !== 'object') return out;
  out.schemaVersion = Number(b.schemaVersion) || 1;
  out.revision = Number(b.revision) || 0;
  out.tasks = Array.isArray(b.tasks) ? b.tasks : [];
  out.deleted = Array.isArray(b.deleted) ? b.deleted : [];
  out.links = Array.isArray(b.links) ? b.links : [];
  return out;
}

// ---- 导入源 1：账本 ----
function importLedgerTasks() {
  const out = [];
  const lp = ledgerPath();
  const led = readJSON(lp, null);
  if (!led || !Array.isArray(led.tasks)) return { list: out, ledgerRevision: 0, ok: false };
  for (const t of led.tasks) {
    if (!t || typeof t !== 'object') continue;
    const rec = Object.assign({}, t, {
      id: String(t.id || ('t-' + out.length)),
      title: String(t.title || t.subject || t.prompt || '(未命名任务)'),
      status: normalizeStatus(t.status),
      project: String(t.project || t.projectId || t.proj || ''),
      assignee: String(t.assignee || ''),
      tags: Array.isArray(t.tags) ? t.tags : [],
      createdAt: Number(t.createdAt) || 0,
      updatedAt: Number(t.updatedAt) || Number(t.createdAt) || 0,
      archiveNote: String(t.archiveNote || ''),
      log: Array.isArray(t.log) ? t.log : [],
      wsId: String(t.workspaceId || ''),
      origin: { source: 'ledger', ref: lp, ledgerRevision: Number(led.revision) || 0 },
    });
    out.push(rec);
  }
  return { list: out, ledgerRevision: Number(led.revision) || 0, ok: true };
}

// ---- 导入源 2：团队任务（.agent-teams）----
function importAgentTeamTasks(wsPath) {
  const out = [];
  const root = teamsRoot(wsPath);
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => ({ abs: path.join(root, d.name), id: d.name, archived: false })); } catch (e) { dirs = []; }
  // 归档团队目录
  try {
    const arc = path.join(root, 'archive');
    const subs = fs.readdirSync(arc, { withFileTypes: true }).filter(d => d.isDirectory())
      .map(d => ({ abs: path.join(arc, d.name), id: d.name, archived: true }));
    dirs = dirs.concat(subs);
  } catch (e) { /* 无归档目录 */ }
  for (const d of dirs) {
    const team = readJSON(path.join(d.abs, 'team.json'), null);
    if (!team || !Array.isArray(team.tasks)) continue;
    const teamId = String(team.id || d.id);
    for (const x of team.tasks) {
      if (!x || typeof x !== 'object') continue;
      out.push({
        id: 'at-' + teamId + '-' + String(x.id || 't'),
        title: String(x.subject || x.title || x.id || '(团队任务)'),
        status: normalizeStatus(x.status),
        project: '',
        assignee: String(x.assignee || ''),
        tags: [],
        createdAt: Number(x.createdAt) || 0,
        updatedAt: Number(x.updatedAt) || Number(x.createdAt) || 0,
        archiveNote: '',
        log: [],
        wsId: '',
        output: String(x.output || ''),
        dependencies: Array.isArray(x.dependencies) ? x.dependencies : [],
        teamId, teamTaskId: String(x.id || ''),
        teamArchived: Boolean(d.archived),
        origin: { source: 'agent-teams', ref: path.join(d.abs, 'team.json') },
      });
    }
  }
  return out;
}

// ---- 首次建库 ----
export function importFresh(wsPath) {
  const board = emptyBoard();
  const led = importLedgerTasks();
  board.tasks = led.list;
  // 团队任务追加：id 或归一标题与已有任务重复则跳过（账本优先）
  const seenIds = new Set(board.tasks.map(t => t.id));
  const seenTitles = new Set(board.tasks.map(t => normTitle(t.title)));
  for (const rec of importAgentTeamTasks(wsPath)) {
    if (seenIds.has(rec.id)) continue;
    if (seenTitles.has(normTitle(rec.title))) continue;
    board.tasks.push(rec);
    seenIds.add(rec.id);
    seenTitles.add(normTitle(rec.title));
  }
  // 依赖关系（links.json）并入自有存储
  board.links = readJSON(linksPath(wsPath), { links: [] }).links || [];
  return board;
}

// ---- 读库（容错重建）----
export function readBoard(wsPath) {
  let b = null;
  try {
    if (fs.existsSync(BOARD_PATH)) {
      b = JSON.parse(fs.readFileSync(BOARD_PATH, 'utf8'));
      if (!b || typeof b !== 'object' || !Array.isArray(b.tasks)) b = null;
    }
  } catch (e) {
    b = null;
  }
  if (b) return normalizeBoard(b);
  // 损坏：改名留证，再从源头重建
  if (fs.existsSync(BOARD_PATH)) {
    try {
      fs.renameSync(BOARD_PATH, BOARD_PATH + '.corrupt-' + now());
    } catch (e) { /* 改名失败不阻塞重建 */ }
  }
  const w = wsPath || inferWsPath();
  const fresh = importFresh(w);
  try { writeJSONAtomic(BOARD_PATH, fresh); } catch (e) { /* 首次写失败下次再试 */ }
  return fresh;
}

export function writeBoard(board) {
  const b = normalizeBoard(board);
  writeJSONAtomic(BOARD_PATH, b);
  return b;
}
export function bump(board) {
  board.revision = (Number(board.revision) || 0) + 1;
  return board;
}

// ---- 手动重新导入（/api/resync 与 --resync）----
export function resyncBoard(wsPath) {
  const w = wsPath || inferWsPath();
  const cur = readBoard(w);
  const led = importLedgerTasks();
  const teamList = importAgentTeamTasks(w);
  const imported = led.list.concat(teamList);
  const deletedIds = new Set((cur.deleted || []).map(d => d.id));
  const byId = new Map(cur.tasks.map(t => [t.id, t]));
  const byTitle = new Map(cur.tasks.map(t => [normTitle(t.title), t.id]));
  let added = 0, updated = 0, removed = 0;
  const keep = new Set();
  for (const rec of imported) {
    if (deletedIds.has(rec.id)) continue; // 已删除的不复活
    let key = rec.id;
    if (!byId.has(rec.id)) {
      const dup = byTitle.get(normTitle(rec.title));
      if (dup) key = dup;
    }
    const existed = byId.has(key) || byTitle.has(normTitle(rec.title));
    if (existed && key !== rec.id) {
      // 标题撞车：按已有 id 落位
      byId.set(key, Object.assign({}, rec, { id: key }));
      updated++;
    } else if (existed) {
      byId.set(key, rec);
      updated++;
    } else {
      byId.set(key, rec);
      added++;
    }
    keep.add(key);
    byTitle.set(normTitle(rec.title), key);
  }
  // 账本源任务在账本中已消失 → 移除；local 源保留
  const after = [];
  for (const t of cur.tasks) {
    if (t.origin && t.origin.source === 'ledger') {
      if (keep.has(t.id)) { after.push(byId.get(t.id)); } else { removed++; }
    } else if (t.origin && t.origin.source === 'agent-teams') {
      if (keep.has(t.id)) { after.push(byId.get(t.id)); } else { removed++; }
    } else {
      after.push(t); // local 不动
    }
  }
  cur.tasks = after;
  // 依赖关系更新
  cur.links = readJSON(linksPath(w), { links: [] }).links || [];
  if (added || updated || removed) bump(cur);
  writeBoard(cur);
  return { ok: true, added, updated, removed, revision: cur.revision };
}

// ---- 镜像回写账本（默认开启；账本缺失则跳过；绝不抛错）----
export function mirrorLedger(board, enabled) {
  if (!enabled) return false;
  try {
    const lp = ledgerPath();
    if (!fs.existsSync(lp)) return false;
    const led = readJSON(lp, null);
    if (!led || !Array.isArray(led.tasks)) return false;
    const mirrorable = (board.tasks || []).filter(t => !(t.origin && t.origin.source === 'agent-teams'));
    const delIds = new Set((board.deleted || []).map(d => d.id));
    const stripped = mirrorable
      .filter(t => !delIds.has(t.id))
      .map(t => {
        const r = Object.assign({}, t);
        delete r.origin;
        delete r.wsId;
        delete r.desc;
        delete r.teamId;
        delete r.teamTaskId;
        delete r.teamArchived;
        return r;
      });
    led.tasks = stripped;
    // 账本 revision 单调递增，不回退
    led.revision = (Number(led.revision) || 0) + 1;
    // 与旧 writeLedger 相同的安全写：先备份再临时文件替换
    const bak = lp + '.mirror.bak';
    try { fs.copyFileSync(lp, bak); } catch (e) { /* 备份失败继续 */ }
    writeJSONAtomic(lp, led);
    return true;
  } catch (e) {
    return false;
  }
}
