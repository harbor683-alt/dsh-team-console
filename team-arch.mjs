/* ============================================================================
   team-view/views/team-arch.mjs — 团队架构视图（_plan.txt §6.3，行 232-235）

   导出纯函数 renderTeamArch(opts)：opts 与 GET /api/data 返回体一致
   （{ ws, tasks, teams, links }，见 team-view/serve-workbench.mjs /api/data）。

   - 只读视图：复用 /api/data，无新增接口（派生规则见同目录 team-arch.API-NEEDS.md）。
   - 布局（自上而下层级）：真人顶端 → 主控居中 → 军师 / 知识库运营分居主控
     两侧（与执行层并行、不占执行行）→ 执行角色横向排列。
   - 角色卡五项：角色名 / 绑定模型 / 当前状态 / 当前任务名 / 今日完成数，
     全部从 teams + tasks + links 派生；数据缺失画"未配置"占位槽，不编造。
   - 边框颜色 = 六状态色；右上小圆点 = 存在待处理异常（failed 任务）；
     空闲卡片折叠只显名称与模型（五项信息悬停可见），执行中展开显示当前任务与进度。
   - 编制视图 / 运行视图双模式共用同一布局，切换只叠加/隐藏运行连线层，
     节点位置不变；SVG 坐标一律以自身 getBoundingClientRect() 为基准，
     外层容器 position:relative。
   - 本文件不含反斜杠字符：客户端脚本经 HTML 字符串传递，反斜杠会被吃掉
     （team-view/V2.0改造交接.md §3 已踩坑记录）。
   ============================================================================ */

const STATUS_LABEL = {
  idle: '空闲',
  running: '执行中',
  done: '已完成',
  error: '异常',
  decision: '待决策',
  archived: '已归档',
};

const ROLE_CAPTAIN = /主控|captain/i;
const ROLE_STRATEGIST = /军师|参谋|strateg|advisor|think/i;
const ROLE_KB = /知识库|knowledge|kb|运营|ops/i;

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(x) { return (x < 10 ? '0' : '') + x; }

/* 本地日期串 YYYY-MM-DD；无法解析返回 null（"今日"判断从严） */
function localDay(v) {
  if (v == null || v === '') return null;
  const t = new Date(v);
  if (isNaN(t.getTime())) return null;
  return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
}

function todayKey() { return localDay(Date.now()); }

function roleOf(m) {
  const r = String((m && m.role) || '');
  const n = String((m && m.name) || '');
  if (ROLE_CAPTAIN.test(r) || ROLE_CAPTAIN.test(n)) return 'captain';
  if (ROLE_STRATEGIST.test(r) || ROLE_STRATEGIST.test(n)) return 'strategist';
  if (ROLE_KB.test(r) || ROLE_KB.test(n)) return 'kb';
  return 'executor';
}

const STATE_TEXT = { idle: '空闲', running: '忙碌', error: '异常', archived: '归档', done: '完成' };

/* 成员自身状态 → 六状态色（数据字段本身即权威；异常由 failed 任务覆盖） */
function memberState(m) {
  const st = String((m && m.status) || '').toLowerCase();
  if (st === 'removed' || st === 'archived') return 'archived';
  if (st === 'working' || st === 'busy' || st === 'running' || st === 'active') return 'running';
  return 'idle';
}

/* 任务归属：assignee 按成员 name 或 id 匹配（沿用 stage.mjs 既有约定） */
function mineOf(list, m) {
  return (list || []).filter(function (k) {
    if (!k) return false;
    const a = String(k.assignee == null ? '' : k.assignee);
    return a === m.name || a === m.id;
  });
}

/* 当前任务：先取执行中，再取待开始；团队任务优先于工作台任务 */
function pickCurrent(teamMine, wsMine) {
  const run = (k) => k.status === 'in_progress' || k.status === 'running';
  const wait = (k) => k.status === 'pending' || k.status === 'todo';
  return teamMine.find(run) || teamMine.find(wait) || wsMine.find(run) || wsMine.find(wait) || null;
}

/* 进度：工作台任务有数字进度 → 进度条；团队任务无进度字段 → 状态标签，不编数字 */
function progressOf(cur) {
  if (!cur) return null;
  if (cur.progress != null && !isNaN(Number(cur.progress))) {
    const n = Number(cur.progress);
    if (n > 0 && n < 100) return { pct: Math.round(n) };
  }
  const st = String(cur.status || '');
  if (st === 'pending' || st === 'todo') return { label: '待开始', state: 'idle' };
  return { label: '执行中', state: 'running' };
}

