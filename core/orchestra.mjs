// 编排视图：左侧执行成员卡 + 中间主代理 + 右侧产物/报告 + 底部时间轨道
// 保留工作台原有浅色配色；数据来自 .agent-teams
import { loadTeams } from './workbench.mjs';

const DEMO = [
  {
    id: 'o1', name: '智能门锁 · 国内外竞品调研与报告交付', description: '拆解竞品调研为 6 个子任务，分发给 5 个执行成员，汇总为报告与产物。', archived: false,
    members: [
      { name: 'Codex', role: 'worker', model: 'gpt-5-codex', status: 'working' },
      { name: 'ZCode', role: 'worker', model: 'glm-4.6', status: 'idle' },
      { name: 'Devin', role: 'worker', model: 'swe-1.5', status: 'idle' },
      { name: 'OpenCode', role: 'worker', model: 'space-bunny', status: 'failed' },
      { name: 'DSH', role: 'worker', model: 'deepseek-v3.2', status: 'queued' },
    ],
    tasks: [
      { id: 'T1', subject: '抓取国内电商评论与评分', status: 'completed', assignee: 'Codex', output: 'data/reviews_cn.json', start: 0, end: 6 },
      { id: 'T2', subject: '整理海外论坛与 Amazon 口碑', status: 'completed', assignee: 'ZCode', output: 'research/overseas_voice.md', start: 4, end: 11 },
      { id: 'T3', subject: '价格带与渠道分析', status: 'completed', assignee: 'Devin', output: 'analysis/pricing.csv', start: 8, end: 15 },
      { id: 'T4', subject: '专利与安全认证检索', status: 'failed', assignee: 'OpenCode', output: '', start: 10, end: 14 },
      { id: 'T5', subject: '功能矩阵对比表', status: 'running', assignee: 'Codex', output: '', start: 16, end: 24 },
      { id: 'T6', subject: '撰写竞品调研报告', status: 'pending', assignee: 'DSH', output: '', start: 24, end: 32 },
    ],
    report: [
      'T3 价格带集中在 999–1999 元，线上渠道占比 71%，高端用户更关注静音与续航。',
      'T2 海外口碑：电池续航与 App 稳定性是最大痛点，隐私合规提及率高。',
      'T4 检索接口返回 429 限流，已记录已检索到的 18 条专利，待重试。',
      'T1 国内主流平台评论 2,431 条已清洗入库，差评集中在指纹识别失败。',
    ],
  },
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  running: { color: '#3b6cf6', label: '运行中' },
  done: { color: '#12b76a', label: '已完成' },
  failed: { color: '#f04438', label: '失败' },
  pending: { color: '#f79009', label: '待执行' },
};
const stOf = (s) => (s === 'completed' || s === 'done' ? 'done' : s === 'running' ? 'running' : s === 'failed' ? 'failed' : 'pending');

function membersOf(team) {
  const ms = (team.members || []).filter((m) => String(m.role || '').indexOf('captain') === -1);
  if (ms.length) return ms;
  const names = [...new Set((team.tasks || []).map((t) => t.assignee).filter(Boolean))];
  return names.map((n) => ({ name: n, role: 'worker', model: '', status: '' }));
}

function normalize(team) {
  const tasks = (team.tasks || []).map((t, i) => ({
    id: t.id || 'T' + (i + 1),
    subject: t.subject || t.title || '(未命名任务)',
    status: t.status,
    assignee: t.assignee || '未指派',
    output: t.output || '',
    start: typeof t.start === 'number' ? t.start : i * 4,
    end: typeof t.end === 'number' ? t.end : i * 4 + 6,
  }));
  const maxEnd = Math.max(1, ...tasks.map((t) => t.end));
  return { ...team, tasks, maxEnd };
}

