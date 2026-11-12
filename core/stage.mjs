// 工作台 v4：单页（无分栏导航）· 绳子可左右拖 · 团队竖向 + 调用连线 · 时间轨道带交叉线
// 用法: node stage.mjs [workspace] [--demo] [--out file]
import fs from 'node:fs';
import path from 'node:path';
import { loadTasks, loadTeams } from './workbench.mjs';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DEMO_TASKS = [
  { id: 'd1', title: '备份 system / boot / vendor', status: 'running', assignee: 'assistant-1', priority: 'P0', progress: 60, createdAt: 1794400000000, updatedAt: 1794400100000 },
  { id: 'd2', title: '刷入 Android 10 GSI 并验证开机', status: 'todo', assignee: 'assistant-2', priority: 'P1', progress: 0, createdAt: 1794400200000, updatedAt: 1794400200000 },
  { id: 'd3', title: '把刷机过程写成文档', status: 'todo', assignee: 'assistant-1', priority: 'P1', progress: 0, createdAt: 1794400300000, updatedAt: 1794400300000 },
  { id: 'd4', title: '给导师发进度邮件', status: 'todo', assignee: '我', priority: 'P1', progress: 0, createdAt: 1794400400000, updatedAt: 1794400400000 },
  { id: 'd5', title: '整理本周会议纪要', status: 'done', assignee: 'assistant-1', priority: 'P2', progress: 100, createdAt: 1794400500000, updatedAt: 1794400600000 },
  { id: 'd6', title: '整理机械工作台题库', status: 'backlog', assignee: '', priority: '', progress: 0, createdAt: 1794400700000, updatedAt: 1794400700000 },
];

const DEMO_TEAMS = [
  {
    id: 'demo-team', name: '刷机小分队', description: '平板改造：备份 → GSI → 调驱动', archived: false, captainSessionId: '',
    members: [
      { id: 'm1', name: 'assistant-lead', role: 'lead', model: 'deepseek-flash', status: 'working' },
      { id: 'm2', name: 'assistant-1', role: 'worker', model: 'deepseek-flash', status: 'working' },
      { id: 'm3', name: 'assistant-2', role: 'worker', model: 'deepseek-flash', status: 'idle' },
      { id: 'm4', name: 'reviewer-1', role: 'reviewer', model: 'deepseek-v4-pro', status: 'idle' },
    ],
    tasks: [
      { id: 'k1', subject: '备份 system / boot / vendor', status: 'running', assignee: 'assistant-1', dependencies: [] },
      { id: 'k2', subject: '下载 Android 10 GSI 镜像', status: 'completed', assignee: 'assistant-2', dependencies: [] },
      { id: 'k3', subject: '刷入 GSI 并验证开机', status: 'pending', assignee: 'assistant-1', dependencies: ['k1', 'k2'] },
      { id: 'k4', subject: '写刷机记录文档', status: 'completed', assignee: 'assistant-2', dependencies: ['k2'] },
      { id: 'k5', subject: '复核刷机步骤', status: 'pending', assignee: 'reviewer-1', dependencies: ['k3'] },
    ],
  },
];

function normTask(t) {
  const status = t.status || 'todo';
  return {
    id: t.id,
    title: t.title || t.subject || '(无标题)',
    status,
    assignee: t.assignee || '',
    priority: (t.tags && t.tags[0] && t.tags[0].name) || t.priority || '',
    progress: status === 'done' ? 100 : status === 'running' ? 55 : 0,
    createdAt: t.createdAt || 0,
    updatedAt: t.updatedAt || 0,
    contract: t.contract || null,
    dispatch: t.dispatch || null,
    teamResults: t.teamResults || [],
  };
}