/* 今日完成数：状态完成 + updatedAt 为今天；日期缺失的完成项保守计入（旧数据无日期） */
function countDone(list, today) {
  let n = 0;
  (list || []).forEach(function (k) {
    if (!k) return;
    const st = String(k.status || '');
    if (st !== 'completed' && st !== 'done') return;
    const d = localDay(k.updatedAt);
    if (d === null || d === today) n += 1;
  });
  return n;
}

/* 成员 → 卡片视图数据（key 为画布内节点键） */
function memberView(m, key, teamTasks, wsTasks, today) {
  const tm = mineOf(teamTasks, m);
  const wm = mineOf(wsTasks, m);
  const failed = tm.some((k) => k.status === 'failed') || wm.some((k) => k.status === 'failed');
  let state = memberState(m);
  if (failed) state = 'error';
  const cur = pickCurrent(tm, wm);
  return {
    key,
    id: m.id || '',
    name: m.name || '（未命名）',
    role: String(m.role || ''),
    model: String(m.model || ''),
    state,
    statusText: STATE_TEXT[state] || STATE_TEXT.idle,
    failed,
    cur,
    prog: progressOf(cur),
    doneToday: countDone(tm, today) + countDone(wm, today),
    removed: memberState(m) === 'archived',
  };
}

/* 主控派生：无 captain 成员时由 team.captainSessionId 派生；模型未知显"—"，不编造 */
function captainView(team, teamTasks, wsTasks, today) {
  if (!team.captainSessionId) return null;
  const hasFail = teamTasks.some((k) => k.status === 'failed');
  const hasRun = teamTasks.some((k) => k.status === 'in_progress' || k.status === 'running');
  return {
    key: 'captain',
    name: '主控',
    role: '团队主控',
    model: '',
    state: hasFail ? 'error' : hasRun ? 'running' : 'idle',
    failed: hasFail,
    cur: null,
    prog: null,
    doneToday: countDone(teamTasks, today),
    removed: false,
  };
}

function stateTag(state) {
  return '<span class="v2-tag v2-st--' + state + '">' + esc(STATUS_LABEL[state] || state) + '</span>';
}

function fieldRow(label, valueHtml) {
  return '<div class="ta-card__row"><span class="ta-l">' + label + '</span><span class="ta-v">' + valueHtml + '</span></div>';
}

/* 卡片主体：五项（角色名在头部；模型/状态/当前任务/今日完成四行 + 可选进度） */
function cardBody(v) {
  const curName = v.cur ? String(v.cur.subject || v.cur.title || '') : '';
  const rows = [
    fieldRow('模型', v.model ? esc(v.model) : '—'),
    fieldRow('状态', stateTag(v.state)),
    fieldRow('当前任务', curName ? '<span title="' + esc(curName) + '">' + esc(curName) + '</span>' : '—'),
    fieldRow('今日完成', '<span class="v2-num">' + v.doneToday + '</span>'),
  ];
  let progHtml = '';
  if (v.prog) {
    if (v.prog.pct != null) {
      progHtml = '<div class="ta-progress-wrap"><div class="v2-progress v2-st--' + v.state
        + '" style="--p:' + v.prog.pct + '%"><div class="v2-progress__fill"></div></div></div>';
    } else {
      progHtml = '<div class="ta-progress-wrap">' + stateTag(v.prog.state === 'idle' ? 'idle' : 'running') + '</div>';
    }
  }
  return { rows, progHtml };
}

/* 角色卡：expanded=展开五项；否则折叠只显名称+模型，五项进悬停弹层（不挤布局） */
function renderRoleCard(v, expanded) {
  const corner = v.failed ? '<span class="v2-corner-dot" title="存在待处理异常"></span>' : '';
  const dim = v.removed ? ' v2-dim' : '';
  const cls = expanded ? 'ta-card--expanded' : 'ta-card--collapsed v2-hoverable';
  let html = '<div class="v2-card v2-st--' + v.state + ' ta-card ta-card--member ' + cls + dim + '" data-node="' + v.key + '"'
    + ' data-member="' + esc(v.name) + '">' + corner;
  html += '<div class="ta-card__head"><span class="v2-dot v2-st--' + v.state + '"></span>'
    + '<span class="ta-card__name" title="' + esc(v.name) + '">' + esc(v.name) + '</span>'
    + '<span class="ta-card__state">' + esc(v.statusText || '') + '</span></div>';
  if (v.state === 'running') html += '<span class="ta-card__flow" aria-hidden="true"></span>';
  const sub = expanded ? v.role : v.model;
  if (sub) html += '<div class="ta-card__sub">' + esc(sub) + '</div>';
  const body = cardBody(v);
  if (expanded) {
    html += body.rows.join('') + body.progHtml;
  } else {
    html += '<div class="v2-popover"><div class="v2-popover__title">' + esc(v.name) + '</div>'
      + body.rows.join('')
      + (v.role ? '<div class="v2-popover__meta">' + esc(v.role) + '</div>' : '')
      + '</div>';
  }
  return html + '</div>';
}

