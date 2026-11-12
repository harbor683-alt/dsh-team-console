// 团队控制台 P1：左侧团队卡 + 中间 DAG 依赖图 + 右侧详情抽屉（五标签）
// 用法：renderConsole(ws, { demo }) → HTML 字符串
import { loadTeams } from './workbench.mjs';

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
      { id: 'k1', subject: '备份 system / boot / vendor', status: 'running', assignee: 'assistant-1', dependencies: [], output: '' },
      { id: 'k2', subject: '下载 Android 10 GSI 镜像', status: 'completed', assignee: 'assistant-2', dependencies: [], output: 'lineage-17.1-arm64-aonly.zip' },
      { id: 'k3', subject: '刷入 GSI 并验证开机', status: 'pending', assignee: 'assistant-1', dependencies: ['k1', 'k2'], output: '' },
      { id: 'k4', subject: '复核刷机步骤', status: 'pending', assignee: 'reviewer-1', dependencies: ['k3'], output: '' },
      { id: 'k5', subject: '写刷机记录文档', status: 'completed', assignee: 'assistant-2', dependencies: ['k2'], output: 'docs/flash-log.md' },
    ],
    messages: [
      { from: 'assistant-1', to: 'captain', content: 't1 完成：当前目录 D:\\your-workspace', ts: 1 },
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
    tasks: [
      { id: 'k6', subject: '润色第三章', status: 'completed', assignee: 'assistant-3', dependencies: [], output: '已输出 Markdown' },
    ],
    messages: [{ from: 'assistant-3', to: 'captain', content: '第三章润色完成，标点与术语已统一', ts: 1 }],
  },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const css = String.raw`
:root{--ink:#1c1f24;--muted:#8a919c;--line:#e6e8ec;--bg:#f7f8fa;--run:#3b6cf6;--done:#12b76a;--bad:#f04438;--warn:#f79009}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wbnav{display:flex;gap:8px;padding:10px 20px 0;font-size:12px}.wbnav a{padding:5px 11px;border-radius:999px;border:1px solid #e2e6ee;background:#fff;color:#475569;text-decoration:none}.wbnav a.on{background:#111827;color:#fff;border-color:#111827}
.wrap{padding:16px 20px 40px}
h1{font-size:17px;margin:0 0 2px}.sub{color:var(--muted);font-size:12px}
.console{display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px;margin-top:14px;align-items:start}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}
.panel h3{margin:0 0 10px;font-size:12px;letter-spacing:.06em;color:#8a919c;font-weight:600}
.team-card{border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin-bottom:10px;cursor:pointer;transition:.12s;background:#fff}
.team-card:hover{border-color:#c9d4f8;box-shadow:0 6px 18px rgba(30,50,110,.07)}
.team-card.on{border-color:#bcd0ff;background:#f7faff}
.team-card .tl{display:flex;align-items:center;gap:8px}
.team-card .nm{font-weight:600;font-size:13px}
.dot{width:8px;height:8px;border-radius:50%;background:#d7dbe2;flex:none}
.dot.g{background:var(--done)}.dot.r{background:var(--bad)}
.team-card .meta{color:var(--muted);font-size:11px;margin-top:4px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.chip{font-size:10px;padding:2px 6px;border-radius:20px;background:#f2f4f8;color:#5b6472}
.chip.captain{background:#fff1e6;color:#b45309}.chip.lead{background:#efe9ff;color:#6d28d9}
.chip.worker{background:#e8f0ff;color:#1d4ed8}.chip.reviewer{background:#e6fbf4;color:#047857}
.mrow{display:flex;gap:6px;margin-top:8px}
.mini{font-size:11px;padding:3px 8px;border-radius:7px;border:1px solid #dfe4ec;background:#fff;color:#475569;cursor:pointer}
.mini:hover{background:#f4f7fd}
.dag-wrap{position:relative;overflow:auto;min-height:420px}
svg.dag{display:block;min-width:100%}
.node-rect{fill:#fff;stroke:#dfe4ec;stroke-width:1;rx:10}
.node-rect.pending{stroke:#dfe4ec}
.node-rect.running{stroke:#bcd0ff;fill:#f7faff}
.node-rect.completed{stroke:#bfe9d2;fill:#f7fdfa}
.node-rect.failed{stroke:#fbd5d1;fill:#fff7f6}
.node-title{font-size:12px;font-weight:600;fill:#1f2430}
.node-sub{font-size:10px;fill:#8a919c}
.edge{fill:none;stroke:#cfd6e2;stroke-width:1.6}
.edge.hot{stroke:#9db8ff}
.legend{display:flex;gap:12px;color:var(--muted);font-size:11px;margin-top:8px}
.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:middle}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:10px;flex-wrap:wrap}
.tab{font-size:12px;padding:5px 9px;border-radius:8px 8px 0 0;cursor:pointer;color:#64748b;border:1px solid transparent;border-bottom:none}
.tab.on{color:#1f2430;font-weight:600;background:#f7faff;border-color:#e6e8ec}
.tabbody{font-size:12px;color:#3f4756;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}
.empty{color:#a2a8b3;font-size:12px;padding:20px 0;text-align:center}
.kv{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #f0f2f6}
footer{margin-top:20px;color:#a2a8b3;font-size:11px;text-align:center}
`;

