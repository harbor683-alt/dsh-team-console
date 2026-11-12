// ============================================================================
// team-view/views/cockpit.mjs — V2.0 总览驾驶舱（计划书 6.2 / 表 25：登录默认落地页）
// ----------------------------------------------------------------------------
// 用法：import { renderCockpit } from './views/cockpit.mjs'
//       renderCockpit(opts) → 完整 HTML 文档字符串（纯函数，不接路由，整合员接入）
// opts 与 GET /api/data 返回同构：{ ws, tasks, teams, links }，另可带 projects（项目书列表）。
// 页面自上而下四区：
//   ① 状态区：一行横条角色小方块，颜色 = 六状态色，悬停显示当前任务名
//   ② 指标区：五类数字（进行中卡点+项目数 / 常驻完成率 / 今日新增产物 / 异常未处理 / 今日资源消耗）
//   ③ 待办区：待决策 / 待验收 / 异常处置三列，异常处置 = failed 任务（行内重试/归档 → /api/action）
//   ④ 动态流：时间倒序，时间/角色/事件类型/一句话摘要（tasks createdAt/updatedAt + teams inbox 派生）
// 约束：
//   · 无数据层的指标按计划书 9.5「不猜、不补、不藏」显示 "—（暂缓）" 占位并注明原因，禁止编造；
//   · A7：1280x800 标准视口下前三区无需滚动即可看清；
//   · 客户端脚本零反斜杠（stage.mjs 模板字符串会吃掉反斜杠）、自绘弹窗（禁 window.prompt）；
//   · 视觉遵守 styles/V2-CSS-CONTRACT.md：无渐变/发光/高饱和、圆角 ≤6px、正文 ≥12px、数字等宽。
// ============================================================================