function renderPersonCard() {
  return '<div class="v2-card ta-card ta-card--person" data-node="person">'
    + '<div class="ta-card__head"><span class="ta-card__name">真人</span></div>'
    + '<div class="ta-card__sub">使用者 · 决策与验收</div></div>';
}

/* 数据缺失的角色：占位槽标"未配置"，不编造 */
function renderPlaceholder(key, label) {
  return '<div class="v2-card ta-card ta-card--empty" data-node="' + key + '">'
    + '<div class="ta-card__head"><span class="ta-card__name">' + esc(label) + '</span></div>'
    + '<div class="ta-card__sub">未配置</div></div>';
}

/* 运行连线：team task 依赖（依赖任务负责人 → 本任务负责人）+ links（两端按
   成员 name/id、团队任务 id、工作台任务 id 依次解析）；端点不可解析则跳过。 */
function runEdges(team, wsTasks, links, maps) {
  const seen = {};
  function push(from, to, fail) {
    if (!from || !to || from === to) return;
    const sig = from + '|' + to;
    if (seen[sig]) { if (fail) seen[sig].fail = true; return; }
    seen[sig] = { from, to, fail: !!fail };
  }
  const byId = {};
  (team.tasks || []).forEach(function (k) { if (k && k.id) byId[k.id] = k; });
  (team.tasks || []).forEach(function (k) {
    if (!k || !k.assignee) return;
    (k.dependencies || []).forEach(function (dep) {
      const depT = byId[dep];
      if (!depT || !depT.assignee) return;
      push(maps.byAssignee[depT.assignee], maps.byAssignee[k.assignee],
        k.status === 'failed' || depT.status === 'failed');
    });
  });
  (links || []).forEach(function (l) {
    if (!l || l.a == null || l.b == null) return;
    push(resolveEndpoint(l.a, maps), resolveEndpoint(l.b, maps), false);
  });
  return Object.keys(seen).map(function (sig) { return seen[sig]; });
}

function resolveEndpoint(x, maps) {
  if (x == null) return null;
  const s = String(x);
  if (maps.byAssignee[s]) return maps.byAssignee[s];
  if (maps.taskOwner[s]) return maps.taskOwner[s];
  return null;
}