function dagSvg(team) {
  const tasks = team.tasks || [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depthCache = new Map();
  const depth = (t, seen = new Set()) => {
    if (depthCache.has(t.id)) return depthCache.get(t.id);
    if (seen.has(t.id)) return 0;
    seen.add(t.id);
    let d = 0;
    for (const dep of t.dependencies || []) {
      const p = byId.get(dep);
      if (p) d = Math.max(d, depth(p, seen) + 1);
    }
    depthCache.set(t.id, d);
    return d;
  };
  const layers = new Map();
  for (const t of tasks) {
    const d = depth(t);
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(t);
  }
  const NW = 200, NH = 58, GX = 70, GY = 24;
  const maxLayer = Math.max(0, ...[...layers.keys()]);
  const maxRows = Math.max(1, ...[...layers.values()].map((a) => a.length));
  const width = 40 + (maxLayer + 1) * (NW + GX);
  const height = 30 + maxRows * (NH + GY);
  const pos = new Map();
  const nodes = [];
  for (const [d, arr] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    arr.forEach((t, i) => {
      const x = 20 + d * (NW + GX);
      const y = 20 + i * (NH + GY) + Math.max(0, (maxRows - arr.length) * (NH + GY) / 2);
      pos.set(t.id, { x, y });
      nodes.push({ t, x, y });
    });
  }
  const edges = [];
  for (const t of tasks) {
    for (const dep of t.dependencies || []) {
      const a = pos.get(dep), b = pos.get(t.id);
      if (!a || !b) continue;
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
      const mx = (x1 + x2) / 2;
      edges.push(`<path class="edge${t.status === 'running' ? ' hot' : ''}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" marker-end="url(#arrow)"/>`);
    }
  }
  const st = (s) => (s === 'completed' ? 'completed' : s === 'running' ? 'running' : s === 'failed' ? 'failed' : 'pending');
  const rects = nodes.map(({ t, x, y }) => `<g class="gnode" data-id="${esc(t.id)}" style="cursor:pointer">
      <rect class="node-rect ${st(t.status)}" x="${x}" y="${y}" width="${NW}" height="${NH}" rx="10"/>
      <text class="node-title" x="${x + 12}" y="${y + 24}">${esc(String(t.subject || '(未命名)').slice(0, 22))}</text>
      <text class="node-sub" x="${x + 12}" y="${y + 42}">${esc(t.assignee || '未指派')} · ${esc(t.status)}</text>
    </g>`).join('');
  return `<svg class="dag" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#cfd6e2"/></marker></defs>
    ${edges.join('')}${rects}</svg>`;
}

export function renderConsole(wsRoot, opts = {}) {
  const teams = opts.demo ? DEMO_TEAMS : loadTeams(wsRoot);
  const data = teams.map((t) => ({
    id: t.id, name: t.name, description: t.description, archived: t.archived,
    members: t.members, tasks: t.tasks || [], messages: t.messages || [],
  }));
  const first = data[0];
  const firstSvg = first ? dagSvg(first) : '<div class="empty">还没有团队</div>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>团队控制台</title><style>${css}</style></head><body>
<div style="max-width:1280px;margin:0 auto;padding:12px 24px 0"><div style="display:inline-flex;gap:4px;padding:5px;background:#fff;border:1px solid #e6e8ec;border-radius:999px;box-shadow:0 2px 10px rgba(15,23,42,.06)"><a href="http://127.0.0.1:8787/" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;color:#475569">🧺 晾衣绳工作台</a><a href="http://127.0.0.1:8787/?view=console" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;background:#111827;color:#fff">🧭 团队控制台</a><a href="http://127.0.0.1:8787/?view=orchestra" style="text-decoration:none;font-size:12px;padding:5px 12px;border-radius:999px;color:#475569">🛰️ 编排视图</a></div></div>
<div class="wrap">
  <h1>团队控制台</h1>
  <div class="sub">左侧团队 · 中间任务依赖图（DAG）· 点任务节点看详情${opts.demo ? ' · 示例数据' : ''}</div>
  <div class="console">
    <aside class="panel"><h3>团队</h3><div id="teams"></div></aside>
    <main class="panel">
      <h3 id="dagtitle">任务依赖图</h3>
      <div class="dag-wrap" id="dag">${firstSvg}</div>
      <div class="legend"><span><i style="background:#dfe4ec"></i>待处理</span><span><i style="background:#bcd0ff"></i>进行中</span><span><i style="background:#bfe9d2"></i>已完成</span><span><i style="background:#fbd5d1"></i>失败</span></div>
      <h3 style="margin-top:16px">详情</h3>
      <div class="tabs" id="tabs"></div><div class="tabbody" id="tabbody">点上面的任务节点，或左侧团队卡查看详情</div>
    </main>
  </div>
  <footer>P1 骨架 · 数据来自 .agent-teams · node console.mjs 重新生成</footer>
</div>
<script>
const TEAMS = ${JSON.stringify(data)};
const FIRST_SVG = ${JSON.stringify(firstSvg)};
function statusDot(t){ const w=t.members.some(m=>m.status==='working'); const f=t.tasks.some(x=>x.status==='failed'); return f?'r':w?'g':''; }
function roleChip(role){ const r=String(role||''); return 'chip '+(r.includes('captain')?'captain':r.includes('lead')?'lead':r.includes('review')?'reviewer':'worker'); }
function renderTeams(active){
  document.getElementById('teams').innerHTML = TEAMS.map((t,i)=>{
    const done=t.tasks.filter(x=>x.status==='completed').length;
    return '<div class="team-card '+(i===active?'on':'')+'" data-i="'+i+'">'+
      '<div class="tl"><span class="dot '+statusDot(t)+'"></span><span class="nm">'+t.name+'</span></div>'+
      '<div class="meta">'+t.members.length+' 成员 · '+done+'/'+t.tasks.length+' 完成'+(t.archived?' · 已归档':'')+'</div>'+
      '<div class="chips">'+t.members.map(m=>'<span class="'+roleChip(m.role)+'">'+m.name+'</span>').join('')+'</div>'+
      '<div class="mrow"><button class="mini" data-act="start" data-t="'+t.id+'">▶ 启动</button><button class="mini" data-act="pause" data-t="'+t.id+'">⏸ 暂停</button></div>'+
    '</div>';
  }).join('');
  document.querySelectorAll('#teams .team-card').forEach(c=>c.addEventListener('click',e=>{
    if(e.target.closest('.mini')) return;
    const i=+c.dataset.i; selectTeam(i);
  }));
  document.querySelectorAll('#teams .mini').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    alert('P1 只做界面骨架；“'+e.target.dataset.act+'”按钮将在 P2 接上 agent_teams 指令。');
  }));
}
function teamSvg(t){ return FIRST_SVG; }
function selectTeam(i){
  renderTeams(i);
  window.__active=i;
  const t=TEAMS[i];
  document.getElementById('dagtitle').textContent='任务依赖图 · '+t.name;
  document.getElementById('dag').innerHTML = svgFor(t);
  document.getElementById('tabs').innerHTML='';
  document.getElementById('tabbody').textContent='点上面的任务节点查看详情';
  bindNodes();
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function svgFor(team){
  const tasks=team.tasks||[], byId=new Map(tasks.map(t=>[t.id,t])), cache=new Map();
  function depth(t,seen){ if(cache.has(t.id))return cache.get(t.id); seen=seen||new Set(); if(seen.has(t.id))return 0; seen.add(t.id);
    let d=0; for(const dep of (t.dependencies||[])){ const p=byId.get(dep); if(p) d=Math.max(d,depth(p,seen)+1);} cache.set(t.id,d); return d; }
  const layers=new Map(); tasks.forEach(t=>{const d=depth(t); if(!layers.has(d))layers.set(d,[]); layers.get(d).push(t);});
  const NW=200,NH=58,GX=70,GY=24;
  const maxLayer=Math.max(0,...[...layers.keys()]);
  const maxRows=Math.max(1,...[...layers.values()].map(a=>a.length));
  const W=40+(maxLayer+1)*(NW+GX), H=30+maxRows*(NH+GY);
  const pos=new Map(), nodes=[];
  [...layers.entries()].sort((a,b)=>a[0]-b[0]).forEach(([d,arr])=>{
    arr.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    arr.forEach((t,i)=>{ const x=20+d*(NW+GX); const y=20+i*(NH+GY)+Math.max(0,(maxRows-arr.length)*(NH+GY)/2); pos.set(t.id,{x,y}); nodes.push({t,x,y}); });
  });
  const edges=[];
  tasks.forEach(t=>(t.dependencies||[]).forEach(dep=>{
    const a=pos.get(dep), b=pos.get(t.id); if(!a||!b)return;
    const x1=a.x+NW,y1=a.y+NH/2,x2=b.x,y2=b.y+NH/2,mx=(x1+x2)/2;
    edges.push('<path class="edge'+(t.status==='running'?' hot':'')+'" d="M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2+'" marker-end="url(#arrow)"/>');
  }));
  const cls=s=>s==='completed'?'completed':s==='running'?'running':s==='failed'?'failed':'pending';
  const rects=nodes.map(({t,x,y})=>'<g class="gnode" data-id="'+esc(t.id)+'" style="cursor:pointer"><rect class="node-rect '+cls(t.status)+'" x="'+x+'" y="'+y+'" width="'+NW+'" height="'+NH+'" rx="10"/><text class="node-title" x="'+(x+12)+'" y="'+(y+24)+'">'+esc(String(t.subject||'(未命名)').slice(0,22))+'</text><text class="node-sub" x="'+(x+12)+'" y="'+(y+42)+'">'+esc(t.assignee||'未指派')+' · '+esc(t.status)+'</text></g>').join('');
  return '<svg class="dag" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#cfd6e2"/></marker></defs>'+edges.join('')+rects+'</svg>';
}
const TABS=['Output','Thinking','Skills & MCP','Tools','History'];
function openTask(task){
  document.getElementById('tabs').innerHTML=TABS.map((x,i)=>'<div class="tab '+(i===0?'on':'')+'" data-t="'+i+'">'+x+'</div>').join('');
  const body=document.getElementById('tabbody');
  const render=(i)=>{
    document.querySelectorAll('#tabs .tab').forEach((el,j)=>el.classList.toggle('on',i===j));
    if(i===0) body.textContent = task.output || '（还没有输出）';
    else if(i===1) body.textContent = '状态：'+task.status+'\\n负责人：'+(task.assignee||'未指派')+'\\n依赖：'+((task.dependencies||[]).join(', ')||'无');
    else if(i===2) body.textContent = 'P1 先占位：这里将列出 MCP Server / Skills / 内置工具的调用频次与详情。';
    else if(i===3) body.textContent = 'P1 先占位：这里将列出原始工具调用参数与返回。';
    else body.textContent = 'P1 先占位：这里将显示该任务的执行历史（尝试次数、时间线）。';
  };
  render(0);
  document.querySelectorAll('#tabs .tab').forEach(el=>el.addEventListener('click',()=>render(+el.dataset.t)));
}
function bindNodes(){
  document.querySelectorAll('.gnode').forEach(g=>g.addEventListener('click',()=>{
    const team=TEAMS[window.__active||0];
    const task=(team.tasks||[]).find(x=>String(x.id)===g.dataset.id);
    if(task) openTask(task);
  }));
}
window.__active=0;
renderTeams(0); bindNodes();
</script></body></html>`;
}
