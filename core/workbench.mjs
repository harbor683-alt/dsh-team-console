// 工作台视图 v2：左竖栏(长期任务) · 中间晾衣绳(左→右) · 右竖栏(已完成) · 下方树状团队
// 用法: node workbench.mjs [workspace] [--demo] [--out file]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultWorkspaceId } from './workspaces.mjs';
import * as store from './store.mjs';

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const STATUS_ALIAS = { pending: 'todo', in_progress: 'running', completed: 'done', cancelled: 'failed' };

function readJSON(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function readJSONL(p) {
  try {
    return fs.readFileSync(p, 'utf8').split(String.fromCharCode(10)).filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// wsId 给了就只返回这个工作区的任务：显式 wsId 命中 + 老任务（没写 wsId）只归默认工作区
// 数据源为自有存储（team-view/data/board.json，store.mjs 首次从账本与团队文件导入；WORKBENCH_BOARD 可换存储位置）
function loadTasks(wsId) {
  const board = store.readBoard();
  const defId = wsId ? defaultWorkspaceId() : null;
  const mine = (board.tasks || []).filter(t => {
    if (!wsId) return true;
    if (t.wsId) return t.wsId === wsId;
    return wsId === defId;
  });
  return mine.map(t => {
    const st = STATUS_ALIAS[t.status] || t.status || 'todo';
    const tags = (t.tags || []).map(x => (x && x.name) || x).filter(Boolean);
    const prio = tags.find(x => /^(p[0-2]|高|中|低)$/i.test(String(x)));
    return {
      id: t.id, title: t.title || t.subject || '(未命名)', status: st, wsId: t.wsId || t.workspaceId || '',
      priority: prio ? String(prio).toUpperCase() : '',
      desc: t.description || t.prompt || '',
      assignee: t.assignee || '',
      progress: st === 'done' || st === 'archived' ? 100 : st === 'running' ? 55 : 0,
      createdAt: t.createdAt || t.updatedAt || 0,
      updatedAt: t.updatedAt || t.createdAt || 0,
      contract: t.contract || null,
      dispatch: t.dispatch || null,
      teamResults: t.teamResults || [],
      // V2 视图透传（三态看板 6.6 数据需求）：tags 原样数组、project 全字段、归档说明/日志/剩余预估
      tags: t.tags || [],
      project: t.project || t.projectId || t.proj || '',
      archiveNote: t.archiveNote || '',
      log: Array.isArray(t.log) ? t.log : [],
      estimate: t.estimate != null ? t.estimate : '',
    };
  });
}

function loadTeams(wsRoot) {
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
    const t = readJSON(path.join(d.dir, 'team.json'), null); if (!t) continue;
    const inbox = fs.existsSync(path.join(d.dir, 'inbox'))
      ? fs.readdirSync(path.join(d.dir, 'inbox')).flatMap(f => readJSONL(path.join(d.dir, 'inbox', f))) : [];
    teams.push({
      id: t.id, name: t.name, description: t.description || '',
      captainSessionId: t.captainSessionId, archived: d.archived,
      members: (t.members || []).map(m => ({
        id: m.id, name: m.name, role: m.role || 'worker',
        model: (m.model || '').split('/').pop(), status: m.status || 'idle',
      })),
      tasks: (t.tasks || []).map(x => ({ id: x.id, subject: x.subject, status: x.status, assignee: x.assignee || '', output: x.output || '', dependencies: x.dependencies || [], createdAt: x.createdAt || 0, updatedAt: x.updatedAt || 0 })),
      messages: inbox.sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-12).map(m => ({ from: m.from, to: m.to, content: m.content, ts: m.ts })),
    });
  }
  return teams;
}

const DEMO_TASKS = [
  { id: 'd1', title: '备份平板分区（system / boot / vendor）', status: 'running', priority: 'P0', assignee: 'assistant-1', desc: '等平板解锁授权 su 后 dd 备份，再 pull 到电脑。', progress: 55, updatedAt: 6 },
  { id: 'd2', title: '刷入 Android 10 GSI 并验证开机', status: 'todo', priority: 'P0', assignee: 'assistant-2', desc: 'fastboot flash system，验证能否进桌面。', progress: 0, updatedAt: 5 },
  { id: 'd3', title: '给导师发进度邮件', status: 'todo', priority: 'P1', assignee: '我', desc: '周三前发，附本周实验记录。', progress: 0, updatedAt: 4 },
  { id: 'd4', title: '整理本周会议纪要', status: 'todo', priority: 'P2', assignee: 'assistant-1', desc: '把三条结论整理成一页。', progress: 0, updatedAt: 3 },
  { id: 'd5', title: '写周报', status: 'done', priority: 'P1', assignee: '我', desc: '已提交。', progress: 100, updatedAt: 2 },
  { id: 'd6', title: '学完数学物理方法（长期）', status: 'backlog', priority: '', assignee: '', desc: '长期目标：每周两章。', progress: 0, updatedAt: 1 },
  { id: 'd7', title: '整理机械工作台题解库', status: 'backlog', priority: '', assignee: '', desc: '长期目标。', progress: 0, updatedAt: 1 },
  { id: 'd8', title: '把平板刷机过程写成文档', status: 'todo', priority: 'P1', assignee: 'assistant-1', desc: '步骤 + 踩坑记录。', progress: 0, updatedAt: 3 },
  { id: 'd9', title: '对比三家 GSI 的兼容性', status: 'todo', priority: 'P2', assignee: 'assistant-2', desc: 'LineageOS / PixelExperience / Havoc。', progress: 0, updatedAt: 2 },
  { id: 'd10', title: '给晾衣绳加拖拽动画', status: 'running', priority: 'P2', assignee: '我', desc: '拖起来有回弹。', progress: 30, updatedAt: 2 },
];
const DEMO_TEAMS = [
  {
    id: 't1', name: '刷机小分队', description: '平板改造：备份 → GSI → 调驱动', archived: false, captainSessionId: 'session-demo-1',
    members: [
      { id: 'm0', name: '主控', role: 'captain', model: 'deepseek-flash', status: 'working' },
      { id: 'm1', name: 'assistant-lead', role: 'lead', model: 'deepseek-flash', status: 'working' },
      { id: 'm2', name: 'assistant-1', role: 'worker', model: 'deepseek-flash', status: 'working' },
      { id: 'm3', name: 'assistant-2', role: 'worker', model: 'deepseek-flash', status: 'idle' },
      { id: 'm4', name: 'reviewer-1', role: 'reviewer', model: 'deepseek-v4-pro', status: 'idle' },
    ],
    tasks: [
      { id: 'k1', subject: '备份 system 分区', status: 'running', assignee: 'assistant-1' },
      { id: 'k2', subject: '下载 GSI 镜像', status: 'completed', assignee: 'assistant-2', output: 'lineage-17.1-arm64-aonly' },
      { id: 'k3', subject: '复核刷机步骤', status: 'pending', assignee: 'reviewer-1' },
    ],
    messages: [
      { from: 'assistant-1', to: 'captain', content: 't1 完成：当前目录 D:/your-workspace', ts: 1 },
      { from: 'captain', to: 'assistant-lead', content: '先把 system 分区 dd 出来再动 GSI', ts: 2 },
      { from: 'assistant-2', to: 'captain', content: 'GSI 镜像下好了，校验和匹配', ts: 3 },
    ],
  },
  {
    id: 't2', name: '论文润色组', description: '把语音稿整理成结构化提示词', archived: false, captainSessionId: 'session-demo-2',
    members: [
      { id: 'n0', name: '主控', role: 'captain', model: 'deepseek-flash', status: 'idle' },
      { id: 'n1', name: 'assistant-3', role: 'worker', model: 'deepseek-flash', status: 'idle' },
    ],
    tasks: [{ id: 'k4', subject: '润色第三章', status: 'completed', assignee: 'assistant-3', output: '已输出 Markdown' }],
    messages: [{ from: 'assistant-3', to: 'captain', content: '第三章润色完成，标点与术语已统一', ts: 1 }],
  },
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(wsRoot, opts = {}) {
  const tasks = opts.demo ? DEMO_TASKS : loadTasks();
  const teams = opts.demo ? DEMO_TEAMS : loadTeams(wsRoot);
  const rank = t => ({ P0: 0, '高': 0, P1: 1, '中': 1, P2: 2, '低': 2 }[t.priority] ?? 3);
  const backlog = tasks.filter(t => t.status === 'backlog').sort((a, b) => b.updatedAt - a.updatedAt);
  const rope = tasks.filter(t => t.status === 'todo' || t.status === 'running')
    .sort((a, b) => rank(a) - rank(b) || a.updatedAt - b.updatedAt);
  const done = tasks.filter(t => t.status === 'done' || t.status === 'failed').sort((a, b) => b.updatedAt - a.updatedAt);

  const prioClass = t => (t.priority === 'P0' || t.priority === '高') ? 'p0' : (t.priority === 'P1' || t.priority === '中') ? 'p1' : t.priority ? 'p2' : '';

  const railCard = (t) => `<div class="rcard ${prioClass(t)}" draggable="true" data-id="${esc(t.id)}" title="${esc(t.title)}">
      <div class="rt">${esc(t.title)}</div>
      <div class="rm">${esc(t.assignee || '未指派')}${t.priority ? ' · ' + esc(t.priority) : ''}</div>
    </div>`;

  const cloth = (t) => `<div class="hanger" draggable="true" data-id="${esc(t.id)}" title="${esc(t.title)}">
      <div class="pin"></div>
      <div class="cloth ${prioClass(t)}">
        <div class="t">${esc(t.title)}</div>
        <div class="m">${esc(t.assignee || '未指派')}${t.priority ? ' · ' + esc(t.priority) : ''}</div>
        <div class="bar"><i style="width:${t.progress}%;background:${t.status === 'done' ? 'var(--done)' : t.status === 'failed' ? 'var(--bad)' : 'var(--run)'}"></i></div>
        <button class="donebtn" data-id="${esc(t.id)}" title="做完，拿下来">✓</button>
        <div class="pop">${esc(t.desc || t.title).slice(0, 240)}</div>
      </div></div>`;

  const teamsHtml = teams.map((t, i) => {
    const node = (m) => `<div class="node ${m.status === 'working' ? 'run' : ''}" data-team="${i}" data-mid="${esc(m.id)}">
        <div class="avatar">${esc((m.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="nm">${esc(m.name)}</div>
        <div class="sub">${esc(m.role)}${m.model ? ' · ' + esc(m.model) : ''}</div>
        <div class="st ${m.status === 'working' ? 'on' : ''}"></div></div>`;
    const leads = t.members.filter(m => m.role === 'lead');
    const workers = t.members.filter(m => m.role === 'worker');
    const reviewers = t.members.filter(m => (m.role || '').includes('review'));
    const tier = (label, arr) => arr.length ? `<div class="tier"><div class="tier-label">${label}</div><div class="row">${arr.map(node).join('')}</div></div>` : '';
    return `<section class="team-block">
      <div class="team-head"><b>${esc(t.name)}</b><span class="muted">${esc(t.description)}</span>${t.archived ? '<span class="pill">已归档</span>' : ''}</div>
      <div class="tree">
        <div class="node boss ${t.archived ? 'archived' : ''}" data-team="${i}">
          <div class="avatar">主</div><div class="nm">主控 / 老板</div>
          <div class="sub">${t.members.length} 成员 · ${t.tasks.length} 任务</div></div>
        <div class="stem"></div>
        ${tier('领导', leads)}${tier('员工', workers)}${tier('审查', reviewers)}
      </div></section>`;
  }).join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>工作台</title>
<style>
:root{--ink:#1c1f24;--muted:#8a919c;--line:#e6e8ec;--bg:#f7f8fa;--card:#fff;--run:#3b6cf6;--done:#12b76a;--bad:#f04438;--warn:#f79009}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wbnav{display:flex;gap:8px;padding:12px 24px 0;max-width:1280px;margin:0 auto}.wbnav a{padding:5px 11px;border-radius:999px;border:1px solid #e2e6ee;background:#fff;color:#475569;text-decoration:none;font-size:12px}.wbnav a.on{background:#111827;color:#fff;border-color:#111827}
.wrap{max-width:1280px;margin:0 auto;padding:18px 24px 70px}
h1{font-size:17px;margin:0 0 2px}.sub{color:var(--muted);font-size:12px}
.hint{color:var(--muted);font-size:12px;margin:6px 0 2px}
.bench{display:grid;grid-template-columns:150px minmax(0,1fr) 150px;gap:0;margin:16px 0 4px;min-height:250px}
.rail{display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding-bottom:26px}
.rail.left{align-items:flex-start;justify-content:flex-start}.rail.right{align-items:flex-end}
.rail-title{font-size:11px;color:#8a919c;letter-spacing:.06em;margin-bottom:2px;text-align:center;width:100%}
.rail-list{display:flex;flex-direction:column-reverse;gap:8px;width:100%;min-height:60px}
.rail.right .rail-list{flex-direction:column;justify-content:flex-start}
.rcard{background:#fff;border:1px solid var(--line);border-left:3px solid #c9ced8;border-radius:8px;padding:7px 9px;cursor:grab;width:100%;box-shadow:0 1px 4px rgba(20,30,60,.04)}
.rcard.p0{border-left-color:var(--bad)}.rcard.p1{border-left-color:var(--warn)}.rcard.p2{border-left-color:#c9ced8}
.rcard .rt{font-size:12px;font-weight:600;line-height:1.35}
.rcard .rm{font-size:10px;color:var(--muted);margin-top:2px}
.rope-wrap{position:relative;padding:0 10px;min-width:0}
.rope{position:absolute;left:6px;right:6px;top:82px;height:2px;background:linear-gradient(90deg,#d7dbe2,#b9c0cb 8%,#b9c0cb 92%,#d7dbe2)}
.rope::before,.rope::after{content:"";position:absolute;top:-5px;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #b9c0cb}
.rope::before{left:-6px}.rope::after{right:-6px}
.rope-tip{position:absolute;top:58px;left:10px;font-size:11px;color:#a2a8b3}
.rope-tip.r{left:auto;right:10px}
.line{display:flex;gap:14px;align-items:flex-start;justify-content:flex-start;padding:46px 8px 0 18px;min-height:210px;flex-wrap:nowrap;overflow:visible}
.hanger{transition:transform .12s}
.hanger:hover{z-index:99 !important;transform:translateY(-4px)}
.line.over{background:rgba(59,108,246,.04);outline:2px dashed #bcd0ff;outline-offset:-6px;border-radius:12px}
.hanger{padding-top:20px;position:relative;cursor:grab}
.pin{position:absolute;top:0;left:50%;width:3px;height:20px;background:#c9ced8;border-radius:2px}
.pin::after{content:"";position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:9px;height:9px;border-radius:2px;background:#aeb5c2}
.cloth{background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 11px;width:176px;box-shadow:0 2px 6px rgba(20,30,60,.05);position:relative;transition:.12s}
.cloth:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,50,110,.1)}
.cloth .t{font-weight:600;font-size:13px;line-height:1.35;margin-bottom:3px}
.cloth .m{font-size:11px;color:var(--muted)}
.cloth .bar{height:4px;border-radius:3px;background:#eef1f5;margin-top:7px;overflow:hidden}
.cloth .bar i{display:block;height:100%;border-radius:3px}
.cloth.p0{border-top:3px solid var(--bad)}.cloth.p1{border-top:3px solid var(--warn)}.cloth.p2{border-top:3px solid #c9ced8}
.cloth .pop{display:none;position:absolute;left:0;top:100%;margin-top:8px;width:250px;background:#1f2430;color:#e9edf5;font-size:12px;padding:9px 11px;border-radius:8px;z-index:9;line-height:1.5}
.cloth:hover .pop{display:block}
.empty{color:var(--muted);font-size:12px;padding:60px 0;text-align:center;width:100%}
.toolbar{display:flex;align-items:center;gap:10px;margin:12px 0 2px}
.tbtn{border:1px solid #d8e0f5;background:#f5f8ff;color:#2f5fe0;border-radius:9px;padding:7px 13px;font-size:13px;cursor:pointer}
.tbtn:hover{background:#eaf0ff}
.tnote{color:#a2a8b3;font-size:12px}
.donebtn{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;border:1px solid #dfe4ec;background:#fff;color:#12b76a;font-size:12px;line-height:1;cursor:pointer;opacity:0;transition:.12s}
.cloth:hover .donebtn{opacity:1}
.donebtn:hover{background:#e9fbf2;border-color:#9fe3c2}
.sect{display:flex;align-items:baseline;gap:10px;margin:26px 0 10px}
.sect b{font-size:15px}.sect .muted{font-size:12px;color:var(--muted)}
.team-block{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px 20px;margin-bottom:14px}
.team-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.team-head .muted{color:var(--muted);font-size:12px}
.pill{font-size:11px;padding:2px 7px;border-radius:20px;background:#f1f3f7;color:#5b6472}
.tree{display:flex;flex-direction:column;align-items:center}
.node{background:#fbfcfe;border:1px solid #e9edf4;border-radius:12px;padding:10px 14px;min-width:132px;text-align:center;cursor:pointer;position:relative;transition:.12s}
.node:hover{border-color:#c9d4f8;box-shadow:0 6px 18px rgba(30,50,110,.08)}
.node.run{border-color:#bcd0ff;background:#f7faff}.node.archived{opacity:.75}
.node .avatar{width:30px;height:30px;border-radius:9px;background:#e8edfb;color:#3b6cf6;display:grid;place-items:center;margin:0 auto 6px;font-weight:600;font-size:13px}
.node.boss .avatar{background:#fff1e6;color:#d97706}
.node .nm{font-size:13px;font-weight:600}.node .sub{font-size:11px;color:var(--muted);margin-top:2px}
.node .st{position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:50%;background:#d7dbe2}
.node .st.on{background:var(--done)}
.stem{width:2px;height:18px;background:#dfe3ea}
.tier{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:2px}
.tier-label{font-size:11px;color:#a2a8b3;letter-spacing:.08em}
.row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.drawer{position:fixed;right:0;top:0;height:100%;width:380px;background:#fff;border-left:1px solid var(--line);box-shadow:-10px 0 30px rgba(20,30,60,.08);transform:translateX(100%);transition:.2s;z-index:20;display:flex;flex-direction:column}
.drawer.open{transform:none}
.drawer header{padding:16px 18px;border-bottom:1px solid #eef1f6;display:flex;align-items:center;gap:10px}
.drawer .body{padding:14px 18px;overflow:auto;font-size:13px}
.drawer h4{margin:14px 0 6px;font-size:11px;color:var(--muted);letter-spacing:.06em}
.drawer .kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #f0f2f6;font-size:12px}
.drawer .msg{font-size:12px;padding:6px 0;border-bottom:1px dashed #f0f2f6;color:#3f4756}
.drawer .msg .from{color:var(--run);font-weight:600}
.drawer .close{margin-left:auto;cursor:pointer;color:var(--muted);border:0;background:none;font-size:18px}
.drawer .btn{margin-top:16px;display:block;width:100%;padding:9px;border-radius:9px;border:1px solid #d8e0f5;background:#f5f8ff;color:#2f5fe0;cursor:pointer;font-size:13px}
.folder-pile{position:relative;width:132px;cursor:pointer;text-align:center;padding:6px 0 2px;border-radius:12px;transition:.12s}
.folder-pile:hover{background:#f2f5fb}
.folder-pile.over{outline:2px dashed #9db8ff;outline-offset:2px}
.folder-pile .pile{position:relative;height:74px;margin:0 auto;width:104px}
.folder-pile .pcard{position:absolute;left:0;width:104px;height:34px;border-radius:8px;background:#fff;border:1px solid #e3e7ee;box-shadow:0 2px 6px rgba(20,35,80,.06)}
.folder-pile .p3{top:0;transform:rotate(-4deg);opacity:.75}
.folder-pile .p2{top:14px;transform:rotate(2deg);opacity:.9}
.folder-pile .p1{top:28px;background:linear-gradient(180deg,#fffdf6,#fff7e6);border-color:#f0dfb8}
.folder-pile .pnum{position:absolute;left:0;right:0;top:36px;font-size:18px;font-weight:700;color:#a8741a}
.folder-pile .fname{font-size:11px;color:#8a919c;margin-top:2px}
.fv{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.4);display:none;align-items:center;justify-content:center}
.fv.open{display:flex}
.fv-panel{position:relative;width:min(880px,92vw);height:min(600px,86vh);background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}
.fv-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #eef0f4}
.fv-head b{font-size:15px}.fv-head .n{color:#8a919c;font-size:12px}
.fv-head .x{margin-left:auto;border:0;background:transparent;font-size:20px;color:#64748b;cursor:pointer}
.fv-grid{flex:1;overflow:auto;padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;align-content:start}
.fv-card{position:relative;border:1px solid #e6e8ec;border-radius:12px;padding:10px 12px 34px;background:#fff;box-shadow:0 2px 8px rgba(20,35,80,.05)}
.fv-card .ft{font-size:13px;font-weight:600;margin-bottom:4px}
.fv-card .fm{font-size:11px;color:#8a919c}
.fv-card .fbar{height:3px;border-radius:2px;background:#eef0f4;margin-top:8px;overflow:hidden}
.fv-card .fbar i{display:block;height:100%;background:#12b76a}
.fv-card .ry{position:absolute;right:8px;bottom:8px;font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid #dfe4ec;background:#fff;color:#3b6cf6;cursor:pointer}
.fv-card .ry:hover{background:#f0f5ff;border-color:#c7d7ff}
.fv-foot{display:flex;justify-content:flex-end;padding:12px 18px;border-top:1px solid #eef0f4;gap:8px}
.fv-foot .restoreAll{font-size:12px;padding:7px 14px;border-radius:9px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer}
.fv-foot .restoreAll:hover{background:#1f2937}
footer{margin-top:30px;color:#a2a8b3;font-size:11px;text-align:center}
</style></head><body>
<div style="max-width:1280px;margin:0 auto;padding:12px 24px 0"><div style="display:inline-flex;gap:4px;padding:5px;background:#fff;border:1px solid #e6e8ec;border-radius:999px;box-shadow:0 2px 10px rgba(15,23,42,.06)"><a href="http://127.0.0.1:8787/" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;background:#111827;color:#fff">🧺 晾衣绳工作台</a><a href="http://127.0.0.1:8787/?view=console" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;color:#475569">🧭 团队控制台</a><a href="http://127.0.0.1:8787/?view=orchestra" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;color:#475569">🛰️ 编排视图</a></div></div>
<div class="wrap">
  <h1>工作台</h1>
  <div class="sub">任务：长期任务挂两端 · 要做的从左到右挂绳上 · 拖下绳子 = 完成 · 窗口变窄时卡片自动叠起，鼠标移上去会弹开</div>
  <div class="hint">${opts.demo ? '示例数据（只看长相，不是真实任务）' : '数据来自 task-board 账本与 .agent-teams'} · 拖拽试试：左栏 → 绳子 = 开始做；绳子 → 右栏 = 完成</div>
  <div class="toolbar"><button id="addTask" class="tbtn">＋ 新建任务</button><span class="tnote">新建后自动挂到绳子上；卡片右上角「✓」= 做完拿下来</span></div>

  <div class="bench">
    <aside class="rail left">
      <div class="rail-title">📁 长期任务</div>
      <div class="folder-pile left" id="backlog" title="点击打开长期任务文件夹">
        <div class="pile"><span class="pcard p3"></span><span class="pcard p2"></span><span class="pcard p1"></span><span class="pnum">${backlog.length}</span></div>
        <div class="fname">长期任务</div>
      </div>
    </aside>

    <main class="rope-wrap">
      <div class="rope"></div>
      <div class="rope-tip">要做的 →</div>
      <div class="line" id="line">${rope.length ? rope.map(cloth).join('') : '<div class="empty">绳子上还没有任务 — 从左边拖一件挂上来</div>'}</div>
    </main>

    <aside class="rail right">
      <div class="rail-title">🗂️ 归档 / 完成</div>
      <div class="folder-pile" id="done" title="点击打开归档文件夹">
        <div class="pile"><span class="pcard p3"></span><span class="pcard p2"></span><span class="pcard p1"></span><span class="pnum">${done.length}</span></div>
        <div class="fname">归档文件夹</div>
      </div>
    </aside>
  </div>

  <div class="sect"><b>智能体团队</b><span class="muted">${teams.length} 个 · 点节点看详情</span></div>
  ${teams.length ? teamsHtml : '<div class="empty">还没有团队</div>'}
  <footer>生成于 ${new Date().toLocaleString('zh-CN')} · node workbench.mjs 重新生成</footer>
</div>

<div class="fv" id="folderView">
  <div class="fv-panel">
    <div class="fv-head"><b id="fvTitle">🗂️ 归档</b><span class="n" id="fvCount"></span><button class="x" id="fvClose">×</button></div>
    <div class="fv-grid" id="fvGrid"></div>
    <div class="fv-foot"><button class="restoreAll" id="restoreAll">↩ 全部还原到绳子</button></div>
  </div>
</div>
<div class="drawer" id="drawer"><header><b id="dtitle">详情</b><button class="close" onclick="document.getElementById('drawer').classList.remove('open')">×</button></header><div class="body" id="dbody"></div></div>

<script>
const ONLY_TEAMS = new URLSearchParams(location.search).get('view') === 'teams';
if (ONLY_TEAMS) {
  document.querySelectorAll('h1, .sub, .hint, .toolbar, .bench, footer').forEach(el => el.remove());
}
const addBtn = document.getElementById('addTask');
if (addBtn) addBtn.addEventListener('click', async () => {
  const title = prompt('新任务的名字（会直接挂到绳子上）');
  if (!title || !title.trim()) return;
  await sync({ action: 'create', title: title.trim(), priority: 'P2' });
  location.reload();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.donebtn');
  if (!b) return;
  e.stopPropagation();
  await sync({ action: 'move', id: b.dataset.id, to: 'done' });
  location.reload();
});
const TEAMS = ${JSON.stringify(teams)};
const DONE = ${JSON.stringify(done)};
const BACKLOG = ${JSON.stringify(backlog)};
let dragEl = null;
document.addEventListener('dragstart', e => {
  const h = e.target.closest('[draggable="true"]');
  if (!h) return; dragEl = h; e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', h.dataset.id || ''); } catch {}
});
const line = document.getElementById('line');
const doneEl = document.getElementById('done');
if (line && doneEl) {

function clearEmpty(box){ const e = box.querySelector('.empty'); if(e) e.remove(); }
line.addEventListener('dragover', e => { e.preventDefault(); line.classList.add('over'); });
line.addEventListener('dragleave', () => line.classList.remove('over'));
line.addEventListener('drop', e => {
  e.preventDefault(); line.classList.remove('over');
  if (!dragEl) return; clearEmpty(line); clearEmpty(doneEl);
  dragEl.classList.add('hanger'); dragEl.classList.remove('rcard');
  if (!dragEl.querySelector('.pin')) {
    const pin = document.createElement('div'); pin.className = 'pin';
    const cloth = document.createElement('div'); cloth.className = 'cloth';
    cloth.innerHTML = '<div class="t">' + (dragEl.querySelector('.rt')?.textContent || '') + '</div>' +
      '<div class="m">' + (dragEl.querySelector('.rm')?.textContent || '') + '</div>' +
      '<div class="bar"><i style="width:10%;background:var(--run)"></i></div>' +
      '<div class="pop">刚挂上绳子</div>';
    dragEl.innerHTML = ''; dragEl.appendChild(pin); dragEl.appendChild(cloth);
    dragEl.style.display = ''; dragEl.style.width = '';
  }
  sync({ action:'move', id: dragEl.dataset.id, to:'line' });
  line.appendChild(dragEl); dragEl = null;
});
doneEl.addEventListener('dragover', e => { e.preventDefault(); doneEl.classList.add('over'); });
doneEl.addEventListener('dragleave', () => doneEl.classList.remove('over'));
doneEl.addEventListener('drop', async e => {
  e.preventDefault(); doneEl.classList.remove('over');
  if (!dragEl) return;
  await sync({ action:'move', id: dragEl.dataset.id, to:'done' });
  location.reload();
});
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
let FV_KIND = 'done';
function folderList(kind){ return kind === 'backlog' ? BACKLOG : DONE; }
function renderFolder(kind){
  FV_KIND = kind || FV_KIND;
  const list = folderList(FV_KIND);
  const g = document.getElementById('fvGrid');
  if (!g) return;
  document.getElementById('fvTitle').textContent = FV_KIND === 'backlog' ? '📁 长期任务' : '🗂️ 归档';
  document.getElementById('fvCount').textContent = '共 ' + list.length + ' 件';
  g.innerHTML = list.length ? list.map(t => '<div class="fv-card">' +
      '<div class="ft">' + esc(t.title) + '</div>' +
      '<div class="fm">' + esc(t.assignee || '未指派') + ' · ' + esc(t.priority || '') + ' · ' + (t.status === 'failed' ? '失败' : FV_KIND === 'backlog' ? '长期' : '完成') + '</div>' +
      '<div class="fbar"><i style="width:100%;background:' + (FV_KIND === 'backlog' ? '#f79009' : '#12b76a') + '"></i></div>' +
      '<button class="ry" data-id="' + esc(t.id) + '">↩ 挂到绳子</button>' +
    '</div>').join('') : '<div class="empty">文件夹是空的</div>';
  g.querySelectorAll('.ry').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    await sync({ action: 'move', id: b.dataset.id, to: 'line' });
    location.reload();
  }));
}
const fv = document.getElementById('folderView');
const doneFolder = document.getElementById('done');
const backlogFolder = document.getElementById('backlog');
if (doneFolder) doneFolder.addEventListener('click', () => { renderFolder('done'); fv.classList.add('open'); });
if (backlogFolder) backlogFolder.addEventListener('click', () => { renderFolder('backlog'); fv.classList.add('open'); });
document.getElementById('fvClose').addEventListener('click', () => fv.classList.remove('open'));
fv.addEventListener('click', e => { if (e.target === fv) fv.classList.remove('open'); });
document.getElementById('restoreAll').addEventListener('click', async () => {
  for (const t of folderList(FV_KIND)) await sync({ action: 'move', id: t.id, to: 'line' });
  location.reload();
});

async function sync(payload){
  if (!/^https?:/.test(location.protocol)) return;
  try { await fetch('/api/action', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }); }
  catch (e) { console.warn('sync failed', e); }
}function openTeam(i){ const t = TEAMS[i]; const d=document.getElementById('drawer'), b=document.getElementById('dbody');
  document.getElementById('dtitle').textContent = t.name;
  b.innerHTML = '<div style="color:#8a919c;font-size:12px">'+(t.description||'')+'</div>'+
    '<h4>成员</h4>'+t.members.map(m=>'<div class="kv"><span>'+m.name+' · '+m.role+'</span><span style="color:#8a919c">'+m.status+'</span></div>').join('')+
    '<h4>任务</h4>'+(t.tasks.length?t.tasks.map(x=>'<div class="kv"><span>'+x.subject+'</span><span style="color:#8a919c">'+x.status+'</span></div>').join(''):'<div style="color:#a2a8b3;font-size:12px">暂无任务</div>')+
    '<h4>消息</h4>'+(t.messages.length?t.messages.map(m=>'<div class="msg"><span class="from">'+m.from+'</span> → '+m.to+'：'+String(m.content||'').slice(0,140)+'</div>').join(''):'<div style="color:#a2a8b3;font-size:12px">暂无消息</div>')+
    (t.captainSessionId?'<button class="btn" onclick="alert('+String.fromCharCode(39)+'会话：'+t.captainSessionId+String.fromCharCode(39)+')">打开主控会话</button>':'');
  d.classList.add('open');
}
function openMember(i,mid){ const t=TEAMS[i]; const m=t.members.find(x=>x.id===mid); if(!m)return; const d=document.getElementById('drawer'), b=document.getElementById('dbody');
  document.getElementById('dtitle').textContent=m.name;
  const mt=t.tasks.filter(x=>x.assignee===m.name||x.assignee===m.id);
  b.innerHTML='<div style="color:#8a919c;font-size:12px">'+m.role+' · '+(m.model||'')+'</div>'+
    '<h4>状态</h4><div class="kv"><span>当前</span><span>'+m.status+'</span></div>'+
    '<h4>负责的任务</h4>'+(mt.length?mt.map(x=>'<div class="kv"><span>'+x.subject+'</span><span style="color:#8a919c">'+x.status+'</span></div>').join(''):'<div style="color:#a2a8b3;font-size:12px">暂无</div>')+
    '<h4>最近消息</h4>'+(t.messages.filter(x=>x.from===m.name||x.to===m.name).slice(-5).map(x=>'<div class="msg"><span class="from">'+x.from+'</span> → '+x.to+'：'+String(x.content||'').slice(0,140)+'</div>').join('')||'<div style="color:#a2a8b3;font-size:12px">暂无</div>')+
    '<button class="btn" onclick="alert('+String.fromCharCode(39)+'演示：这里会打开 '+m.name+' 的对话窗口'+String.fromCharCode(39)+')">打开 TA 的对话窗口</button>';
  d.classList.add('open');
}
function layoutLine(){
  if (!line) return;
  const items=[...line.querySelectorAll('.hanger')]; if(!items.length) return;
  const cw=180, gap=14, avail=line.clientWidth-26, n=items.length;
  const need=n*cw+(n-1)*gap;
  const step = need<=avail ? cw+gap : Math.max(20,(avail-cw)/(n-1));
  items.forEach((el,i)=>{ el.style.marginLeft = i===0?'0px':(step-cw-gap)+'px'; el.style.zIndex=10+i; });
}
layoutLine(); window.addEventListener('resize', layoutLine);
document.querySelectorAll('.node').forEach(n=>{ n.addEventListener('click',()=>{
  const i=+n.dataset.team; if(n.dataset.mid) openMember(i,n.dataset.mid); else openTeam(i);
});});
</script></body></html>`;
}

// CLI 模式：仅在直接执行本文件时生成静态 HTML（被 serve-workbench.mjs import 时不产生副作用）
const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const args = process.argv.slice(2);
  const demo = args.includes('--demo');
  const ws = args.find(a => !a.startsWith('--') && !/[.](html|json)$/.test(a)) || process.cwd();
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(ws, 'team-view', demo ? 'workbench-demo.html' : 'workbench.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(ws, { demo }), 'utf8');
  console.log('written', out, fs.statSync(out).size, 'bytes');
}
export { render, loadTasks, loadTeams };