/* 单个团队 → 一个架构画布块 */
function renderTeamBlock(team, n, wsTasks, links, single) {
  const members = (team.members || []).filter(Boolean);
  const teamTasks = (team.tasks || []).filter(Boolean);
  const today = todayKey();

  let captainM = null;
  let stratM = null;
  let kbM = null;
  const executors = [];
  members.forEach(function (m) {
    const r = roleOf(m);
    if (r === 'captain' && !captainM) { captainM = m; return; }
    if (r === 'strategist' && !stratM) { stratM = m; return; }
    if (r === 'kb' && !kbM) { kbM = m; return; }
    executors.push(m);
  });

  /* 画布内节点键与 assignee 解析表 */
  const byAssignee = {};
  if (captainM) { byAssignee[captainM.name] = 'captain'; if (captainM.id) byAssignee[captainM.id] = 'captain'; }
  if (stratM) { byAssignee[stratM.name] = 'strategist'; if (stratM.id) byAssignee[stratM.id] = 'strategist'; }
  if (kbM) { byAssignee[kbM.name] = 'kb'; if (kbM.id) byAssignee[kbM.id] = 'kb'; }
  executors.forEach(function (m, j) {
    byAssignee[m.name] = 'm' + j;
    if (m.id) byAssignee[m.id] = 'm' + j;
  });
  if (team.captainSessionId) byAssignee[team.captainSessionId] = 'captain';
  const taskOwner = {};
  teamTasks.forEach(function (k) { if (k.id && k.assignee) taskOwner[k.id] = byAssignee[k.assignee]; });
  wsTasks.forEach(function (k) { if (k.id && k.assignee) taskOwner[k.id] = byAssignee[k.assignee]; });
  const maps = { byAssignee, taskOwner };

  const capView = captainM
    ? memberView(captainM, 'captain', teamTasks, wsTasks, today)
    : captainView(team, teamTasks, wsTasks, today);
  const stratView = stratM ? memberView(stratM, 'strategist', teamTasks, wsTasks, today) : null;
  const kbView = kbM ? memberView(kbM, 'kb', teamTasks, wsTasks, today) : null;
  const execViews = executors.map(function (m, j) {
    return memberView(m, 'm' + j, teamTasks, wsTasks, today);
  });

  /* 编制连线：真人→主控（实线）；主控→军师/知识库运营（虚线＝并行参谋关系）；
     主控→执行角色（实线＝指挥）。 */
  const org = [
    { from: 'person', to: 'captain', cls: 'v2-line--dep', marker: 'tam-dep-' + n },
    { from: 'captain', to: 'strategist', cls: 'ta-org-dash', marker: 'tam-dep-' + n },
    { from: 'captain', to: 'kb', cls: 'ta-org-dash', marker: 'tam-dep-' + n },
  ];
  execViews.forEach(function (v) {
    org.push({ from: 'captain', to: v.key, cls: 'v2-line--dep', marker: 'tam-dep-' + n });
  });
  if (execViews.length === 0) {
    org.push({ from: 'captain', to: 'exec0', cls: 'v2-line--dep', marker: 'tam-dep-' + n });
  }

  const run = runEdges(team, wsTasks, links, maps).map(function (e) {
    return {
      from: e.from,
      to: e.to,
      cls: e.fail ? 'v2-line--fail' : 'v2-line--cross',
      marker: e.fail ? 'tam-fail-' + n : 'tam-run-' + n,
    };
  });

  const canvasId = 'tac-' + n;
  const edgeJson = JSON.stringify({ org, run }).split('</').join('&lt;/');

  let html = '<article class="ta-block' + (single ? ' ta-block--single' : '') + '">';
  html += '<header class="ta-block__bar">';
  if (!single) html += '<div class="ta-block__name">' + esc(team.name || team.id || '（未命名团队）') + '</div>';
  html += '<div class="ta-block__modes">'
    + '<button type="button" class="v2-btn ta-toggle v2-selected" data-target="' + canvasId + '" data-mode="org">编制视图</button>'
    + '<button type="button" class="v2-btn ta-toggle" data-target="' + canvasId + '" data-mode="run">运行视图</button>'
    + '</div>';
  html += '</header>';
  html += '<div class="ta-canvas" id="' + canvasId + '">';
  html += '<div class="ta-stage">';
  html += '<div class="ta-row ta-row--person">' + renderPersonCard() + '</div>';
  html += '<div class="ta-row ta-row--head">';
  html += stratView ? renderRoleCard(stratView, stratView.state !== 'idle') : renderPlaceholder('strategist', '军师');
  html += capView ? renderRoleCard(capView, true) : renderPlaceholder('captain', '主控');
  html += kbView ? renderRoleCard(kbView, kbView.state !== 'idle') : renderPlaceholder('kb', '知识库运营');
  html += '</div>';
  html += '<div class="ta-row ta-row--exec">';
  if (execViews.length === 0) {
    html += renderPlaceholder('exec0', '执行角色');
  } else {
    execViews.forEach(function (v) { html += renderRoleCard(v, v.state !== 'idle'); });
  }
  html += '</div>';
  html += '</div>';
  html += '<svg class="ta-svg" aria-hidden="true"><defs>'
    + '<marker id="tam-dep-' + n + '" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path class="ta-mk-dep" d="M0,0 L7.5,3 L0,6 z"></path></marker>'
    + '<marker id="tam-run-' + n + '" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path class="ta-mk-run" d="M0,0 L7.5,3 L0,6 z"></path></marker>'
    + '<marker id="tam-fail-' + n + '" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path class="ta-mk-fail" d="M0,0 L7.5,3 L0,6 z"></path></marker>'
    + '</defs></svg>';
  html += '<script type="application/json" class="ta-json">' + edgeJson + '</script>';
  html += '</div>';
  html += '<div class="ta-block__hint">实线＝指挥 · 灰色虚线＝并行参谋关系 · '
    + '运行视图叠加实时调用连线（蓝色虚线＝调用，红色虚线＝失败调用）</div>';
  html += '</article>';
  return html;
}

