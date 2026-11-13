// 数据装载：任务（本地 board.json）与团队（<ws>/.agent-teams/*/team.json）。
// 从旧 workbench.mjs 抽出来，供 serve-workbench 与各视图共用。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { defaultWorkspaceId } from './workspaces.mjs';
import * as store from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 团队中文名映射（按团队 id 或原始 name）；没有映射的团队仍显示原名
let LABELS = {};
try { LABELS = JSON.parse(fs.readFileSync(path.join(HERE, 'team-labels.json'), 'utf8')); } catch { /* optional */ }

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const STATUS_ALIAS = { pending: 'todo', in_progress: 'running', completed: 'done', cancelled: 'failed' };

function readJSON(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function readJSONL(p) {
  try {
    return fs.readFileSync(p, 'utf8').split(String.fromCharCode(10)).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// wsId 给了就只返回这个工作区的任务：显式 wsId 命中 + 老任务（没写 wsId）只归默认工作区
export function loadTasks(wsId) {
  const board = store.readBoard();
  const defId = wsId ? defaultWorkspaceId() : null;
  const mine = (board.tasks || []).filter((t) => {
    if (!wsId) return true;
    if (t.wsId) return t.wsId === wsId;
    return wsId === defId;
  });
  return mine.map((t) => {
    const st = STATUS_ALIAS[t.status] || t.status || 'todo';
    const tags = (t.tags || []).map((x) => (x && x.name) || x).filter(Boolean);
    const prio = tags.find((x) => /^(p[0-2]|高|中|低)$/i.test(String(x)));
    return {
      id: t.id, title: t.title || t.subject || '(未命名)', status: st,
      wsId: t.wsId || t.workspaceId || '',
      priority: prio ? String(prio).toUpperCase() : '',
      desc: t.description || t.prompt || '',
      assignee: t.assignee || '',
      progress: st === 'done' || st === 'archived' ? 100 : st === 'running' ? 55 : 0,
      createdAt: t.createdAt || t.updatedAt || 0,
      updatedAt: t.updatedAt || t.createdAt || 0,
      contract: t.contract || null,
      dispatch: t.dispatch || null,
      teamResults: t.teamResults || [],
      tags: t.tags || [],
      project: t.project || t.projectId || t.proj || '',
      archiveNote: t.archiveNote || '',
      log: Array.isArray(t.log) ? t.log : [],
      estimate: t.estimate != null ? t.estimate : '',
    };
  });
}

export function loadTeams(wsRoot) {
  const root = path.join(wsRoot, '.agent-teams');
  const dirs = [];
  try {
    for (const n of fs.readdirSync(root)) {
      if (n === 'archive') continue;
      if (fs.existsSync(path.join(root, n, 'team.json'))) dirs.push({ dir: path.join(root, n), archived: false });
    }
    const arch = path.join(root, 'archive');
    if (fs.existsSync(arch)) for (const n of fs.readdirSync(arch)) {
      if (fs.existsSync(path.join(arch, n, 'team.json'))) dirs.push({ dir: path.join(arch, n), archived: true });
    }
  } catch { /* none */ }
  const teams = [];
  for (const d of dirs) {
    const t = readJSON(path.join(d.dir, 'team.json'), null);
    if (!t) continue;
    const inbox = fs.existsSync(path.join(d.dir, 'inbox'))
      ? fs.readdirSync(path.join(d.dir, 'inbox')).flatMap((f) => readJSONL(path.join(d.dir, 'inbox', f)))
      : [];
    teams.push({
      id: t.id, name: LABELS[t.id] || LABELS[t.name] || t.name, slug: t.id || t.name,
      rawName: t.name, description: t.description || '',
      captainSessionId: t.captainSessionId, archived: d.archived,
      members: (t.members || []).map((m) => ({
        id: m.id, name: m.name, role: m.role || 'worker',
        model: (m.model || '').split('/').pop(), status: m.status || 'idle',
      })),
      tasks: (t.tasks || []).map((x) => ({
        id: x.id, subject: x.subject, status: x.status, assignee: x.assignee || '',
        output: x.output || '', dependencies: x.dependencies || [],
        createdAt: x.createdAt || 0, updatedAt: x.updatedAt || 0,
      })),
      messages: inbox.sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-12)
        .map((m) => ({ from: m.from, to: m.to, content: m.content, ts: m.ts })),
    });
  }
  return teams;
}