const TASK_STATUS_LABEL = { backlog: '长期池', todo: '待办', running: '执行中', done: '已完成', failed: '异常' };
const TASK_STATUS_CLASS = { backlog: 'v2-st--archived', todo: 'v2-st--idle', running: 'v2-st--running', done: 'v2-st--done', failed: 'v2-st--error' };
const MEMBER_LABEL = { idle: '空闲', running: '执行中', done: '已完成', error: '异常', decision: '待决策', archived: '归档' };
const MEMBER_ORDER = ['idle', 'running', 'done', 'error', 'decision', 'archived'];
const EVT_CLASS = { '新建任务': 'v2-st--idle', '状态变更': 'v2-st--running', '任务完成': 'v2-st--done', '异常上报': 'v2-st--error', '团队消息': 'v2-st--archived' };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function two(n) { return (n < 10 ? '0' : '') + n; }
function fmtClock(ts) { const d = new Date(ts); return two(d.getHours()) + ':' + two(d.getMinutes()); }
function fmtStamp(ts, now) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  const n = new Date(now);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return sameDay ? fmtClock(ts) : ((d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + fmtClock(ts));
}
function todayStart(now) { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
const DAY_MS = 86400000;

// 角色状态 → 六状态键（对齐 v2.css .v2-st--*）
function memberKey(s) {
  const st = String(s || '').toLowerCase();
  if (st === 'working' || st === 'busy' || st === 'running') return 'running';
  if (st === 'done' || st === 'completed' || st === 'complete') return 'done';
  if (st === 'failed' || st === 'error' || st === 'blocked') return 'error';
  if (st === 'waiting' || st === 'paused' || st === 'decision') return 'decision';
  if (st === 'archived') return 'archived';
  return 'idle';
}

function urgencyRank(t) {
  const p = String(t.priority || '').toUpperCase();
  if (p === 'P0' || p === '高') return 0;
  if (p === 'P1' || p === '中') return 1;
  if (p === 'P2' || p === '低') return 2;
  return 3;
}
function byUrgency(a, b) {
  return urgencyRank(a) - urgencyRank(b) || (b.updatedAt || 0) - (a.updatedAt || 0);
}

// ------------------------------ ① 状态区 ------------------------------
function statusZone(teams) {
  const counts = { idle: 0, running: 0, done: 0, error: 0, decision: 0, archived: 0 };
  const blocks = [];
  for (const team of teams) {
    const cells = [];
    for (const m of team.members || []) {
      const key = memberKey(m.status);
      counts[key] += 1;
      const task = (team.tasks || []).find((x) =>
        (x.assignee === m.name || x.assignee === m.id) && (x.status === 'running' || x.status === 'in_progress'));
      const cur = task ? '当前任务：' + task.subject : '空闲';
      cells.push(
        '<span class="v2-hoverable">' +
          '<span class="v2-statusbar__cell v2-st--' + key + '" title="' + esc(m.name) + ' · ' + esc(cur) + '"></span>' +
          '<span class="v2-popover"><b>' + esc(m.name || '?') + '</b> · ' + esc(m.role || 'worker') +
            (m.model ? '<br>模型：' + esc(m.model) : '') + '<br>' + esc(cur) + '</span>' +
        '</span>'
      );
    }
    if (cells.length) blocks.push('<span class="v2-legend">' + esc(team.name || team.id) + '</span>' + cells.join(''));
  }
  const legend = MEMBER_ORDER.map((k) =>
    '<span class="v2-legend"><span class="v2-dot v2-st--' + k + '"></span>' + MEMBER_LABEL[k] + ' <span class="v2-num">' + counts[k] + '</span></span>'
  ).join('');
  return '<section class="cockpit-zone" id="c-status"><div class="v2-section__title">① 状态区 · 队伍在岗情况（颜色 = 状态，悬停看当前任务）</div>' +
    '<div class="cockpit-card"><div class="v2-statusbar">' +
    (blocks.length ? blocks.join('') : '<span class="cockpit-empty">暂无团队角色 — 当前工作区尚未建立 .agent-teams 团队</span>') +
    '</div><div class="v2-statusbar" style="margin-top:6px">' + legend + '</div></div></section>';
}

// ------------------------------ ② 指标区 ------------------------------
function metricsZone(opts, now) {
  const tasks = opts.tasks || [];
  const running = tasks.filter((t) => t.status === 'running').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const start = todayStart(now);
  const todayNew = tasks.filter((t) => (t.createdAt || 0) >= start && (t.createdAt || 0) < start + DAY_MS).length;
  const projectsKnown = Array.isArray(opts.projects);
  const projects = projectsKnown ? opts.projects.length : null;

  const card = (label, valueHtml, noteHtml) =>
    '<div class="cockpit-card">' +
      '<div class="v2-metric"><span class="v2-metric__label">' + label + '</span>' +
      '<span class="v2-metric__value">' + valueHtml + '</span></div>' +
      '<div class="metric-note">' + noteHtml + '</div>' +
    '</div>';

  const m1 = card(
    '进行中项目与卡点',
    '<span class="v2-num">' + running + '</span> 卡点 · <span data-fill="projects" class="v2-num">' + (projects == null ? '…' : projects) + '</span> 项目',
    '卡点 = ledger running 任务数；项目 = 项目书目录文件数'
  );
  const m2 = card(
    '常驻业务完成率',
    '—（暂缓）',
    '常驻业务数据层未建立（交接书暂缓项）。按 9.5 不猜不补不藏，不编造数字'
  );
  const m3 = card(
    '今日新增产物',
    '<span class="v2-num">' + todayNew + '</span>',
    '任务 createdAt 今日计数（产物事件流建立前以任务创建数计）'
  );
  const m4 = card(
    '异常未处理',
    '<span class="v2-num" style="color:' + (failed > 0 ? 'var(--c-error)' : 'var(--tx-strong)') + '">' + failed + '</span>',
    'failed 状态任务数；处置入口见下方待办区'
  );
  const m5 = card(
    '今日资源消耗',
    '—（暂缓）',
    '资源消耗数据层未建立（计划书第 9 章，本阶段暂缓）。按 9.5 不猜不补不藏'
  );
  return '<section class="cockpit-zone" id="c-metrics"><div class="v2-section__title">② 指标区 · 整体健康度</div>' +
    '<div class="metrics">' + m1 + m2 + m3 + m4 + m5 + '</div></section>';
}

// ------------------------------ ③ 待办区 ------------------------------
function todoZone(opts, now) {
  const failed = (opts.tasks || []).filter((t) => t.status === 'failed').sort(byUrgency);
  const rows = failed.slice(0, 4).map((t) =>
    '<div class="v2-item">' +
      '<span class="v2-dot v2-st--error"></span>' +
      '<span class="v2-item__main">' + esc(t.title) + '</span>' +
      (t.priority ? '<span class="v2-tag v2-st--error">' + esc(t.priority) + '</span>' : '') +
      '<span class="v2-num" style="color:var(--tx-weak)">' + esc(fmtStamp(t.updatedAt, now)) + '</span>' +
      '<button class="v2-btn v2-btn--primary" data-action="retry" data-id="' + esc(t.id) + '" data-title="' + esc(t.title) + '">重试</button>' +
      '<button class="v2-btn" data-action="archive" data-id="' + esc(t.id) + '" data-title="' + esc(t.title) + '">归档</button>' +
    '</div>'
  ).join('');
  const more = failed.length > 4
    ? '<div class="cockpit-more">其余 <span class="v2-num">' + (failed.length - 4) + '</span> 条异常任务 — 请到三态看板统一处理</div>'
    : '';
  const col = (dot, title, inner) =>
    '<div class="todo-col"><div class="todo-col-title">' + dot + title + '</div>' +
    '<div class="cockpit-card" style="padding:2px 8px">' + inner + '</div></div>';

  const colDecision = col(
    '<span class="v2-dot v2-st--decision"></span>', '待决策',
    '<div class="cockpit-empty">暂无待决策事项 — 建议中心（6.7）数据层未建立，本阶段暂缓；三级决策闭环事件流建立后在此呈现</div>'
  );
  const colReview = col(
    '<span class="v2-dot v2-st--running"></span>', '待验收',
    '<div class="cockpit-empty">暂无待验收事项 — 审校判定事件流未建立；产物提交并进入审校后在此呈现</div>'
  );
  const colError = col(
    '<span class="v2-dot v2-st--error"></span>', '异常处置',
    failed.length
      ? '<div class="stream">' + rows + more + '</div>'
      : '<div class="cockpit-empty">暂无异常任务 — 当前没有 failed 状态的任务</div>'
  );
  return '<section class="cockpit-zone" id="c-todo"><div class="v2-section__title">③ 待办区 · 等我处理（按紧急度排序，行内直接处理）</div>' +
    '<div class="todo-grid">' + colDecision + colReview + colError + '</div></section>';
}

// ------------------------------ ④ 动态流 ------------------------------
function buildEvents(opts) {
  const evs = [];
  for (const t of opts.tasks || []) {
    const actor = t.assignee || '工作台';
    if (t.createdAt) evs.push({ ts: t.createdAt, actor, type: '新建任务', summary: t.title });
    if (t.updatedAt && t.updatedAt !== t.createdAt) {
      const type = t.status === 'failed' ? '异常上报' : (t.status === 'done' ? '任务完成' : '状态变更');
      evs.push({ ts: t.updatedAt, actor, type, summary: t.title + ' → ' + (TASK_STATUS_LABEL[t.status] || t.status) });
    }
  }
  for (const team of opts.teams || []) {
    for (const m of team.messages || []) {
      let ts = Number(m.ts) || 0;
      if (ts && ts < 1e12) ts = ts * 1000; // inbox 消息 ts 为秒时归一为毫秒
      evs.push({ ts, actor: m.from || '?', type: '团队消息', summary: String(m.content || '').slice(0, 80) });
    }
  }
  evs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return evs.slice(0, 20);
}

function streamZone(opts, now) {
  const evs = buildEvents(opts);
  const inner = evs.length
    ? evs.map((e) =>
        '<div class="v2-item">' +
          '<span class="v2-num" style="width:88px;flex:none;color:var(--tx-weak)">' + esc(fmtStamp(e.ts, now)) + '</span>' +
          '<span class="v2-tag ' + (EVT_CLASS[e.type] || '') + '">' + esc(e.type) + '</span>' +
          '<span style="color:var(--tx-weak);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none">' + esc(e.actor) + '</span>' +
          '<span class="v2-item__main">' + esc(e.summary) + '</span>' +
        '</div>'
      ).join('')
    : '<div class="cockpit-empty">暂无动态 — 事件流尚未产生记录（任务状态变更与团队消息会自动出现在这里）</div>';
  return '<section class="cockpit-zone" id="c-stream"><div class="v2-section__title">④ 动态流 · 正在发生（时间倒序，默认只显示关键事件）</div>' +
    '<div class="cockpit-card stream">' + inner + '</div></section>';
}

// ------------------------------ 页面组装 ------------------------------
export function renderCockpit(opts = {}) {
  const now = Date.now();
  const ws = opts.ws || {};
  const tasks = Array.isArray(opts.tasks) ? opts.tasks : [];
  const teams = Array.isArray(opts.teams) ? opts.teams : [];
  const data = { ws, tasks, teams, links: opts.links, projects: opts.projects };

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>总览驾驶舱</title>
<link rel="stylesheet" href="/styles/v2.css">
<style>
/* cockpit 布局样式：只用 v2.css 变量，无渐变/发光/高饱和，圆角 ≤ 6px */
html,body{margin:0;padding:0}
.cockpit{max-width:1280px;margin:0 auto;padding:10px 16px 28px;font-family:var(--font-sans)}
.cockpit-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 0 10px}
.cockpit-title{font-size:var(--fs-20);font-weight:700;color:var(--tx-strong)}
.cockpit-sub{font-size:var(--fs-12);color:var(--tx-weak)}
.cockpit-zone{margin-bottom:10px}
.cockpit-card{background:var(--bg-panel);border:1px solid var(--bd-line);border-radius:var(--radius-s);padding:8px 12px;min-width:0}
.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.metric-note{font-size:var(--fs-12);color:var(--tx-weak);margin-top:2px;line-height:1.45}
.todo-grid{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;align-items:start}
.todo-col{display:flex;flex-direction:column;gap:4px;min-width:0}
.todo-col-title{font-size:var(--fs-12);font-weight:600;color:var(--tx-weak);letter-spacing:.04em;display:flex;align-items:center;gap:6px}
.cockpit-empty{font-size:var(--fs-12);color:var(--tx-weak);padding:6px 2px;line-height:1.5}
.cockpit-more{font-size:var(--fs-12);color:var(--tx-weak);padding:4px 2px 0}
.stream{display:flex;flex-direction:column;padding:2px 8px}
.c-modal{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.38);display:none;align-items:center;justify-content:center}
.c-modal.open{display:flex}
.c-modal-panel{width:min(420px,90vw);background:var(--bg-panel);border:1px solid var(--bd-strong);border-radius:var(--radius-m);padding:14px 16px}
.c-modal-title{font-size:var(--fs-14);font-weight:700;color:var(--tx-strong);margin-bottom:6px}
.c-modal-body{font-size:var(--fs-13);color:var(--tx-body);line-height:1.6;margin-bottom:12px;word-break:break-all}
.c-modal-actions{display:flex;justify-content:flex-end;gap:8px}
.c-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:70;background:var(--tx-strong);color:var(--bg-panel);font-size:var(--fs-13);padding:7px 14px;border-radius:var(--radius-s);display:none;max-width:70vw}
.c-toast.show{display:block}
</style></head>
<body>
<div class="v2-root cockpit">
  <header class="cockpit-head">
    <span class="cockpit-title">总览驾驶舱</span>
    <span class="cockpit-sub">工作区：${esc(ws.title || ws.id || '默认')} · 生成于 ${new Date(now).toLocaleString('zh-CN')}</span>
  </header>
  ${statusZone(teams)}
  ${metricsZone(data, now)}
  ${todoZone(data, now)}
  ${streamZone(data, now)}