const TA_STYLE = `
.ta-view { max-width: 1200px; margin: 0 auto; padding: var(--sp-4); }
.ta-view__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-4); }
.ta-view__head-main { flex: 1 1 360px; min-width: 320px; }
.ta-layouts { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.ta-layouts__label { font-size: var(--fs-12); color: var(--tx-weak); }
.ta-view__title { font-size: var(--fs-18); font-weight: 600; color: var(--tx-strong); }
.ta-view__hint { font-size: var(--fs-12); color: var(--tx-weak); margin-top: 4px; max-width: 720px; }
.ta-list { display: flex; flex-direction: column; gap: var(--sp-5); }
.ta-empty { padding: var(--sp-5); color: var(--tx-weak); font-size: var(--fs-13); }
.ta-block { background: var(--bg-panel); border: 1px solid var(--bd-line); border-radius: var(--radius-s); padding: var(--sp-3); }
.ta-block--archived .ta-block__name { color: var(--tx-weak); }
.ta-block__bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-2); }
.ta-block__name { font-size: var(--fs-16); font-weight: 600; color: var(--tx-strong); }
.ta-block__modes { display: flex; gap: var(--sp-2); }
.ta-modes-fixed{position:fixed;top:62px;right:18px;z-index:12;display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.92);border:1px solid rgba(22,24,29,.08);box-shadow:0 8px 24px rgba(35,42,53,.10);backdrop-filter:blur(10px)}
.ta-modes-fixed .v2-btn{height:26px;padding:0 11px;font-size:11.5px;border-radius:999px;background:transparent;border:0}
.ta-modes-fixed .v2-btn.v2-selected{background:var(--c-running);color:#fff}
.ta-view--canvas .ta-block__modes{display:none!important}
.ta-edge--flow{stroke-dasharray:6 6;animation:taFlow .9s linear infinite}
@keyframes taFlow{to{stroke-dashoffset:-12}}
.ta-view--canvas .ta-card{animation:taIn .36s cubic-bezier(.2,.8,.3,1) both}
@keyframes taIn{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
.ta-card.v2-st--running::after{content:"";position:absolute;left:0;top:0;right:0;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(77,107,254,.9),transparent);background-size:45% 100%;background-repeat:no-repeat;animation:taTopFlow 1.9s linear infinite;pointer-events:none}
@keyframes taTopFlow{from{background-position:-60% 0}to{background-position:160% 0}}
@media (prefers-reduced-motion: reduce){.ta-edge--flow,.ta-card.v2-st--running::after,.ta-view--canvas .ta-card{animation:none!important}}
.ta-block__hint { font-size: var(--fs-12); color: var(--tx-weak); margin-top: var(--sp-2); }
.ta-canvas { position: relative; overflow-x: auto; padding-bottom: 190px; margin-bottom: -190px; }
.ta-stage { display: flex; flex-direction: column; align-items: center; gap: 56px; padding: 40px 24px 28px; min-width: 560px; }
.ta-row { display: flex; align-items: flex-start; justify-content: center; flex-wrap: wrap; gap: var(--sp-4); }
.ta-row--head { gap: 56px; }
.ta-card { width: 224px; border-color: var(--st-bd); }
.ta-card--collapsed { width: 160px; }
.ta-card--person { width: auto; min-width: 140px; border-color: var(--bd-line); }
.ta-card--empty { width: 160px; border-style: dashed; border-color: var(--bd-line); color: var(--tx-weak); }
.ta-card__head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ta-card__name { font-size: var(--fs-14); font-weight: 600; color: var(--tx-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta-card__sub { font-size: var(--fs-12); color: var(--tx-weak); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta-card--member { cursor: pointer; position: relative; }
.ta-card--member:hover { border-color: rgba(77,107,254,.36); box-shadow: 0 10px 24px rgba(77,107,254,.12); }
.ta-card__state { margin-left: auto; flex: none; font-size: 10.5px; line-height: 1.5; padding: 0 6px; border-radius: 999px; background: var(--st-bg); color: var(--st-fg); border: 1px solid var(--st-bd); }
.ta-view:not(.ta-view--single) .ta-card__state { display: none; }
.ta-card__flow { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; overflow: hidden; background: rgba(77,107,254,.12); border-radius: 0 0 var(--radius-s) var(--radius-s); }
.ta-card__flow::after { content: ""; position: absolute; top: 0; bottom: 0; width: 64%; left: -64%; background: linear-gradient(90deg, transparent, rgba(77,107,254,.35) 24%, #4d6bfe 46%, #ffffff 52%, #4d6bfe 58%, rgba(77,107,254,.35) 76%, transparent); animation: taSweep 2.1s cubic-bezier(.45,0,.55,1) infinite; box-shadow: 0 0 12px rgba(77,107,254,.55); }
@keyframes taSweep { 0% { left: -64%; } 100% { left: 110%; } }
.v2-st--running.ta-card { animation: taBreathe 2.4s ease-in-out infinite; }
@keyframes taBreathe { 0%, 100% { box-shadow: 0 0 0 1px rgba(77,107,254,.14); } 50% { box-shadow: 0 0 0 1px rgba(77,107,254,.34), 0 8px 22px rgba(77,107,254,.12); } }
@media (prefers-reduced-motion: reduce) { .ta-card__flow::after, .v2-st--running.ta-card { animation: none; } }
.ta-card__row { display: flex; align-items: center; gap: var(--sp-2); margin-top: 6px; font-size: var(--fs-12); }
.ta-card__row .ta-l { flex: none; width: 56px; color: var(--tx-weak); }
.ta-card__row .ta-v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx-body); }
.ta-progress-wrap { margin-top: 8px; }
.ta-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.ta-canvas:not(.ta-run) .ta-lines-run { display: none; }
.ta-org-dash { stroke: var(--tx-weak); stroke-dasharray: 4 3; }
/* 连线箭头 marker：颜色走 CSS 变量（禁写死色值，见视觉契约 F1） */
.ta-mk-dep { fill: var(--tx-weak); }
.ta-mk-run { fill: var(--c-running); }
.ta-mk-fail { fill: var(--c-error); }
/* 横向布局（默认）：真人最左 → 主控中间（军师在上 / 知识库运营在下）→ 执行层向右展开。
   只改方向不改数据：卡片 DOM 与纵向完全一致，切换不重建。 */
.ta-lay-h .ta-stage { flex-direction: row; align-items: center; justify-content: center; gap: 56px; padding-top: 28px; padding-bottom: 28px; }
.ta-lay-h .ta-row--person { flex: none; align-self: center; }
.ta-lay-h .ta-row--head { flex: none; flex-direction: column; align-items: center; gap: var(--sp-4); }
.ta-lay-h .ta-row--exec { flex: 1 1 auto; max-width: 512px; justify-content: flex-start; }
.ta-lay-h .ta-card { box-sizing: border-box; }
`;