const css = String.raw`
:root{--ink:#1c1f24;--muted:#8a919c;--line:#e6e8ec;--bg:#f7f8fa;--run:#3b6cf6;--done:#12b76a;--bad:#f04438;--warn:#f79009}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wbnav{display:flex;gap:8px;padding:12px 24px 0;max-width:1280px;margin:0 auto}
.wbnav a{padding:5px 11px;border-radius:999px;border:1px solid #e2e6ee;background:#fff;color:#475569;text-decoration:none;font-size:12px}
.wbnav a.on{background:#111827;color:#fff;border-color:#111827}
.wrap{max-width:1280px;margin:0 auto;padding:16px 24px 40px}
.head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.head .demo{font-size:11px;padding:2px 8px;border-radius:6px;background:#eef2ff;color:#3b5bdb;border:1px solid #dbe3ff}
.head h1{font-size:17px;margin:0}
.head .sub{color:var(--muted);font-size:12px;width:100%;margin-top:2px}
.head .state{margin-left:auto;font-size:12px;color:#0f9f6e;display:flex;align-items:center;gap:6px}
.head .state i{width:7px;height:7px;border-radius:50%;background:#12b76a;display:inline-block}
.board{position:relative;display:grid;grid-template-columns:290px minmax(0,1fr) 290px;gap:46px;margin-top:16px;align-items:start}
.board svg.wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible}
.col{position:relative;z-index:1}
.col h3{margin:2px 0 10px;font-size:12px;letter-spacing:.06em;color:#8a919c;font-weight:600;display:flex;align-items:center;gap:6px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 2px 10px rgba(20,35,80,.04)}
.agent{padding:10px 12px;margin-bottom:10px}
.agent .top{display:flex;align-items:center;gap:8px}
.avatar{width:26px;height:26px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex:none}
.agent .nm{font-weight:600;font-size:13px}
.agent .md{color:var(--muted);font-size:11px}
.badge{margin-left:auto;font-size:10px;padding:2px 7px;border-radius:999px;border:1px solid}
.tlist{margin-top:8px;display:flex;flex-direction:column;gap:5px}
.trow{display:flex;align-items:center;gap:6px;font-size:11px;color:#3f4756}
.tid{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#8a919c;min-width:22px}
.tst{margin-left:auto;color:#8a919c}
.dot{width:7px;height:7px;border-radius:50%;flex:none}
.maincard{padding:16px 18px;border-radius:16px}
.maincard .top{display:flex;align-items:center;gap:10px}
.maincard .big{width:38px;height:38px;border-radius:12px;background:#3b6cf6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.maincard .who b{font-size:15px}
.maincard .who .r{display:block;color:#8a919c;font-size:11px}
.maincard .online{margin-left:auto;font-size:11px;color:#0f9f6e}
.goal{margin-top:12px;background:#f7f9ff;border:1px dashed #dbe4ff;border-radius:10px;padding:8px 10px}
.goal label{font-size:10px;color:#5b6b8c;letter-spacing:.06em}
.goal p{margin:3px 0 0;font-size:13px}
.tasks{margin-top:12px;border-top:1px solid #f0f2f6;padding-top:6px}
.tr{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #f2f4f8;font-size:12px}
.tr:last-child{border-bottom:0}
.tr .s{margin-left:auto;font-size:11px}
.handoff{margin-top:10px;text-align:center;color:#a2a8b3;font-size:11px}
.outbox{padding:10px 12px;margin-bottom:10px}
.outrow{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;color:#3f4756;padding:5px 0;border-bottom:1px dashed #f2f4f8}
.outrow:last-child{border-bottom:0}
.outrow .ic{color:#8a919c;flex:none}
.rep{font-size:11.5px;color:#3f4756;line-height:1.6}
.rep b{color:#1c1f24}
.timeline{margin-top:18px;padding:14px 16px}
.tl-head{display:flex;align-items:center;gap:8px;font-size:12px;color:#8a919c;margin-bottom:8px}
.lane{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:10px;height:30px}
.lane .who{font-size:11px;color:#475569;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{position:relative;height:14px;background:#f2f4f8;border-radius:7px}
.seg{position:absolute;top:3px;height:8px;border-radius:4px;opacity:.9}
.axis{display:flex;justify-content:space-between;color:#a2a8b3;font-size:10px;margin-top:4px;padding-left:98px}
footer{margin-top:18px;color:#a2a8b3;font-size:11px;text-align:center}
.empty{color:#a2a8b3;font-size:12px;padding:16px;text-align:center}
`;