export function renderStage(wsRoot, opts = {}) {
  const demo = !!opts.demo;
  // wsRoot 兼容旧的路径字符串；传 { id, path, title } 时任务按 workspaceId 隔离
  const ws = (typeof wsRoot === "string" || !wsRoot)
    ? { id: opts.wsId || null, path: wsRoot || "", title: opts.wsTitle || String(wsRoot || "").split(/[\\/]/).pop() || "工作区" }
    : wsRoot;
  const spaces = opts.spaces || [];
  const tasks = (demo ? DEMO_TASKS : loadTasks(ws.id)).map(normTask);
  const teams = demo ? DEMO_TEAMS : loadTeams(ws.path);
  const others = spaces.filter((s) => s.id !== ws.id && s.path !== ws.path);
  const switcher = others.length
    ? '<span class="wssw">切换到：' + others.map((s) => '<a href="/?ws=' + encodeURIComponent(s.id || s.path) + '">' + esc(s.title) + '</a>').join('') + '</span>'
    : '';

  const ropeAll = tasks.filter((t) => t.status === 'todo' || t.status === 'running');
  const rank = (t) => ({ P0: 0, '高': 0, P1: 1, '中': 1, P2: 2, '低': 2 }[t.priority] ?? 3);
  const rope = ropeAll.slice().sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt);
  const backlog = tasks.filter((t) => t.status === 'backlog');
  const done = tasks.filter((t) => t.status === 'done');

  const pinClass = (t) => (t.priority === 'P0' || t.priority === '高' ? 'p0' : t.priority === 'P1' || t.priority === '中' ? 'p1' : '');
  const cloth = (t) => `<div class="hanger" draggable="true" data-id="${esc(t.id)}" title="${esc(t.title)}">
      <div class="pin ${pinClass(t)}"></div>
      <div class="cloth ${pinClass(t)}">
        <div class="t">${esc(t.title)}</div>
        <div class="m">${esc(t.assignee || '未指派')}${t.priority ? ' · ' + esc(t.priority) : ''}</div>
        <div class="bar"><i style="width:${t.progress}%;background:${t.status === 'done' ? 'var(--done)' : 'var(--run)'}"></i></div>
        <div class="acts">
          <button class="act" data-contract="${esc(t.id)}">契约</button>
          <button class="act" data-dispatch="${esc(t.id)}">派给团队</button>
          ${t.dispatch ? '<span class="chip">已派</span>' : ''}
          ${(t.teamResults && t.teamResults.length) ? '<button class="act res" data-res="' + esc(t.id) + '">看结果</button>' : ''}
        </div>
      </div></div>`;

  /* ---------- 团队：竖向层级 + 调用连线数据 ---------- */
  const teamBlocks = teams.map((t) => {
    const leads = t.members.filter((m) => m.role === 'lead');
    const workers = t.members.filter((m) => m.role === 'worker');
    const reviewers = t.members.filter((m) => (m.role || '').includes('review'));
    const taskCount = (m) => t.tasks.filter((k) => k.assignee === m.name || k.assignee === m.id).length;
    const doneCount = (m) => t.tasks.filter((k) => (k.assignee === m.name || k.assignee === m.id) && (k.status === 'completed' || k.status === 'done')).length;
    const stLabel = (m) => {
      const tc = taskCount(m), dc = doneCount(m);
      if (m.status === 'working') return '运行中';
      if (tc > 0 && dc >= tc) return '已交付';
      if (m.status === 'idle' || m.status === 'ready') return '空闲';
      if (m.status === 'done' || m.status === 'completed') return '已完成';
      return m.status || '—';
    };
    const node = (m) => `<div class="node ${m.status === 'working' ? 'run' : ''}" data-sid="${esc(m.id || '')}" data-name="${esc(m.name)}" data-team="${esc(t.id)}">
        <div class="avatar">${esc((m.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="nm">${esc(m.name)}</div>
        <div class="sub">${esc(m.role)}${m.model ? ' · ' + esc(m.model) : ''}</div>
        <div class="stt"><i class="dot ${m.status === 'working' ? 'run' : (taskCount(m) > 0 && doneCount(m) >= taskCount(m) ? 'done' : 'idle')}"></i>${stLabel(m)}${taskCount(m) ? ' · ' + doneCount(m) + '/' + taskCount(m) + ' 任务' : ''}</div></div>`;
    const tier = (label, arr) => (arr.length ? `<div class="tier" data-tier="${label}"><div class="tier-label">${label}</div><div class="row">${arr.map(node).join('')}</div></div>` : '');
    return `<section class="team-block" data-team="${esc(t.id)}">
      <div class="team-head"><b>${esc(t.name)}</b><span class="muted">${esc(t.description || '')}</span>${t.archived ? '<span class="pill">已归档</span>' : ''}</div>
      <div class="tree" data-tree="${esc(t.id)}">
        <div class="node boss ${t.archived ? 'archived' : ''}" data-sid="${esc(t.captainSessionId || '')}" data-name="主控 / 老板"> <div class="avatar">主</div><div class="nm">主控 / 老板</div>
          <div class="sub">${t.members.length} 成员 · ${t.tasks.length} 任务</div></div>
        <div class="stem"></div>
        ${tier('领导', leads)}${tier('员工', workers)}${tier('审查', reviewers)}
      </div></section>`;
  }).join('');

  /* ---------- 时间轨道 ---------- */
  const PALETTE = ['#3b6cf6', '#12b76a', '#f79009', '#8b5cf6', '#ec4899', '#0ea5e9', '#84cc16', '#f97316'];
  const tb = teams.map((t) => {
    const total = Math.max(t.tasks.length, 1);
    const colorOf = {};
    t.members.forEach((m, i) => { colorOf[m.name] = PALETTE[i % PALETTE.length]; });
    const times = t.tasks.map((k) => [Number(k.createdAt) || 0, Number(k.updatedAt) || 0]).filter((x) => x[0] > 0 || x[1] > 0);
    const starts = [...new Set(times.map((x) => x[0] || x[1]))];
    const useTime = starts.length >= 2 && (Math.max(...times.map((x) => x[1] || x[0])) - Math.min(...times.map((x) => x[0] || x[1]))) > 0;
    const tmin = useTime ? Math.min(...times.map((x) => x[0] || x[1])) : 0;
    const tmax = useTime ? Math.max(...times.map((x) => x[1] || x[0])) : 1;
    const span = Math.max(1, tmax - tmin);
    const pos = (task, i) => {
      if (!useTime) { const left = 4 + (i / total) * 92; const w = Math.max(6, (92 / total) * 0.72); return [left, w]; }
      const a = Number(task.createdAt) || tmin;
      const b = Math.max(Number(task.updatedAt) || a, a + span * 0.04);
      return [3 + ((a - tmin) / span) * 94, Math.max(4, ((b - a) / span) * 94)];
    };
    const lanes = t.members.map((m) => {
      const mine = t.tasks.map((task, i) => ({ task, i })).filter((x) => x.task.assignee === m.name || x.task.assignee === m.id);
      const col = colorOf[m.name] || '#3b6cf6';
      const segs = mine.map(({ task, i }) => {
        const p = pos(task, i);
        const bad = task.status === 'failed' ? ' bad' : '';
        const run = task.status === 'running' || task.status === 'in_progress' ? ' run' : '';
        return `<span class="seg${bad}${run}" data-task="${esc(task.id)}" data-owner="${esc(task.assignee)}" data-color="${col}" style="left:${p[0]}%;width:${p[1]}%;background:${col}" title="${esc(task.subject || task.title)} · ${esc(task.status)}"></span>`;
      }).join('');
      return `<div class="lane" data-lane="${esc(m.name)}"><span class="lname"><i class="ldot" style="background:${col}"></i>${esc(m.name)}</span><div class="track">${segs}</div></div>`;
    }).join('');
    const legs = t.tasks.filter((k) => (k.dependencies || []).length).length;
    return `<div class="tl-block" data-team="${esc(t.id)}"><div class="tl-head"><b>${esc(t.name)}</b><span class="muted">${t.tasks.length} 个任务区间 · ${legs} 条调用关系（彩色箭头 = 谁调用谁，跨泳道）</span></div>${lanes}<svg class="tlsvg"></svg></div>`;
  }).join('');

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>工作台</title>
<style>
:root{--ink:#1c1f24;--muted:#8a919c;--line:#e6e8ec;--bg:#f7f8fa;--run:#3b6cf6;--done:#12b76a;--bad:#f04438;--warn:#f79009}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
#zoombox{position:relative;overflow:hidden;min-height:100vh}
#stage{transform-origin:top center;transition:transform .12s ease;padding:14px 24px 60px;max-width:1280px;margin:0 auto}
h1{font-size:19px;margin:2px 0 2px}
.sub{color:var(--muted);font-size:12px;margin-bottom:10px}
.sec{display:flex;gap:10px;align-items:baseline;margin:16px 0 8px;font-size:13px}
.sec b{font-size:13px}.sec span{color:var(--muted);font-size:12px}
/* 绳子 */
.bench{display:grid;grid-template-columns:120px minmax(0,1fr) 120px;gap:0;align-items:stretch}
.rail{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0}
.pile{position:relative;width:78px;height:44px;cursor:default}
.pc{position:absolute;left:0;right:0;height:40px;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(20,30,60,.05)}
.pc:nth-child(1){top:6px;transform:scale(.94)}.pc:nth-child(2){top:3px;transform:scale(.97)}.pc:nth-child(3){top:0}
.num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#b7791f}
.rail-cap{font-size:11px;color:var(--muted)}
.rope-area{position:relative;padding:0 8px;min-width:0}
.rope{position:absolute;left:8px;right:8px;top:44px;height:2px;background:linear-gradient(90deg,#d7dbe2,#b9c0cb 8%,#b9c0cb 92%,#d7dbe2)}
.rope::before,.rope::after{content:"";position:absolute;top:-5px;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #b9c0cb}
.rope::before{left:-6px}.rope::after{right:-6px}
.line{display:flex;gap:12px;align-items:flex-start;padding-top:8px;min-height:110px;flex-wrap:nowrap;justify-content:flex-start}
.acts{display:flex;gap:4px;margin-top:6px;align-items:center;flex-wrap:wrap;opacity:.45;transition:opacity .15s}
.hanger:hover .acts{opacity:1}
.act{font:10px/1.2 inherit;padding:3px 7px;white-space:nowrap;border:1px solid #dbe2ee;background:#fff;border-radius:999px;cursor:pointer;color:#33415a}
.act:hover{border-color:#9db4e6;color:#1d4ed8}
.act.res{border-color:#bfe3cd;color:#0f7a45}
.chip{font-size:9px;padding:3px 6px;white-space:nowrap;border-radius:999px;background:#eef3ff;color:#3b6cf6}
.hanger{width:180px;flex:0 0 auto;cursor:grab}
.pin{width:2px;height:36px;background:#c9ced8;margin:0 auto;position:relative}
.pin::after{content:"";position:absolute;left:-2px;top:0;width:6px;height:8px;border-radius:2px;background:#aeb5c0}
.pin.p0::after{background:var(--bad)}.pin.p1::after{background:var(--warn)}
.cloth{border:1px solid var(--line);border-top:3px solid #c9ced8;border-radius:8px;background:#fff;padding:8px 10px;box-shadow:0 1px 4px rgba(20,30,60,.05)}
.cloth.p0{border-top-color:var(--bad)}.cloth.p1{border-top-color:var(--warn)}
.cloth .t{font-size:12.5px;font-weight:600;line-height:1.4;max-height:3.6em;overflow:hidden}
.cloth .m{font-size:11px;color:var(--muted);margin-top:4px}
.cloth .bar{height:5px;border-radius:3px;background:#eef1f6;margin-top:6px;overflow:hidden}
.cloth .bar i{display:block;height:100%;border-radius:3px}
.rope-area.drop-left{background:linear-gradient(90deg,rgba(247,144,9,.08),transparent 40%)}
.rope-area.drop-right{background:linear-gradient(270deg,rgba(18,183,106,.10),transparent 40%)}
.empty{color:var(--muted);font-size:12px;padding:10px}
/* 团队画布（透明，无白框） */
.pzbar{display:flex;align-items:center;gap:8px;margin:4px 0 6px}
.pzbtn{border:1px solid var(--line);background:#fff;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}
.pzbtn:hover{background:#f2f5fb}
.pz{position:relative;height:700px;overflow:hidden;cursor:grab;background:radial-gradient(circle,#dfe3ea 1px,transparent 1px) 0 0/22px 22px}
.pz.drag{cursor:grabbing}
.pz-inner{position:absolute;left:0;top:0;transform-origin:0 0;padding:10px;display:flex;gap:18px;align-items:flex-start}
.team-block{min-width:340px}
.team-head span.muted{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(72vw,900px);display:inline-block;vertical-align:bottom}
.team-head{display:flex;gap:8px;align-items:baseline;font-size:12px;margin-bottom:6px}
.team-head .muted{color:var(--muted);font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pill{font-size:10px;background:#f1f3f7;border-radius:999px;padding:1px 7px;color:#6b7280}
.tree{display:flex;flex-direction:column;align-items:center;gap:30px}
.node{position:relative;border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 16px;text-align:center;min-width:150px;box-shadow:0 1px 4px rgba(20,30,60,.04);cursor:pointer}
.node:hover{box-shadow:0 4px 14px rgba(20,30,60,.12)}
.node .avatar{width:28px;height:28px;border-radius:50%;background:#eef2fb;color:var(--run);display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-weight:700;font-size:12px}
.node .nm{font-size:12px;font-weight:600}.node .sub{font-size:11px;color:var(--muted)}
.node .stt{display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:10px;color:#6b7280;background:#f6f8fb;border:1px solid #eef1f6;border-radius:999px;padding:1px 7px}
.node .dot{width:6px;height:6px;border-radius:50%;background:#cbd5e1;display:inline-block}
.node .dot.run{background:var(--run);box-shadow:0 0 0 3px rgba(59,108,246,.14)}
.node .dot.done{background:var(--done)}
.node.run{border-color:#bcd0ff;box-shadow:0 2px 10px rgba(59,108,246,.16)}
.node.boss .avatar{background:#fff7e8;color:#b7791f}
.node.boss.archived{opacity:.75}
.tier{display:flex;flex-direction:column;align-items:center;gap:4px}
.tier{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px}
.tier-label{position:absolute;left:-64px;top:50%;transform:translateY(-50%);font-size:10px;color:#9aa1ac;letter-spacing:.08em;white-space:nowrap;background:#f7f8fa;padding:1px 4px;border-radius:4px;z-index:2}
.tier .row{display:flex;gap:34px;align-items:flex-start}
.stem{width:2px;height:34px;background:#dfe3ea}
/* 时间轨道 */
.tl{position:relative;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 14px 14px}
.tl-block{position:relative}
.tl-block+.tl-block{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}
.tl-head{display:flex;gap:8px;align-items:baseline;font-size:12px;margin-bottom:6px}
.tl-head .muted{color:var(--muted);font-size:11px}
.lane{display:flex;align-items:center;gap:10px;height:24px;position:relative}
.lname{width:104px;flex:0 0 104px;font-size:11px;color:#6b7280;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:flex-end;gap:5px}
.ldot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;display:inline-block}
.track{position:relative;flex:1;height:12px;background:#f1f3f7;border-radius:6px}
.seg{position:absolute;top:2px;height:8px;border-radius:4px;opacity:.95}
.seg.run{box-shadow:0 0 0 2px rgba(59,108,246,.18)}
.seg.bad{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px);outline:1.5px solid #f04438}
.tlsvg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.tl-axis{display:flex;justify-content:space-between;color:#a3aab5;font-size:11px;margin:6px 0 0 114px}
footer{color:#a3aab5;font-size:11px;text-align:center;margin-top:14px}
.projbar{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:10px;padding:14px 16px 10px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(#fcfdff,#f1f4fa);box-shadow:inset 0 -4px 0 #e4e8f0;min-height:168px;overflow-x:auto}
.book{position:relative;flex:0 0 auto;width:46px;height:140px;border-radius:4px 6px 6px 4px;border:1px solid #dde3ee;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .16s ease,box-shadow .16s ease;box-shadow:inset 2px 0 0 rgba(255,255,255,.7)}
.book:hover{transform:translateY(-9px);box-shadow:0 10px 18px rgba(15,23,42,.14)}
.book .spine{writing-mode:vertical-rl;text-orientation:mixed;font-size:11.5px;color:#33415a;letter-spacing:.06em;max-height:126px;overflow:hidden;white-space:nowrap;padding:8px 0}
.book.more{background:linear-gradient(90deg,#f6f8fc,#eef2f9);border-style:dashed;color:#8a919c}
.book .band{position:absolute;left:0;right:0;bottom:22px;height:2px;background:rgba(59,108,246,.35)}
.fv-panel.small{width:min(460px,92vw)}
.fv-b{padding:16px 18px}
.fv-b input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dfe4ee;border-radius:8px;font:13px/1.4 inherit;outline:none}
.fv-b input:focus{border-color:#9db4e6;box-shadow:0 0 0 3px rgba(59,108,246,.12)}
.fv-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.projbtn{border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 11px;font-size:12px;cursor:pointer;color:#374151}
.projbtn:hover{background:#f2f5fb;border-color:#c8d3ee}
pre.md{white-space:pre-wrap;word-break:break-word;font:12px/1.6 ui-monospace,Consolas,Menlo,monospace;background:#fafbfd;border:1px solid var(--line);border-radius:10px;padding:12px;color:#2b3440}
/* 缩放控件 */
.zctl{position:fixed;right:18px;bottom:18px;display:flex;gap:6px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 8px;box-shadow:0 4px 14px rgba(20,30,60,.10);z-index:40}
.zctl button{border:0;background:#f3f4f7;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:14px}
.zctl span{font-size:11px;color:var(--muted);min-width:38px;text-align:center}
/* 抽屉 */
.drw{position:fixed;top:0;right:0;height:100%;width:460px;max-width:94vw;background:#fff;border-left:1px solid var(--line);box-shadow:-8px 0 24px rgba(20,30,60,.08);transform:translateX(105%);transition:transform .22s ease;z-index:60;display:flex;flex-direction:column}
.drw.open{transform:translateX(0)}
.drw-h{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line)}
.drw-h b{font-size:14px}.drw-h .muted{font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drw-x{cursor:pointer;border:0;background:#f3f4f7;border-radius:6px;padding:3px 9px;font-size:12px}
.drw-b{padding:12px 16px;overflow:auto;flex:1;font-size:12px}
.drw-sec{margin:12px 0 6px;font-weight:600;color:#374151}
.drw-title{font-weight:600;font-size:13px;margin-bottom:4px}
.drw-sub{color:#8a919c;font-size:11px;margin-bottom:8px}
.tk{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;margin-bottom:5px}
.tk span{color:#8a919c;font-size:11px}
.msg{border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-bottom:6px;background:#fafbfd}
.msg.user{background:#f3f7ff;border-color:#dbe6ff}
.msg .who{font-size:10px;color:#8a919c;margin-bottom:3px}
.msg .txt{white-space:pre-wrap;line-height:1.5;word-break:break-word}
.hint{font-size:11px;color:var(--muted)}
.toolbar{display:flex;align-items:center;gap:12px;margin:0 0 10px}
.btn{font:12px/1 inherit;padding:7px 12px;border:1px solid #e2e6ee;background:#fff;color:#3d4657;border-radius:8px;cursor:pointer}
.btn:hover{border-color:#c9d3e6}
.btn.primary{background:#111827;color:#fff;border-color:#111827}
.dropzone.over{outline:2px dashed #b9c6e6;outline-offset:-4px;border-radius:10px}
.fv{position:fixed;inset:0;background:rgba(15,23,42,.28);display:none;align-items:center;justify-content:center;z-index:60}
.fv.open{display:flex}
.fv-panel{width:min(880px,92vw);max-height:84vh;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(15,23,42,.22);display:flex;flex-direction:column;overflow:hidden}
.fv-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.fv-h b{font-size:14px}.fv-h .drw-x{margin-left:auto}
.fv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:16px 18px;overflow:auto}
.fitem{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;cursor:grab}
.fitem .t{font-size:13px;color:#232a35;margin-bottom:4px}
.fitem .m{font-size:11px;color:var(--muted)}
.fitem .row{display:flex;justify-content:flex-end;margin-top:8px}
.fitem .ry{font:11px/1 inherit;padding:4px 9px;border:1px solid #d6ddec;border-radius:999px;background:#fff;color:#3b6cf6;cursor:pointer}
.fv-f{padding:12px 18px;border-top:1px solid var(--line);display:flex;justify-content:flex-end}
.wsbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;font:12px/1.5 inherit}
.wsbar .wschip{background:#eef3ff;color:#2a4fbf;border:1px solid #d3defb;border-radius:999px;padding:4px 11px;white-space:nowrap}
.wsbar .wspath{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#8b95a7;max-width:36vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsbar .wssw{color:#8b95a7}
.wsbar .wssw a{margin-left:6px;color:#3b6cf6;text-decoration:none;border-bottom:1px dashed #9db4f7}
.wsbar .wsall{margin-left:auto;color:#3b6cf6;text-decoration:none;border:1px solid #d3defb;border-radius:999px;padding:3px 11px;background:#fff}
.wsbar .wsall:hover{background:#f5f8ff}
</style></head><body>
<div id="zoombox"><div id="stage">
<header><div class="wsbar"><span class="wschip">🗂 工作区 <b>${esc(ws.title)}</b></span><span class="wspath" title="${esc(ws.path)}">${esc(ws.path)}</span>${switcher}<a class="wsall" href="/spaces">全部工作区 →</a></div><h1>工作台</h1><div class="sub">这一页只属于「${esc(ws.title)}」：任务挂绳上（向左拖 = 长期任务，向右拖 = 归档）· 中间团队树（连线 = 谁调用了谁）· 下面是带交叉连线的时间轨道</div></header>

<section class="projsec"><div class="sec"><b>📚 项目书</b><span>给任务 → 自动拆解 + 分工，一切改动先改这里</span></div><div class="projbar" id="projbar"><span class="muted">加载中…</span></div></section>

<section><div class="sec"><b>① 任务</b><span>左：长期任务 · 右：归档</span></div>
  <div class="toolbar"><button class="btn primary" id="addTask">＋ 新建任务</button><span class="hint">新建立刻挂到绳子上；把卡片拖进左/右文件夹 = 长期任务 / 归档；点文件夹可查看与还原</span></div>
  <div class="bench">
    <aside class="rail left dropzone" id="railL" data-to="backlog"><div class="pile"><span class="pc"></span><span class="pc"></span><span class="pc"></span><span class="num">${backlog.length}</span></div><div class="rail-cap">📁 长期</div></aside>
    <main class="rope-area dropzone" id="ropeArea" data-to="line"><div class="rope"></div>
      <div class="line" id="line">${rope.length ? rope.map(cloth).join('') : '<div class="empty">「' + esc(ws.title) + '」的绳子上还没有任务 —— 点「＋ 新建任务」（会记到这个工作区），或从文件夹拖回来</div>'}</div>
    </main>
    <aside class="rail right dropzone" id="railR" data-to="done"><div class="pile"><span class="pc"></span><span class="pc"></span><span class="pc"></span><span class="num">${done.length}</span></div><div class="rail-cap">🗂️ 归档</div></aside>
  </div>
</section>

<section><div class="sec"><b>② 智能体团队</b><span>竖向层级 · 拖动平移 · 滚轮缩放整个画面</span></div>
  <div class="pz" id="pz"><div class="pz-inner" id="pzInner">${teams.length ? teamBlocks : '<div class="empty">「' + esc(ws.title) + '」还没有智能体团队 —— 在 ' + esc(ws.path) + ' 里建团队跑任务，这里就会出现树状分工</div>'}</div></div>
</section>

<section><div class="sec"><b>③ 时间轨道</b><span>色块 = 任务区间 · 交叉虚线 = 调用关系</span></div>
  <div class="tl">${teams.length ? tb : '<div class="empty">这个工作区还没有团队，所以没有时间轨道</div>'}<div class="tl-axis"><span>开始</span><span>推进中</span><span>现在</span></div></div>
</section>

<footer>${demo ? '演示数据 · ' : ''}生成于 ${new Date().toLocaleString('zh-CN')} · node stage.mjs<span id="syncState" style="margin-left:10px;color:#12b76a">● 自动同步</span></footer>
</div></div>

<div class="zctl"><button id="zin">＋</button><button id="zout">－</button><button id="zreset">⟲</button><span id="zlv">100%</span></div>

<div class="drw" id="drw"><div class="drw-h"><b id="drwName">成员</b><span class="muted" id="drwMeta"></span><button class="drw-x" id="drwClose">关闭</button></div><div class="drw-b" id="drwBody"></div></div>

<div class="fv" id="cm"><div class="fv-panel small"><div class="fv-h"><b>新建任务</b><button class="drw-x" id="cmClose">关闭</button></div><div class="fv-b"><input id="cmInput" placeholder="一句话标题，例如：把刷机过程写成文档"><div class="fv-actions"><button class="btn" id="cmCancel">取消</button><button class="btn primary" id="cmOk">创建并挂上绳子</button></div></div></div></div>

<div class="fv" id="fv"><div class="fv-panel">
  <div class="fv-h"><b id="fvTitle">文件夹</b><span class="muted" id="fvCount"></span><button class="drw-x" id="fvClose">关闭</button></div>
  <div class="fv-grid" id="fvGrid"></div>
  <div class="fv-f"><button class="btn" id="fvRestoreAll">全部还原到绳子</button></div>
</div></div>

<script>window.__TEAMS__ = ${JSON.stringify(teams)};
window.__TEAMS_MINI__ = ${JSON.stringify(teams.map((t) => ({ id: t.id, name: t.name })))};
window.__TASKS__ = ${JSON.stringify(tasks)};
(function(){
  /* 所有接口都带上本页的工作区参数（?ws= 或 ?sid=），这样同一进程能服务多个工作区 */
  var WSQS = location.search ? location.search.slice(1) : '';
  function api(u){ if(!WSQS) return u; return u + (u.indexOf('?') >= 0 ? '&' : '?') + WSQS; }
  var stage=document.getElementById('stage'), zoom=document.getElementById('zoombox');
  var s=1;
  function applyZoom(){ stage.style.transform='scale('+s+')'; document.getElementById('zlv').textContent=Math.round(s*100)+'%'; }
  document.getElementById('zin').onclick=function(){ s=Math.min(1.8,s+0.1); applyZoom(); };
  document.getElementById('zout').onclick=function(){ s=Math.max(0.45,s-0.1); applyZoom(); };
  document.getElementById('zreset').onclick=function(){ s=1; applyZoom(); };
  zoom.addEventListener('wheel',function(e){ if(!e.ctrlKey) return; e.preventDefault(); s=Math.min(1.8,Math.max(0.45,s+(e.deltaY<0?0.08:-0.08))); applyZoom(); },{passive:false});

  /* 绳子：拖进左/右文件夹 = 长期任务 / 归档；文件夹内拖回绳子 = 回到待办 */
  var line=document.getElementById('line'), ropeArea=document.getElementById('ropeArea');
  var railL=document.getElementById('railL'), railR=document.getElementById('railR');
  var zones=[{el:ropeArea,to:'line'},{el:railL,to:'backlog'},{el:railR,to:'done'}];
  function post(payload){ return fetch(api('/api/action'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();}); }
  function moveTo(id,to){ if(!id) return; post({action:'move',id:id,to:to}).then(function(){ location.reload(); }).catch(function(){ location.reload(); }); }
  var dragId=null;
  function bindDrag(el){
    el.addEventListener('dragstart',function(e){ dragId=el.getAttribute('data-id'); e.dataTransfer.setData('text/plain',dragId); el.classList.add('dragging'); });
    el.addEventListener('dragend',function(){ el.classList.remove('dragging'); dragId=null; zones.forEach(function(z){ z.el.classList.remove('over'); }); });
  }
  document.querySelectorAll('.hanger').forEach(bindDrag);
  document.querySelectorAll('.dropzone').forEach(function(z){
    z.addEventListener('dragover',function(e){ if(!dragId) return; e.preventDefault(); z.classList.add('over'); });
    z.addEventListener('dragleave',function(){ z.classList.remove('over'); });
    z.addEventListener('drop',function(e){ if(!dragId) return; e.preventDefault(); var to=z.getAttribute('data-to'); var id=dragId; dragId=null; z.classList.remove('over'); if(to!=='line'||true) moveTo(id,to); });
  });

  /* 新建任务 */
  var addTask=document.getElementById('addTask');
  var cm=document.getElementById('cm'), cmInput=document.getElementById('cmInput');
  function openCm(){ cm.classList.add('open'); setTimeout(function(){ cmInput.focus(); },30); }
  function closeCm(){ cm.classList.remove('open'); cmInput.value=''; }
  function submitCm(){ var t=(cmInput.value||'').trim(); if(!t) return; post({action:'create',title:t,priority:'P2'}).then(function(){ location.reload(); }).catch(function(){ location.reload(); }); }
  if(addTask) addTask.onclick=openCm;
  document.getElementById('cmClose').onclick=closeCm;
  document.getElementById('cmCancel').onclick=closeCm;
  document.getElementById('cmOk').onclick=submitCm;
  cmInput.addEventListener('keydown',function(e){ if(e.key==='Enter') submitCm(); if(e.key==='Escape') closeCm(); });
  cm.addEventListener('click',function(e){ if(e.target===cm) closeCm(); });

  /* 文件夹：点开查看 + 还原 */
  var fv=document.getElementById('fv'), fvGrid=document.getElementById('fvGrid'), fvTitle=document.getElementById('fvTitle'), fvCount=document.getElementById('fvCount');
  var fvKind='done';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function renderFolder(){
    var all=(window.__TASKS__||[]);
    var arr=all.filter(function(t){ return t.status===(fvKind==='done'?'done':'backlog'); });
    fvTitle.textContent = fvKind==='done' ? '🗂️ 归档' : '📁 长期任务';
    fvCount.textContent = '共 '+arr.length+' 件';
    fvGrid.innerHTML = arr.length ? arr.map(function(t){
      return '<div class="fitem" draggable="true" data-id="'+esc(t.id)+'"><div class="t">'+esc(t.title)+'</div><div class="m">'+esc(t.assignee||'未指派')+(t.priority?' · '+esc(t.priority):'')+'</div><div class="row"><button class="ry" data-id="'+esc(t.id)+'">↩ 挂到绳子</button></div></div>';
    }).join('') : '<div class="hint">这个文件夹是空的</div>';
    fvGrid.querySelectorAll('.fitem').forEach(bindDrag);
    fvGrid.querySelectorAll('.ry').forEach(function(b){ b.onclick=function(e){ e.stopPropagation(); moveTo(b.getAttribute('data-id'),'line'); }; });
  }
  function openFolder(kind){ fvKind=kind; var ra=document.getElementById('fvRestoreAll'); if(ra) ra.style.display=''; renderFolder(); fv.classList.add('open'); }
  if(railL) railL.addEventListener('click',function(){ openFolder('backlog'); });
  if(railR) railR.addEventListener('click',function(){ openFolder('done'); });
  document.getElementById('fvClose').onclick=function(){ fv.classList.remove('open'); };
  fv.addEventListener('click',function(e){ if(e.target===fv) fv.classList.remove('open'); });
  document.getElementById('fvRestoreAll').onclick=function(){
    var arr=(window.__TASKS__||[]).filter(function(t){ return t.status===(fvKind==='done'?'done':'backlog'); });
    Promise.all(arr.map(function(t){ return post({action:'move',id:t.id,to:'line'}).catch(function(){}); })).then(function(){ location.reload(); });
  };

  /* 团队画布平移 */
  var pz=document.getElementById('pz'), inner=document.getElementById('pzInner');
  var tx=0, ty=0, dragging=false, sx=0, sy=0;
  function applyPan(){ inner.style.transform='translate('+tx+'px,'+ty+'px)'; }
  pz.addEventListener('pointerdown',function(e){ if(e.target.closest && e.target.closest('.node')) return; dragging=true; sx=e.clientX-tx; sy=e.clientY-ty; pz.classList.add('drag'); });
  window.addEventListener('pointermove',function(e){ if(!dragging) return; tx=e.clientX-sx; ty=e.clientY-sy; applyPan(); });
  window.addEventListener('pointerup',function(){ dragging=false; pz.classList.remove('drag'); });

  /* 项目书：列出 + 点开看 */
  var projbar=document.getElementById('projbar');
  function loadProjects(){
    fetch(api('/api/projects')).then(function(r){return r.json();}).then(function(list){
      if(!list.length){ projbar.innerHTML='<span class="muted">还没有项目书</span>'; return; }
      var COLORS=['#dbe6ff','#e6f7ec','#fff1dc','#efe6ff','#ffe4ee','#e2f4fb'];
      window.__PROJLIST__=list;
      var shown=list.slice(0,8), extra=list.length-shown.length;
      var html=shown.map(function(n,i){ var t=n.replace(/\.md$/,''); return '<div class="book" data-proj="'+encodeURIComponent(n)+'" title="'+t+'" style="background:linear-gradient(90deg,'+COLORS[i%COLORS.length]+',#eef2f9)"><span class="spine">'+t+'</span><span class="band"></span></div>'; }).join('');
      if(extra>0) html+='<div class="book more" data-more="1" title="还有 '+extra+' 本项目书"><span class="spine">⋯ 还有 '+extra+' 本</span></div>';
      projbar.innerHTML=html;
    }).catch(function(){ projbar.innerHTML='<span class="muted">项目书加载失败</span>'; });
  }
  function openProject(id){
    drw.classList.add('open');
    document.getElementById('drwName').textContent='项目书';
    document.getElementById('drwMeta').textContent=decodeURIComponent(id);
    document.getElementById('drwBody').innerHTML='<div class="hint">加载中…</div>';
    fetch(api('/api/project?id='+id)).then(function(r){return r.text();}).then(function(t){
      document.getElementById('drwBody').innerHTML='<pre class="md">'+t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>';
    });
  }
  function openProjList(){
    var list=window.__PROJLIST__||[];
    fvKind='proj';
    fvTitle.textContent='📚 项目书'; fvCount.textContent='共 '+list.length+' 本';
    fvGrid.innerHTML=list.map(function(n){ var t=n.replace(/\.md$/,''); return '<div class="fitem proj" data-proj="'+encodeURIComponent(n)+'"><div class="t">'+t+'</div><div class="m">点击查看</div></div>'; }).join('');
    fvGrid.querySelectorAll('.fitem').forEach(function(el){ el.onclick=function(){ fv.classList.remove('open'); openProject(el.getAttribute('data-proj')); }; });
    var ra=document.getElementById('fvRestoreAll'); if(ra) ra.style.display='none';
    fv.classList.add('open');
  }
  projbar.addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('.book'):null; if(!b) return;
    if(b.getAttribute('data-more')){ openProjList(); return; }
    openProject(b.getAttribute('data-proj'));
  });
  loadProjects();

  /* 派单 / 看结果 */
  function openDrawer(title, meta, html){
    drw.classList.add('open');
    document.getElementById('drwName').textContent = title;
    document.getElementById('drwMeta').textContent = meta || '';
    document.getElementById('drwBody').innerHTML = html;
  }
  function esc2(v){
    return String(v == null ? '' : v).replace(/[&<>]/g, function(c){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c];
    });
  }
  function taskById(id){
    var a = window.__TASKS__ || [];
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function openDispatch(taskId){
    var t = taskById(taskId) || {};
    var teams = window.__TEAMS_MINI__ || [];
    if (!teams.length) {
      openDrawer('派给团队', t.title || '', '<div class="hint">还没有可用的团队，先去建一个 Agent Team。</div>');
      return;
    }
    var html = '<div class="hint" style="margin-bottom:10px">选择接这个任务的团队：</div>' + teams.map(function(x){
      return '<button class="btn" data-team="' + esc2(x.id) + '" style="display:block;width:100%;text-align:left;margin-bottom:8px">' + esc2(x.name) + '</button>';
    }).join('');
    openDrawer('派给团队', t.title || '', html);
    var box = document.getElementById('drwBody');
    Array.prototype.forEach.call(box.querySelectorAll('[data-team]'), function(b){
      b.onclick = function(){
        b.disabled = true;
        b.textContent = '派单中…';
        post({ action: 'dispatch', boardTaskId: taskId, teamId: b.getAttribute('data-team'), title: t.title || '' })
          .then(function(){ location.reload(); })
          .catch(function(){ b.disabled = false; b.textContent = '派单失败，点击重试'; });
      };
    });
  }
  var CT_FIELDS = [
    ['goal', '目标（一句话可验收的结果）'],
    ['inputs', '输入（上游产出/文件路径/数据）'],
    ['outputs', '产出（交付物、放哪、什么格式）'],
    ['acceptance', '验收标准（可检查的条目）'],
    ['iface', '接口约定（别人怎么用我的结果）'],
    ['deps', '依赖任务（填标题或 id，逗号分隔；留空表示无依赖）'],
  ];
  function openContract(taskId){
    var t = taskById(taskId) || {};
    var c = t.contract || {};
    c.deps = (t.dependencies || []).join(', ');
    var html = '<div class="hint" style="margin-bottom:12px">契约会随派单一起发给团队，作为任务的上下文与验收依据。</div>';
    CT_FIELDS.forEach(function(f){
      html += '<div style="margin-bottom:10px"><div class="who" style="margin-bottom:4px">' + f[1] + '</div>' +
        '<textarea data-f="' + f[0] + '" rows="3" style="width:100%;box-sizing:border-box;font:13px/1.5 inherit;padding:8px;border:1px solid #dfe3ea;border-radius:8px;resize:vertical">' + esc2(c[f[0]] || '') + '</textarea></div>';
    });
    html += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="ctSave">保存契约</button><button class="btn" id="ctClear" style="background:#fff;color:#33415a;border:1px solid #dfe3ea">清空</button></div>';
    openDrawer('任务契约', t.title || '', html);
    var box = document.getElementById('drwBody');
    function payload(){
      var o = { action: 'contract', boardTaskId: taskId };
      CT_FIELDS.forEach(function(f){
        var el = box.querySelector('[data-f="' + f[0] + '"]');
        o[f[0]] = el ? el.value : '';
      });
      return o;
    }
    document.getElementById('ctSave').onclick = function(){
      var b = this; b.disabled = true; b.textContent = '保存中…';
      post(payload()).then(function(){ location.reload(); }).catch(function(){ b.disabled = false; b.textContent = '保存失败'; });
    };
    document.getElementById('ctClear').onclick = function(){
      CT_FIELDS.forEach(function(f){ var el = box.querySelector('[data-f="' + f[0] + '"]'); if (el) el.value = ''; });
    };
  }
  function openResults(taskId){
    var t = taskById(taskId) || {};
    var rs = t.teamResults || [];
    var html = rs.map(function(r){
      return '<div class="msg"><div class="who">团队 ' + esc2(r.teamId) + ' · ' + new Date(r.at || Date.now()).toLocaleString('zh-CN') + '</div><div class="txt">' + esc2(r.output) + '</div></div>';
    }).join('');
    openDrawer('团队结果', t.title || '', html || '<div class="hint">还没有结果</div>');
  }
  document.addEventListener('click', function(e){
    var el = e.target;
    if (!el || !el.closest) return;
    var ct = el.closest('[data-contract]');
    if (ct) { e.stopPropagation(); openContract(ct.getAttribute('data-contract')); return; }
    var d = el.closest('[data-dispatch]');
    if (d) { e.stopPropagation(); openDispatch(d.getAttribute('data-dispatch')); return; }
    var r = el.closest('[data-res]');
    if (r) { e.stopPropagation(); openResults(r.getAttribute('data-res')); return; }
  });
  /* 团队树连线：谁调用了谁（task 依赖 → 指派者） */
  function buildCallEdges(){
    var edges=[];
    (window.__TEAMS__||[]).forEach(function(t){
      var byId={}; (t.tasks||[]).forEach(function(k){ byId[k.id]=k; });
      (t.tasks||[]).forEach(function(k){
        (k.dependencies||[]).forEach(function(dep){
          var caller=(byId[dep]||{}).assignee; if(!caller||!k.assignee) return;
          edges.push({team:t.id,from:caller,to:k.assignee,label:k.id});
        });
      });
    });
    return edges;
  }
  function drawTreeLines(){
    (window.__TEAMS__||[]).forEach(function(t){
      var tree=document.querySelector('.tree[data-tree="'+t.id+'"]');
      if(!tree) return;
      var old=tree.querySelector('.callsvg'); if(old) old.remove();
      var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','callsvg');
      svg.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none';
      svg.innerHTML='<defs>'+
        '<marker id="arw" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L7.5,3 L0,6 z" fill="#9db4e6"/></marker>'+
        '<marker id="arw2" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L7.5,3 L0,6 z" fill="#c3b1f0"/></marker>'+
        '</defs>';
      tree.style.position='relative';
      var tr=tree.getBoundingClientRect();
      var boss=tree.querySelector('.node.boss');
      var tiers={lead:[],worker:[],review:[]};
      var map={'领导':'lead','员工':'worker','审查':'review'};
      Object.keys(map).forEach(function(lab){
        tree.querySelectorAll('.tier[data-tier="'+lab+'"] .node').forEach(function(n){ tiers[map[lab]].push(n); });
      });
      function curve(a,b,stroke,marker,dash,op){
        var ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
        var ax=ar.left-tr.left, ay=ar.top-tr.top, bx=br.left-tr.left, by=br.top-tr.top;
        var x1,y1,x2,y2,d;
        if(by > ay + ar.height*0.5){ /* 从上方连到下方 */
          x1=ax+ar.width/2; y1=ay+ar.height; x2=bx+br.width/2; y2=by;
          var my=(y1+y2)/2;
          d='M'+x1+','+y1+' C'+x1+','+my+' '+x2+','+my+' '+x2+','+y2;
        } else { /* 同一行：左右连 */
          x1=ax+ar.width; y1=ay+ar.height/2; x2=bx; y2=by+br.height/2;
          var dx=Math.max(20,Math.abs(x2-x1)/2);
          d='M'+x1+','+y1+' C'+(x1+dx)+','+y1+' '+(x2-dx)+','+y2+' '+x2+','+y2;
        }
        var p=document.createElementNS('http://www.w3.org/2000/svg','path');
        p.setAttribute('d',d);
        p.setAttribute('fill','none'); p.setAttribute('stroke',stroke); p.setAttribute('stroke-width','1.5');
        if(dash) p.setAttribute('stroke-dasharray',dash);
        if(op) p.setAttribute('opacity',op);
        p.setAttribute('marker-end','url(#'+marker+')');
        svg.appendChild(p);
      }
      /* ① 结构箭头：老板 → 领导/员工（派发） */
      var workers=tiers.lead.concat(tiers.worker);
      if(boss){ workers.forEach(function(n){ curve(boss,n,'#9db4e6','arw'); }); }
      /* ② 交付箭头：员工/领导 → 审查 */
      if(tiers.review.length){
        workers.forEach(function(n){ tiers.review.forEach(function(r){ curve(n,r,'#c3b1f0','arw2','4 4','.85'); }); });
      }
      /* ③ 依赖箭头：谁调用了谁（task dependencies） */
      var edges=buildCallEdges().filter(function(e){return e.team===t.id;});
      edges.forEach(function(e){
        var a=tree.querySelector('.node[data-name="'+e.from+'"]'), b=tree.querySelector('.node[data-name="'+e.to+'"]');
        if(!a||!b||a===b) return;
        curve(a,b,'#c3b1f0','arw2','3 4','.5');
      });
      tree.appendChild(svg);
    });
  }

  /* 时间轨道交叉连线：彩色箭头 = 谁调用了谁 */
  function drawTimelineLinks(){
    document.querySelectorAll('.tl-block').forEach(function(block){
      var svg=block.querySelector('.tlsvg'); if(!svg) return;
      var br=svg.getBoundingClientRect();
      svg.setAttribute('viewBox','0 0 '+br.width+' '+br.height);
      svg.innerHTML='<defs>';
      var palette=['#3b6cf6','#12b76a','#f79009','#8b5cf6','#ec4899','#0ea5e9','#84cc16','#f97316'];
      palette.forEach(function(c,i){
        svg.innerHTML+='<marker id="tla'+i+'" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L7.5,3 L0,6 z" fill="'+c+'"/></marker>';
      });
      svg.innerHTML+='</defs>';
      var segs={};
      block.querySelectorAll('.seg').forEach(function(el){ segs[el.getAttribute('data-task')]=el; });
      (window.__TEAMS__||[]).forEach(function(t){
        if(t.id!==block.getAttribute('data-team')) return;
        (t.tasks||[]).forEach(function(k){
          (k.dependencies||[]).forEach(function(dep){
            var a=segs[dep], b=segs[k.id]; if(!a||!b) return;
            var col=a.getAttribute('data-color')||'#3b6cf6';
            var mi=palette.indexOf(col); if(mi<0) mi=0;
            var ar=a.getBoundingClientRect(), bb=b.getBoundingClientRect();
            var x1=ar.left-br.left+ar.width, y1=ar.top-br.top+ar.height/2;
            var x2=bb.left-br.left, y2=bb.top-br.top+bb.height/2;
            var sameLane=Math.abs(y1-y2)<2;
            var d;
            if(sameLane){
              var dx=Math.max(18,Math.abs(x2-x1)/2);
              d='M'+x1+','+y1+' C'+(x1+dx)+','+(y1-14)+' '+(x2-dx)+','+(y2-14)+' '+x2+','+y2;
            } else {
              var mx=Math.max(30,Math.abs(x2-x1)*0.5);
              d='M'+x1+','+y1+' C'+(x1+mx)+','+y1+' '+(x2-mx)+','+y2+' '+x2+','+y2;
            }
            var p=document.createElementNS('http://www.w3.org/2000/svg','path');
            p.setAttribute('d',d);
            p.setAttribute('fill','none'); p.setAttribute('stroke',col); p.setAttribute('stroke-width','1.6');
            p.setAttribute('stroke-dasharray','5 3'); p.setAttribute('opacity','.9');
            p.setAttribute('marker-end','url(#tla'+mi+')');
            svg.appendChild(p);
            var dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
            dot.setAttribute('cx',x1); dot.setAttribute('cy',y1); dot.setAttribute('r',2.4); dot.setAttribute('fill',col);
            svg.appendChild(dot);
          });
        });
      });
    });
  }
  function refresh(){ drawTreeLines(); drawTimelineLinks(); }
  window.addEventListener('load',refresh); window.addEventListener('resize',refresh);
  setTimeout(refresh,60);

  /* 抽屉：点节点看会话（保留） */
  var drw=document.getElementById('drw');
  function esc2(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function tasksOf(sid,name){var out=[];(window.__TEAMS__||[]).forEach(function(t){var m=(t.members||[]).filter(function(x){return x.id===sid||x.name===name;})[0];if(!m)return;(t.tasks||[]).forEach(function(k){if(k.assignee===m.name||k.assignee===m.id)out.push(k);});});return out;}
  function openNode(el){
    var sid=el.getAttribute('data-sid')||''; var name=el.getAttribute('data-name')||'成员';
    drw.classList.add('open');
    document.getElementById('drwName').textContent=name;
    document.getElementById('drwMeta').textContent=sid||'（该节点还没有会话）';
    var body=document.getElementById('drwBody');
    var tk=tasksOf(sid,name);
    var head='';
    if(tk.length){ head+='<div class="drw-sec">负责任务</div>'+tk.map(function(k){return '<div class="tk"><b>'+esc2(k.subject||k.title||'')+'</b><span>'+esc2(k.status||'')+'</span></div>';}).join(''); }
    body.innerHTML=head+'<div class="drw-sec">对话</div><div class="hint">加载中…</div>';
    if(!sid) return;
    fetch(api('/api/session?id='+encodeURIComponent(sid))).then(function(r){return r.json();}).then(function(d){
      var html=head;
      if(d.title) html+='<div class="drw-title">'+esc2(d.title)+'</div>';
      html+='<div class="drw-sub">会话 '+esc2(sid)+' · '+(d.messages?d.messages.length:0)+' 条消息</div><div class="drw-sec">最近对话</div>';
      (d.messages||[]).slice(-30).forEach(function(m){ html+='<div class="msg '+m.role+'"><div class="who">'+(m.role==='user'?'我':'助手')+'</div><div class="txt">'+esc2(String(m.text||'').slice(0,1500))+'</div></div>'; });
      body.innerHTML=html;
    }).catch(function(){ body.innerHTML=head+'<div class="drw-sec">对话</div><div class="hint">读取失败</div>'; });
  }
  document.addEventListener('click',function(e){
    var n=e.target.closest?e.target.closest('.node[data-sid]'):null;
    if(n){ openNode(n); return; }
    if(e.target.id==='drwClose'||e.target===drw) drw.classList.remove('open');
  });

  /* 账本自动同步：外部新建 / 归档 / 覆盖后，2.5 秒内页面自动刷新（弹窗打开时等它关掉） */
  var SYNC_MS = 2500, __syncKey = null, __pendingReload = false;
  function syncBusy(){ return !!document.querySelector('.fv.open, .drw.open, .dragging'); }
  function setSync(text, color){
    var el = document.getElementById('syncState');
    if(!el) return;
    el.textContent = text;
    if(color) el.style.color = color;
  }
  function syncReloadIfFree(){
    if(__pendingReload && !syncBusy()){ __pendingReload = false; location.reload(); }
  }
  function syncTick(){
    if(!window.fetch) return;
    fetch(api('/api/version'), { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(v){
      if(!v || v.ok === false || v.revision === undefined) return;
      var key = String(v.revision) + ':' + String(v.count) + ':' + String(Math.round(v.mtimeMs));
      if(__syncKey === null){ __syncKey = key; setSync('● 自动同步 ' + new Date().toLocaleTimeString('zh-CN')); return; }
      if(key !== __syncKey){
        __syncKey = key;
        var healTip = (v.healed && v.healed.healed) ? ('已自动找回 ' + v.healed.healed + ' 条被外部覆盖的任务，') : '';
        if(syncBusy()){ __pendingReload = true; setSync('● ' + healTip + '有更新，关掉弹窗后自动刷新', '#f79009'); }
        else { setSync('● ' + healTip + '发现改动，刷新中…', '#3b6cf6'); location.reload(); }
      }
    }).catch(function(){});
  }
  syncTick();
  setInterval(syncTick, SYNC_MS);
  setInterval(syncReloadIfFree, 900);
})();
</script></body></html>`;
  return html;
}

// 工作区入口页：每个工作区一张卡，点进去就是那个工作区自己的工作台
export function renderSpaces(spaces, opts = {}) {
  const list = spaces || [];
  const cards = list.map((s) => {
    const t = s.tasks || [];
    const todo = t.filter((x) => x.status === 'todo' || x.status === 'running').length;
    const done = t.filter((x) => x.status === 'done').length;
    const backlog = t.filter((x) => x.status === 'backlog').length;
    const pctDone = t.length ? Math.round((done / t.length) * 100) : 0;
    const href = '/?ws=' + encodeURIComponent(s.id || s.path);
    const cur = opts.current && s.id === opts.current ? ' cur' : '';
    return `<a class="wcard${cur}" href="${href}">
      <div class="wc-h"><span class="wc-t">${esc(s.title)}</span><span class="wc-go">打开工作台 →</span></div>
      <div class="wc-p" title="${esc(s.path)}">${esc(s.path)}</div>
      <div class="wc-stats"><span><b>${todo}</b> 待办</span><span><b>${done}</b> 完成</span><span><b>${backlog}</b> 长期</span><span><b>${(s.teams || []).length}</b> 团队</span><span><b>${s.projects || 0}</b> 项目书</span></div>
      <div class="wc-bar"><i style="width:${pctDone}%"></i></div>
    </a>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工作台 · 全部工作区</title><style>
  :root{--ink:#232a35;--mut:#8b95a7;--line:#e3e8f0;--bg:#f6f8fc}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.7 "Segoe UI",system-ui,sans-serif;color:var(--ink);background:radial-gradient(1200px 500px at 10% -10%,#eaf0ff,transparent),var(--bg);min-height:100vh}
  .wrap{max-width:1080px;margin:0 auto;padding:44px 26px 60px}
  h1{margin:0 0 6px;font-size:26px;letter-spacing:.5px}
  .sub{color:var(--mut);margin-bottom:26px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .wcard{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 18px 14px;box-shadow:0 6px 20px rgba(35,42,53,.05);transition:.18s}
  .wcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(35,42,53,.10);border-color:#c9d8fb}
  .wcard.cur{border-color:#3b6cf6;box-shadow:0 0 0 3px #e8efff}
  .wc-h{display:flex;align-items:baseline;gap:10px;justify-content:space-between}
  .wc-t{font-size:18px;font-weight:700}
  .wc-go{font-size:12px;color:#3b6cf6;white-space:nowrap}
  .wc-p{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--mut);margin:6px 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wc-stats{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--mut)}
  .wc-stats b{color:var(--ink);font-size:14px;margin-right:2px}
  .wc-bar{margin-top:12px;height:6px;border-radius:999px;background:#eef1f7;overflow:hidden}
  .wc-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#7aa2ff,#3b6cf6)}
  footer{margin-top:30px;color:var(--mut);font-size:12px}
  </style></head><body><div class="wrap">
  <h1>🗂 工作台 · 全部工作区</h1>
  <div class="sub">每个工作区各自一套：任务绳、团队树、时间轨道、项目书。点卡片进入它的工作台。</div>
  <div class="grid">${cards || '<div class="sub">还没有登记工作区</div>'}</div>
  <footer>数据来自 .dsh/storages/workspace.json 与 core/data/board.json（按 wsId 归到各工作区）</footer>
  </div></body></html>`;
}

if (process.argv[1] && process.argv[1].endsWith('stage.mjs')) {
  const args = process.argv.slice(2);
  const ws = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : process.cwd();
  const demo = args.includes('--demo');
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(ws, 'team-view', 'stage.html');
  fs.writeFileSync(out, renderStage(ws, { demo }), 'utf8');
  console.log('written', out, fs.statSync(out).size, 'bytes');
}