/* 客户端脚本：只做两件事——模式切换（只叠/藏连线层，不碰布局）与连线绘制。
   不含反斜杠字符（经 HTML 字符串传递会被吃掉，见交接书踩坑记录）。 */
const TA_SCRIPT = `
(function(){
  function q(root, sel){ return root.querySelector(sel); }
  function all(root, sel, fn){ var list = root.querySelectorAll(sel); for (var i = 0; i < list.length; i++){ fn(list[i]); } }
  var SVGNS = "http://www.w3.org/2000/svg";
  function draw(canvas){
    var svg = q(canvas, ".ta-svg"); if (!svg) return;
    var holder = q(canvas, ".ta-json"); if (!holder) return;
    var data = null;
    try { data = JSON.parse(holder.textContent); } catch (err) { return; }
    var oldOrg = q(svg, ".ta-lines-org"); if (oldOrg) oldOrg.remove();
    var oldRun = q(svg, ".ta-lines-run"); if (oldRun) oldRun.remove();
    var org = document.createElementNS(SVGNS, "g"); org.setAttribute("class", "ta-lines-org");
    var run = document.createElementNS(SVGNS, "g"); run.setAttribute("class", "ta-lines-run");
    svg.appendChild(org); svg.appendChild(run);
    var cv = canvas.getBoundingClientRect();
    var k = window.__taScale || 1;
    function edge(group, e){
      var a = q(canvas, '[data-node="' + e.from + '"]');
      var b = q(canvas, '[data-node="' + e.to + '"]');
      if (!a || !b || a === b) return;
      var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      var ax = (ar.left - cv.left) / k, ay = (ar.top - cv.top) / k;
      var bx = (br.left - cv.left) / k, by = (br.top - cv.top) / k;
      var aw = ar.width / k, ah = ar.height / k, bw = br.width / k, bh = br.height / k;
      var x1, y1, x2, y2, d;
      if (by > ay + ah * 0.6) {
        x1 = ax + aw / 2; y1 = ay + ah;
        x2 = bx + bw / 2; y2 = by;
        var my = (y1 + y2) / 2;
        d = "M" + x1 + "," + y1 + " C" + x1 + "," + my + " " + x2 + "," + my + " " + x2 + "," + y2;
      } else if (ay > by + bh * 0.6) {
        x1 = ax + aw / 2; y1 = ay;
        x2 = bx + bw / 2; y2 = by + bh;
        var my2 = (y1 + y2) / 2;
        d = "M" + x1 + "," + y1 + " C" + x1 + "," + my2 + " " + x2 + "," + my2 + " " + x2 + "," + y2;
      } else if (ax > bx) {
        x1 = ax; y1 = ay + ah / 2;
        x2 = bx + bw; y2 = by + bh / 2;
        var dx = Math.max(24, Math.abs(x2 - x1) / 2);
        d = "M" + x1 + "," + y1 + " C" + (x1 - dx) + "," + y1 + " " + (x2 + dx) + "," + y2 + " " + x2 + "," + y2;
      } else {
        x1 = ax + aw; y1 = ay + ah / 2;
        x2 = bx; y2 = by + bh / 2;
        var dx2 = Math.max(24, Math.abs(x2 - x1) / 2);
        d = "M" + x1 + "," + y1 + " C" + (x1 + dx2) + "," + y1 + " " + (x2 - dx2) + "," + y2 + " " + x2 + "," + y2;
      }
      var p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-width", "1.5");
      var flow = (b.classList && b.classList.contains("v2-st--running")) || (a.classList && a.classList.contains("v2-st--running"));
      p.setAttribute("class", e.cls + (flow ? " ta-edge--flow" : ""));
      p.setAttribute("marker-end", "url(#" + e.marker + ")");
      group.appendChild(p);
    }
    (data.org || []).forEach(function(e){ edge(org, e); });
    (data.run || []).forEach(function(e){ edge(run, e); });
    console.log("[team-arch] " + canvas.id + " lines org=" + (data.org || []).length + " run=" + (data.run || []).length);
  }
  function drawAll(){ all(document, ".ta-canvas", draw); }
  all(document, ".ta-toggle", function(btn){
    btn.onclick = function(){
      var canvas = document.getElementById(btn.getAttribute("data-target"));
      if (!canvas) return;
      var run = btn.getAttribute("data-mode") === "run";
      if (run) { canvas.classList.add("ta-run"); } else { canvas.classList.remove("ta-run"); }
      all(document, '.ta-toggle[data-target="' + btn.getAttribute("data-target") + '"]', function(b){ b.classList.remove("v2-selected"); });
      btn.classList.add("v2-selected");
      draw(canvas);
    };
  });
  /* 布局切换（横向/纵向）：只翻转 .ta-view 上的布局类 + 重画连线，
     不重建任何卡片；编制/运行切换逻辑与节点无关，仍零位移。 */
  all(document, ".ta-layout", function(btn){
    btn.onclick = function(){
      var view = btn.closest(".ta-view"); if (!view) return;
      var h = btn.getAttribute("data-lay") === "h";
      if (h) { view.classList.add("ta-lay-h"); view.classList.remove("ta-lay-v"); }
      else { view.classList.add("ta-lay-v"); view.classList.remove("ta-lay-h"); }
      all(view, ".ta-layout", function(b){ b.classList.remove("v2-selected"); });
      btn.classList.add("v2-selected");
      drawAll();
    };
  });
  /* 画布模式：拖动平移 + 滚轮缩放 + 点成员对话 */
  (function(){
    var wrap = document.getElementById("ta-panwrap");
    var pan = document.getElementById("ta-pan");
    if (!wrap || !pan) return;
    var x = 0, y = 0, s = 1, down = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    var val = document.getElementById("ta-zoom-val");
    try {
      var savedPan = JSON.parse(localStorage.getItem("cw-pan") || "null");
      if (savedPan && typeof savedPan.s === "number") {
        x = Number(savedPan.x) || 0; y = Number(savedPan.y) || 0;
        s = Math.max(0.4, Math.min(2.4, savedPan.s));
      }
    } catch (err) {}
    function apply(){
      pan.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
      window.__taScale = s;
      if (val) val.textContent = Math.round(s * 100) + "%";
      try { localStorage.setItem("cw-pan", JSON.stringify({ x: x, y: y, s: s })); } catch (err) {}
      drawAll();
    }
    function clamp(n){ return Math.max(0.4, Math.min(2.4, n)); }
    function zoomAt(ns, cx, cy){
      ns = clamp(ns);
      var r = wrap.getBoundingClientRect();
      var mx = (cx == null ? r.width / 2 : cx - r.left), my = (cy == null ? r.height / 2 : cy - r.top);
      x = mx - (mx - x) * (ns / s);
      y = my - (my - y) * (ns / s);
      s = ns;
      apply();
    }
    wrap.addEventListener("wheel", function(e){
      e.preventDefault();
      zoomAt(s * Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY);
    }, { passive: false });
    wrap.addEventListener("pointerdown", function(e){
      moved = false;
      if (e.button !== 0) return;
      if (e.target.closest(".ta-card, .ta-zoom, button, a")) return;
      down = true; sx = e.clientX; sy = e.clientY; ox = x; oy = y;
      wrap.classList.add("is-dragging");
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    });
    wrap.addEventListener("pointermove", function(e){
      if (!down) return;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
      x = ox + (e.clientX - sx); y = oy + (e.clientY - sy);
      pan.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
    });
    function endDrag(){ down = false; wrap.classList.remove("is-dragging"); }
    wrap.addEventListener("pointerup", endDrag);
    wrap.addEventListener("pointercancel", endDrag);
    all(wrap, ".ta-zoom__btn", function(b){
      b.addEventListener("click", function(){
        var k = b.getAttribute("data-zoom");
        if (k === "in") zoomAt(s * 1.2);
        else if (k === "out") zoomAt(s / 1.2);
        else { x = 0; y = 0; s = 1; apply(); }
      });
    });
    all(wrap, ".ta-card--member", function(card){
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.addEventListener("click", function(e){
        if (moved) return;
        e.stopPropagation();
        var view = document.querySelector(".ta-view");
        try {
          parent.postMessage({ type: "wb-member", member: card.getAttribute("data-member") || "", team: (view && view.getAttribute("data-team")) || "", teamName: (view && view.getAttribute("data-team-name")) || "" }, "*");
        } catch (err) {}
      });
      card.addEventListener("keydown", function(e){
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
      });
    });
    apply();
  })();

  drawAll();
  window.addEventListener("resize", drawAll);
  window.addEventListener("load", drawAll);
  window.setTimeout(drawAll, 200);
})();
`;