export function renderOrchestra(wsRoot, opts = {}) {
  const teams = opts.demo ? DEMO : loadTeams(wsRoot);
  const team = normalize(teams[0] || { name: '（还没有团队）', tasks: [], members: [], description: '' });
  const members = membersOf(team);
  const tasks = team.tasks;

  const agentCards = members.map((m, i) => {
    const mt = tasks.filter((t) => t.assignee === m.name);
    const st = m.status === 'working' ? 'running' : m.status === 'failed' ? 'failed' : mt.some((t) => t.status === 'running') ? 'running' : 'idle';
    const color = st === 'running' ? STATUS.running.color : st === 'failed' ? STATUS.bad : '#c6ccd6';
    const badge = st === 'running' ? '运行中' : st === 'failed' ? '有失败' : '已完成';
    const rows = mt.length
      ? mt.map((t) => {
          const s = STATUS[stOf(t.status)];
          return `<div class="trow"><span class="tid">${esc(t.id)}</span><span>${esc(String(t.subject).slice(0, 16))}</span><span class="tst" style="color:${s.color}">${s.label}</span></div>`;
        }).join('')
      : '<div class="trow" style="color:#a2a8b3">暂无任务</div>';
    return `<div class="card agent" data-agent="${esc(m.name)}" data-color="${color}">
      <div class="top"><div class="avatar" style="background:${color}">${esc(String(m.name).slice(0, 1).toUpperCase())}</div>
        <div><div class="nm">${esc(m.name)}</div><div class="md">${esc(m.model || m.role || '')}</div></div>
        <span class="badge" style="color:${color};border-color:${color}33;background:${color}12">● ${badge}</span></div>
      <div class="tlist">${rows}</div>
    </div>`;
  }).join('');

  const taskRows = tasks.map((t) => {
    const s = STATUS[stOf(t.status)];
    return `<div class="tr"><span class="tid">${esc(t.id)}</span><span>${esc(t.subject)}</span><span class="s" style="color:${s.color}">${s.label}</span></div>`;
  }).join('');

  const outs = tasks.filter((t) => t.output).map((t) => `<div class="outrow"><span class="ic">📄</span><div><div>${esc(t.output)}</div><div style="color:#a2a8b3;font-size:10px">${esc(t.id)} · ${esc(t.assignee)}</div></div></div>`).join('');

  const report = (team.report || []).map((r) => `<div class="outrow"><span class="ic">•</span><div>${esc(r)}</div></div>`).join('')
    || tasks.filter((t) => t.status === 'completed' && t.output).map((t) => `<div class="outrow"><span class="ic">•</span><div><b>${esc(t.id)}</b> ${esc(t.subject)} — ${esc(t.output)}</div></div>`).join('')
    || '<div class="outrow" style="color:#a2a8b3">暂无汇报</div>';

  const lanes = members.map((m) => {
    const segs = tasks.filter((t) => t.assignee === m.name).map((t) => {
      const left = (t.start / team.maxEnd) * 100;
      const width = Math.max(2, ((t.end - t.start) / team.maxEnd) * 100);
      const c = STATUS[stOf(t.status)].color;
      return `<span class="seg" title="${esc(t.id)} ${esc(t.subject)}" style="left:${left}%;width:${width}%;background:${c}"></span>`;
    }).join('');
    return `<div class="lane"><div class="who"><span class="dot" style="background:${m.status === 'failed' ? STATUS.bad : '#9aa4b2'}"></span>${esc(m.name)}</div><div class="track">${segs}</div></div>`;
  }).join('');

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>编排视图</title><style>${css}</style></head><body>
<div class="wbnav"><a href="http://127.0.0.1:8787/">🧺 晾衣绳工作台</a><a href="http://127.0.0.1:8787/?view=console">🧭 团队控制台</a><a class="on" href="http://127.0.0.1:8787/?view=orchestra">🛰️ 编排视图</a></div>
<div class="wrap">
  <div class="head"><span class="demo">${opts.demo ? '演示 · 模拟运行' : '实时数据'}</span><h1>${esc(team.name)}</h1><div class="state"><i></i>在线</div>
    <div class="sub">${esc(team.description || '')}</div></div>

  <div class="board" id="board">
    <svg class="wires" id="wires"></svg>
    <section class="col"><h3>执行成员 <span>${members.length}</span></h3>${agentCards || '<div class="card empty">还没有成员</div>'}</section>

    <section class="col"><h3>主代理 · 拆解 / 派发 / 汇总</h3>
      <div class="card maincard">
        <div class="top"><div class="big">主</div><div class="who"><b>${esc(team.captainName || '主控')}</b><span class="r">拆解 · 派发 · 汇总</span></div><span class="online">● 在线</span></div>
        <div class="goal"><label>当前目标</label><p>${esc(team.description || team.name || '')}</p></div>
        <div class="tasks">${taskRows || '<div class="tr" style="color:#a2a8b3">暂无任务</div>'}</div>
        <div class="handoff">子代理结果汇入，主代理整合分发</div>
      </div>
    </section>

    <section class="col"><h3>产物与报告</h3>
      <div class="card outbox"><div class="rep"><b>产物</b> ${tasks.filter((t) => t.output).length} 个</div>${outs || '<div class="outrow" style="color:#a2a8b3">暂无产物</div>'}</div>
      <div class="card outbox"><div class="rep"><b>任务报告</b></div>${report}</div>
    </section>
  </div>

  <div class="card timeline">
    <div class="tl-head">时间轨道 <span style="color:#c6ccd6">· 每条泳道是一个成员，色块是它的任务区间</span></div>
    ${lanes || '<div class="empty">暂无任务</div>'}
    <div class="axis"><span>开始</span><span>推进中</span><span>现在</span></div>
  </div>
  <footer>${opts.demo ? '演示数据' : '数据来自 .agent-teams'} · ${new Date().toLocaleString('zh-CN')}</footer>
</div>
<script>
(function(){
  var board = document.getElementById('board');
  var svg = document.getElementById('wires');
  if (!board || !svg) return;
  function draw(){
    var br = board.getBoundingClientRect();
    var main = board.querySelector('.maincard');
    if (!main) return;
    var mr = main.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
    var ns = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var cards = board.querySelectorAll('.agent');
    cards.forEach(function(card, i){
      var cr = card.getBoundingClientRect();
      var x1 = cr.right - br.left, y1 = cr.top - br.top + cr.height / 2;
      var x2 = mr.left - br.left, y2 = mr.top - br.top + 60 + (i % 5) * 34;
      var mx = (x1 + x2) / 2;
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', card.dataset.color || '#c9d3e6');
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke-dasharray', '5 5'); p.setAttribute('opacity', '0.55');
      svg.appendChild(p);
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x1); c.setAttribute('cy', y1); c.setAttribute('r', '3.2'); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', card.dataset.color || '#c9d3e6');
      svg.appendChild(c);
    });
  }
  draw();
  window.addEventListener('resize', draw);
})();
</script></body></html>`;
}