</div>

<div class="c-modal" id="c-modal">
  <div class="c-modal-panel">
    <div class="c-modal-title" id="c-modal-title"></div>
    <div class="c-modal-body" id="c-modal-body"></div>
    <div class="c-modal-actions">
      <button class="v2-btn" id="c-modal-cancel" type="button">取消</button>
      <button class="v2-btn v2-btn--primary" id="c-modal-ok" type="button">确认</button>
    </div>
  </div>
</div>
<div class="c-toast" id="c-toast"></div>

<script>
(function () {
  var httpMode = /^https?:$/.test(location.protocol);

  /* 自绘弹窗（禁 window.prompt / window.confirm） */
  var modal = document.getElementById('c-modal');
  var mTitle = document.getElementById('c-modal-title');
  var mBody = document.getElementById('c-modal-body');
  var mOk = document.getElementById('c-modal-ok');
  var mCancel = document.getElementById('c-modal-cancel');
  var modalCb = null;
  function showModal(title, body, okLabel, cb) {
    mTitle.textContent = title;
    mBody.textContent = body;
    mOk.textContent = okLabel || '确认';
    modalCb = cb || null;
    modal.classList.add('open');
  }
  function closeModal() { modal.classList.remove('open'); modalCb = null; }
  mCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  mOk.addEventListener('click', function () { var cb = modalCb; closeModal(); if (cb) cb(); });

  /* 轻提示 */
  var toastEl = document.getElementById('c-toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  function post(payload, done) {
    fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) { if (done) done(j); })
      .catch(function (e) { toast('操作失败：' + e.message); });
  }

  /* 异常处置：重试 / 归档（行内直接处理） */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    var id = b.getAttribute('data-id');
    var title = b.getAttribute('data-title') || '该任务';
    if (!httpMode) { toast('预览模式：未连接 8787 服务，无法执行 /api/action'); return; }
    if (b.getAttribute('data-action') === 'retry') {
      showModal('重试任务', '将「' + title + '」重新挂回进行中（status → running），确认重试？', '重试', function () {
        post({ action: 'move', id: id, to: 'start' }, function () { toast('已重试，页面刷新中'); setTimeout(function () { location.reload(); }, 400); });
      });
    } else if (b.getAttribute('data-action') === 'archive') {
      showModal('归档任务', '将「' + title + '」移入归档（status → done），确认归档？', '归档', function () {
        post({ action: 'move', id: id, to: 'done' }, function () { toast('已归档，页面刷新中'); setTimeout(function () { location.reload(); }, 400); });
      });
    }
  });

  /* 指标区：项目数补齐（项目书目录，GET /api/projects） */
  var fill = document.querySelectorAll('[data-fill="projects"]');
  if (fill.length) {
    var set = function (v) { fill.forEach(function (el) { el.textContent = v; }); };
    if (httpMode) {
      fetch('/api/projects')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (list) { set(Array.isArray(list) ? String(list.length) : '—'); })
        .catch(function () { set('—'); });
    } else {
      set('—');
    }
  }
})();
</script></body></html>`;
}

export default renderCockpit;