export function renderTeamArch(opts) {
  const o = opts || {};
  const ws = o.ws || {};
  const tasks = Array.isArray(o.tasks) ? o.tasks : [];
  const teams = Array.isArray(o.teams) ? o.teams : [];
  const links = Array.isArray(o.links) ? o.links : [];

  const teamId = o.single && teams[0] ? (teams[0].id || '') : '';
  let html = '<section class="v2-root ta-view ta-lay-h' + (o.single ? ' ta-view--single' : '')
    + (o.canvas ? ' ta-view--canvas' : '') + '"' + (teamId ? ' data-team="' + esc(teamId) + '"' : '')
    + (teamId ? ' data-team-name="' + esc(teams[0].name || teamId) + '"' : '') + '>';
  html += '<style>' + TA_STYLE + '</style>';
  if (!o.single) {
    html += '<div class="ta-view__head">';
  html += '<div class="ta-view__head-main">';
  html += '<div class="ta-view__title">团队架构</div>';
  html += '<div class="ta-view__hint">默认横向（左→右）：真人 → 主控 → 执行层；'
    + '军师与知识库运营分列主控上下，与执行层并行。角色卡边框颜色表示状态，右上红点表示待处理异常；'
    + '空闲角色折叠为名称与模型（悬停查看五项），执行中展开当前任务与进度。'
    + (ws.title ? ' 工作区：' + esc(ws.title) : '') + '</div>';
  html += '</div>';
  html += '<div class="ta-layouts"><span class="ta-layouts__label">布局</span>'
    + '<button type="button" class="v2-btn ta-layout v2-selected" data-lay="h">横向</button>'
    + '<button type="button" class="v2-btn ta-layout" data-lay="v">纵向</button>'
    + '</div>';
  html += '</div>';
  }
  if (o.canvas) html += '<div class="ta-panwrap" id="ta-panwrap"><div class="ta-pan" id="ta-pan">';
  html += '<div class="ta-list">';

  const active = teams.filter(function (t) { return t && !t.archived; });
  const archived = teams.filter(function (t) { return t && t.archived; });

  if (teams.length === 0) {
    html += '<div class="ta-empty">暂无团队数据。</div>';
  }

  active.forEach(function (team, n) {
    html += renderTeamBlock(team, n, tasks, links, !!o.single);
  });

  if (!o.single) archived.forEach(function (team) {
    html += '<article class="ta-block ta-block--archived"><header class="ta-block__bar">'
      + '<div class="ta-block__name">' + esc(team.name || team.id || '（未命名团队）') + '</div>'
      + '<span class="v2-tag v2-st--archived">已归档</span>'
      + '</header></article>';
  });

  html += '</div>';
  if (o.canvas) {
    html += '</div>';
    if (teamId) {
      html += '<div class="ta-modes-fixed" role="group" aria-label="视图模式">'
        + '<button type="button" class="v2-btn ta-toggle v2-selected" data-target="tac-0" data-mode="org">编制视图</button>'
        + '<button type="button" class="v2-btn ta-toggle" data-target="tac-0" data-mode="run">运行视图</button>'
        + '</div>';
    }
    html += '<div class="ta-zoom" role="group" aria-label="缩放">'
      + '<button type="button" class="ta-zoom__btn" data-zoom="out" title="缩小">−</button>'
      + '<span class="ta-zoom__val" id="ta-zoom-val">100%</span>'
      + '<button type="button" class="ta-zoom__btn" data-zoom="in" title="放大">+</button>'
      + '<button type="button" class="ta-zoom__btn ta-zoom__btn--reset" data-zoom="reset" title="复位">复位</button>'
      + '</div>'
      + '<div class="ta-pan-hint">拖动空白处平移 · 滚轮缩放 · 点成员对话</div>'
      + '</div>';
  }
  html += '<script>' + TA_SCRIPT + '</script>';
  html += '</section>';
  return html;
}
