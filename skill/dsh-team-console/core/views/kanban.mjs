/* ============================================================================
 * team-view/views/kanban.mjs — 三态任务看板（V2.0 §6.6）
 * ----------------------------------------------------------------------------
 * 依据：team-view/_plan.txt 6.6（三栏三态拖拽、归档说明弹窗、三行任务卡、
 *       悬停展开、项目/角色/状态筛选）、表 27 统一交互规范、
 *       team-view/styles/v2.css（六状态色、小圆角、无渐变无发光）。
 *
 * 用法（整合员）：
 *   import { renderKanban } from './views/kanban.mjs';
 *   页面 shell 内拼接 renderKanban(data)（data 同 GET /api/data 返回值形状：
 *   { ws, tasks, teams, links }）。片段自带 <style> 与 <script>（自执行，
 *   挂载逻辑幂等）；页面需另行引入 styles/v2.css（加载方式由整合员定）。
 *   若整合员以 innerHTML 方式注入片段导致内联脚本不执行，
 *   可调用 mountKanban(rootEl) 兜底（内部以 new Function 执行同一份客户端
 *   脚本；如页面启用禁止 eval 的 CSP，请保留内联 <script> 路径）。
 *
 * 落库契约：所有状态变更走 POST /api/action（详见同目录 kanban.API-NEEDS.md）：
 *   - 池<->进行中：{ action:'move', id, to:'backlog'|'start' }（现有后端已支持）
 *   - 任意栏 -> 归档：{ action:'archive', id, note }（note 为必填一句话说明，
 *     前端弹自绘弹窗强制填写；整合员需在后端新增此动作）
 *   - 归档 -> 池/进行中：{ action:'unarchive', id, to? }（整合员需新增）
 *   成功响应 { ok:true, ... } 后整页 reload()（与 stage.mjs 既有约定一致）；
 *   失败响应 { ok:false, error } 在前端内联提示，不刷新、不丢数据。
 *
 * 状态->栏位映射：pool（长期任务池）= backlog/todo/failed；
 *   run（进行中）= running；arch（归档）= archived/done。
 *   注：failed（取消/异常）并入左侧任务池并以异常色渲染，见 API-NEEDS.md。
 *
 * 本文件全篇不含反斜杠字符（含注入页面的客户端脚本），
 * 符合 V2.0改造交接.md「客户端模板字符串内避免反斜杠」的硬约束。
 * ========================================================================== */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* ----------------------------------------------------------------------------
 * 常量：状态语义与栏位定义
 * -------------------------------------------------------------------------- */

const STATUS_ST = {
  backlog: 'idle',
  todo: 'idle',
  running: 'running',
  done: 'done',
  archived: 'archived',
  failed: 'error',
};

const STATUS_LABEL = {
  backlog: '池',
  todo: '待办',
  running: '进行中',
  done: '已完成',
  archived: '归档',
  failed: '异常',
};

const STATUS_ALIAS = {
  pending: 'todo',
  in_progress: 'running',
  completed: 'done',
  cancelled: 'failed',
};

const STATUS_ORDER = ['running', 'todo', 'backlog', 'done', 'archived', 'failed'];

const PRIO_ST = { P0: 'error', P1: 'decision', P2: 'idle', 高: 'error', 中: 'decision', 低: 'idle' };

const COL_DEFS = [
  { key: 'pool', title: '长期任务池', hint: 'backlog · todo · 异常' },
  { key: 'run', title: '进行中', hint: 'running' },
  { key: 'arch', title: '归档', hint: '拖入需填写归档说明' },
];

/* ----------------------------------------------------------------------------
 * 服务端工具（模块级，可含现代语法；仍保持全文件无反斜杠）
 * -------------------------------------------------------------------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function clip(s, n) {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function normStatus(st) {
  const s = String(st || '').toLowerCase();
  return STATUS_ALIAS[s] || (STATUS_ST[s] ? s : 'backlog');
}

function colOf(st) {
  if (st === 'running') return 'run';
  if (st === 'done' || st === 'archived') return 'arch';
  return 'pool'; // backlog / todo / failed / 未知
}

function pctOf(t) {
  const p = Number(t.progress);
  if (Number.isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
  const st = normStatus(t.status);
  if (st === 'done' || st === 'archived') return 100;
  if (st === 'running') return 55;
  return 0;
}

function etaOf(t, pct) {
  if (pct >= 100) return '完成';
  if (t.estimate != null && String(t.estimate).trim() !== '') return '剩余 ' + String(t.estimate).trim();
  return '剩余 ' + (100 - pct) + '%';
}

function summaryOf(t) {
  let s = String(t.desc || t.description || '').trim();
  if (!s && t.contract && t.contract.goal) s = '目标：' + String(t.contract.goal).trim();
  return s ? clip(s, 160) : '（无摘要）';
}

function fmtTime(ts) {
  if (!ts) return '未知时间';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '未知时间';
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function lastLogOf(t) {
  const log = Array.isArray(t.log) ? t.log : [];
  if (log.length) {
    const e = log[log.length - 1];
    const txt = clip(String(e.text || e.msg || ''), 120) || '（无内容）';
    return '日志 ' + fmtTime(e.at || e.time) + '：' + txt;
  }
  const trs = Array.isArray(t.teamResults) ? t.teamResults : [];
  if (trs.length) {
    const e = trs[trs.length - 1];
    const txt = clip(String(e.output || ''), 120) || '（无内容）';
    return '最近日志 · ' + fmtTime(e.at) + ' ' + (e.teamId || '团队') + '：' + txt;
  }
  if (t.dispatch && t.dispatch.teamId) {
    return '已派 ' + t.dispatch.teamId + ' · ' + String(t.dispatch.status || '未知状态');
  }
  return '（无日志）';
}

function prioRank(p) {
  if (p === 'P0' || p === '高') return 0;
  if (p === 'P1' || p === '中') return 1;
  if (p === 'P2' || p === '低') return 2;
  return 3;
}

/* ----------------------------------------------------------------------------
 * 卡片与栏位渲染
 * -------------------------------------------------------------------------- */

function cardOf(t) {
  const st = normStatus(t.status);
  const stClass = STATUS_ST[st] || 'idle';
  const pct = pctOf(t);
  const role = String(t.assignee || '').trim() || '未派';
  const proj = String(t.project || t.projectId || t.proj || '').trim() || '未定';
  const dim = st === 'archived' ? ' v2-dim' : '';
  const tags = [];
  if (t.priority) {
    tags.push('<span class="v2-tag v2-st--' + (PRIO_ST[t.priority] || 'idle') + '">' + esc(t.priority) + '</span>');
  }
  tags.push('<span class="v2-tag v2-st--' + stClass + '"><span class="v2-dot v2-dot--sm"></span>' + (STATUS_LABEL[st] || esc(st)) + '</span>');
  if (t.dispatch && t.dispatch.teamId) tags.push('<span class="v2-tag">已派 ' + esc(t.dispatch.teamId) + '</span>');
  if (t.contract) tags.push('<span class="v2-tag">契约</span>');
  return [
    '<article class="v2-card v2-task v2-hoverable v2-draggable' + dim + '" draggable="true" tabindex="0"',
    '  data-id="' + esc(t.id) + '" data-status="' + esc(st) + '" data-role="' + esc(role) + '" data-project="' + esc(proj) + '">',
    '  <div class="v2-task__head">',
    '    <span class="v2-task__name">' + esc(t.title || t.id) + '</span>',
    '    <span class="v2-task__owner">' + esc(role) + '</span>',
    '  </div>',
    '  <div class="v2-task__mid">',
    '    <div class="v2-progress v2-progress--sm v2-st--' + stClass + '" role="progressbar" aria-valuenow="' + pct + '"><div class="v2-progress__fill" style="--p:' + pct + '%"></div></div>',
    '    <span class="v2-task__eta v2-num">' + esc(etaOf(t, pct)) + '</span>',
    '  </div>',
    '  <div class="v2-task__tags">' + tags.join('') + '</div>',
    '  <div class="v2-popover">',
    '    <div class="v2-popover__title">' + esc(t.title || t.id) + '</div>',
    '    <div class="v2-kb__pp-body">' + esc(summaryOf(t)) + '</div>',
    '    <div class="v2-popover__meta">' + esc(lastLogOf(t)) + '</div>',
    '  </div>',
    '</article>',
  ].join('');
}

function colHTML(def, tasks) {
  const cards = tasks.map(cardOf).join('');
  return [
    '<section class="v2-board__col" data-col="' + def.key + '" data-total="' + tasks.length + '">',
    '  <div class="v2-board__title">' + def.title,
    '    <span class="v2-num v2-kb__count">' + tasks.length + '</span>',
    '    <span class="v2-kb__hint">' + def.hint + '</span>',
    '  </div>',
    cards,
    '  <div class="v2-kb__empty"' + (tasks.length ? ' style="display:none"' : '') + '>暂无任务 · 拖拽任务卡到此栏</div>',
    '</section>',
  ].join('');
}

/* ----------------------------------------------------------------------------
 * 筛选区渲染：三组标签式筛选（项目 / 角色 / 状态），可随时取消（再点即取消）
 * -------------------------------------------------------------------------- */

function chipHTML(group, value, label, dotClass) {
  const selected = value === '' ? ' v2-selected' : '';
  const dot = dotClass ? '<span class="v2-dot v2-dot--sm ' + dotClass + '"></span>' : '';
  return '<button type="button" class="v2-btn v2-kb__chip' + selected + '" data-g="' + group + '" data-v="' + esc(value) + '">' + dot + esc(label) + '</button>';
}

function filterGroup(group, label, values) {
  const chips = [chipHTML(group, '', '全部')];
  for (const v of values) chips.push(chipHTML(group, v.value, v.label, v.dot));
  return '<div class="v2-kb__fgroup"><span class="v2-kb__flabel">' + label + '</span>' + chips.join('') + '</div>';
}

function filtersHTML(tasks) {
  const statuses = [];
  const seenSt = {};
  for (const t of tasks) {
    const st = normStatus(t.status);
    if (!seenSt[st]) { seenSt[st] = 1; statuses.push(st); }
  }
  statuses.sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a); const ib = STATUS_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const stChips = statuses.map((st) => ({
    value: st,
    label: STATUS_LABEL[st] || st,
    dot: 'v2-st--' + (STATUS_ST[st] || 'idle'),
  }));

  const roles = [];
  const seenR = {};
  for (const t of tasks) {
    const r = String(t.assignee || '').trim() || '未派';
    if (!seenR[r]) { seenR[r] = 1; roles.push(r); }
  }
  roles.sort();
  const roleChips = roles.map((r) => ({ value: r, label: r }));

  const projs = [];
  const seenP = {};
  for (const t of tasks) {
    const p = String(t.project || t.projectId || t.proj || '').trim() || '未定';
    if (!seenP[p]) { seenP[p] = 1; projs.push(p); }
  }
  projs.sort();
  const projChips = projs.map((p) => ({ value: p, label: p }));

  return [
    filterGroup('status', '状态', stChips),
    filterGroup('role', '角色', roleChips),
    filterGroup('project', '项目', projChips),
  ].join('');
}

/* ----------------------------------------------------------------------------
 * 客户端脚本：自包含 IIFE，挂载到 #v2-kanban-root，幂等（data-kb-bound 守卫）。
 * 全脚本无反斜杠、无模板字符串插值（避免被服务端模板字面量二次解释）。
 * -------------------------------------------------------------------------- */

const CLIENT_JS = `
(function () {
  'use strict';
  var root = document.getElementById('v2-kanban-root');
  if (!root || root.getAttribute('data-kb-bound')) return;
  root.setAttribute('data-kb-bound', '1');

  var COL_RUN = ['running'];
  var COL_ARCH = ['archived', 'done'];
  var f = { status: '', role: '', project: '' };
  var pending = null;
  var dragging = null;
  var modalOpen = false;
  var errTimer = null;
  var modal = root.querySelector('.v2-kb__modal');
  var errBox = root.querySelector('.v2-kb__err');
  var WSQS = (location.search || '').replace('?', '');

  function api(u) { return u + (WSQS ? '?' + WSQS : ''); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function colOf(st) {
    if (COL_RUN.indexOf(st) >= 0) return 'run';
    if (COL_ARCH.indexOf(st) >= 0) return 'arch';
    return 'pool';
  }
  function hideErr() { errBox.hidden = true; if (errTimer) { clearTimeout(errTimer); errTimer = null; } }
  function showErr(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
    if (errTimer) clearTimeout(errTimer);
    errTimer = setTimeout(hideErr, 8000);
  }
  function showModalErr(msg) {
    var mErr = modal.querySelector('.v2-kb__modal-err');
    mErr.textContent = msg;
    mErr.hidden = false;
  }
  function post(payload) {
    return fetch(api('/api/action'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status >= 400) return { ok: false, error: 'HTTP ' + r.status };
      return r.json().then(
        function (j) { return j && typeof j === 'object' ? j : { ok: false, error: '响应格式异常' }; },
        function () { return { ok: false, error: '响应无法解析' }; }
      );
    });
  }
  function send(payload) {
    post(payload).then(function (r) {
      if (r && r.ok) { location.reload(); return; }
      showErr((r && r.error) || '操作失败：' + payload.action);
    }).catch(function (err) { showErr('请求失败：' + (err && err.message)); });
  }
  function cardOf(id) { return root.querySelector('.v2-task[data-id="' + id + '"]'); }

  /* ---- 拖拽：HTML5 原生拖拽，释放即变更状态 -------------------------- */
  root.addEventListener('dragstart', function (e) {
    var card = e.target && e.target.closest ? e.target.closest('.v2-task') : null;
    if (!card) return;
    dragging = card.getAttribute('data-id');
    try { e.dataTransfer.setData('text/plain', dragging); } catch (err) {}
    try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    card.classList.add('v2-kb__dragging');
  });
  root.addEventListener('dragend', function () {
    dragging = null;
    var c = root.querySelector('.v2-kb__dragging');
    if (c) c.classList.remove('v2-kb__dragging');
    var cols = root.querySelectorAll('.v2-board__col');
    for (var i = 0; i < cols.length; i++) cols[i].classList.remove('v2-board__col--drop');
  });

  var cols = root.querySelectorAll('.v2-board__col');
  for (var ci = 0; ci < cols.length; ci++) {
    (function (col) {
      col.addEventListener('dragover', function (e) {
        if (!dragging) return;
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
        col.classList.add('v2-board__col--drop');
      });
      col.addEventListener('dragleave', function (e) {
        if (e.target === col || !col.contains(e.relatedTarget)) col.classList.remove('v2-board__col--drop');
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('v2-board__col--drop');
        var id = dragging;
        if (!id && e.dataTransfer && e.dataTransfer.getData) id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        drop(id, col.getAttribute('data-col'));
      });
    })(cols[ci]);
  }

  /* ---- 落库动作：按源栏/目标栏选择 move / archive / unarchive --------- */
  function drop(id, toCol) {
    var card = cardOf(id);
    if (!card) return;
    var from = colOf(card.getAttribute('data-status'));
    if (from === toCol) return;
    hideErr();
    if (toCol === 'arch') { openArchive(id); return; }
    if (from === 'arch') { send({ action: 'unarchive', id: id, to: toCol === 'run' ? 'start' : 'backlog' }); return; }
    send({ action: 'move', id: id, to: toCol === 'run' ? 'start' : 'backlog' });
  }

  /* ---- 归档弹窗：自绘弹窗（Electron 无 window.prompt），强制一句话说明 */
  function openArchive(id) {
    var card = cardOf(id);
    var titleEl = card ? card.querySelector('.v2-task__name') : null;
    pending = id;
    modal.querySelector('.v2-kb__modal-task').textContent = titleEl ? titleEl.textContent : id;
    var ta = modal.querySelector('.v2-kb__modal-input');
    ta.value = '';
    var mErr = modal.querySelector('.v2-kb__modal-err');
    mErr.hidden = true;
    mErr.textContent = '';
    modal.hidden = false;
    modalOpen = true;
    ta.focus();
  }
  function closeArchive() {
    modal.hidden = true;
    modalOpen = false;
    pending = null;
    modal.querySelector('.v2-kb__modal-ok').disabled = false;
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeArchive();
  });
  modal.querySelector('.v2-kb__modal-cancel').addEventListener('click', closeArchive);
  modal.querySelector('.v2-kb__modal-ok').addEventListener('click', function () {
    var ta = modal.querySelector('.v2-kb__modal-input');
    var note = ta.value.trim();
    if (!note) { showModalErr('归档说明不能为空：请用一句话说明归档原因。'); return; }
    var btn = this;
    btn.disabled = true;
    post({ action: 'archive', id: pending, note: note }).then(function (r) {
      if (r && r.ok) { location.reload(); return; }
      btn.disabled = false;
      showModalErr((r && r.error) || '归档失败，请重试。');
    }).catch(function (err) {
      btn.disabled = false;
      showModalErr('请求失败：' + (err && err.message));
    });
  });
  modal.querySelector('.v2-kb__modal-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      var ok = modal.querySelector('.v2-kb__modal-ok');
      if (!ok.disabled) ok.click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOpen) closeArchive();
  });

  /* ---- 筛选：三组标签式，单选 + 再点取消 ------------------------------ */
  function refreshCounts() {
    var all = root.querySelectorAll('.v2-board__col');
    for (var i = 0; i < all.length; i++) {
      var col = all[i];
      var cards = col.querySelectorAll('.v2-task');
      var n = 0;
      for (var j = 0; j < cards.length; j++) if (cards[j].style.display !== 'none') n++;
      var cnt = col.querySelector('.v2-kb__count');
      if (cnt) cnt.textContent = String(n);
      var empty = col.querySelector('.v2-kb__empty');
      if (empty) {
        var total = parseInt(col.getAttribute('data-total'), 10) || 0;
        empty.textContent = total > 0 ? '暂无符合条件的任务' : '暂无任务 · 拖拽任务卡到此栏';
        empty.style.display = n ? 'none' : '';
      }
    }
  }
  function applyFilters() {
    var cards = root.querySelectorAll('.v2-task');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var okS = !f.status || c.getAttribute('data-status') === f.status;
      var okR = !f.role || c.getAttribute('data-role') === f.role;
      var okP = !f.project || c.getAttribute('data-project') === f.project;
      c.style.display = (okS && okR && okP) ? '' : 'none';
    }
    refreshCounts();
  }
  var chips = root.querySelectorAll('.v2-kb__chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function () {
      var g = this.getAttribute('data-g');
      var v = this.getAttribute('data-v');
      if (f[g] === v) v = '';
      f[g] = v;
      var group = root.querySelectorAll('.v2-kb__chip[data-g="' + g + '"]');
      for (var j = 0; j < group.length; j++) {
        if (group[j].getAttribute('data-v') === v) group[j].classList.add('v2-selected');
        else group[j].classList.remove('v2-selected');
      }
      applyFilters();
    });
  }

  /* ---- 单击选中（表 27：单击选中展示详情，不触发执行）---------------- */
  root.addEventListener('click', function (e) {
    var card = e.target && e.target.closest ? e.target.closest('.v2-task') : null;
    if (!card) return;
    var sel = root.querySelector('.v2-task.v2-selected');
    if (sel && sel !== card) sel.classList.remove('v2-selected');
    card.classList.toggle('v2-selected');
  });

  refreshCounts();

  /* ---- 供整合员/测试使用的程序化句柄（挂在根节点 __kb） -------------- */
  root.__kb = {
    drop: drop,
    openArchive: openArchive,
    closeArchive: closeArchive,
    applyFilters: applyFilters,
    refreshCounts: refreshCounts
  };
})();
`;

/* ----------------------------------------------------------------------------
 * 片段样式：仅看板自身布局（v2.css 已提供卡片/标签/进度/弹层等通用件）。
 * 遵守 6.10：无渐变、无发光、圆角 <= 6px、字号 >= 12px、无高饱和背景。
 * -------------------------------------------------------------------------- */

const KB_STYLE = `
.v2-kanban { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-3); min-height: 100vh; }
.v2-kb__bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-4); }
.v2-kb__title { font-size: var(--fs-16); font-weight: 600; color: var(--tx-strong); }
.v2-kb__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.v2-kb__fgroup { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.v2-kb__flabel { font-size: var(--fs-12); color: var(--tx-weak); }
.v2-kb__chip { font-size: var(--fs-12); padding: 2px 8px; line-height: 18px; }
.v2-kb__chip .v2-dot { margin-right: 1px; }
.v2-kb__err { padding: var(--sp-2) var(--sp-3); font-size: var(--fs-13); color: var(--c-error-fg); background: var(--c-error-bg); border: 1px solid var(--c-error-bd); border-radius: var(--radius-xs); }
.v2-kb__count { color: var(--tx-weak); font-size: var(--fs-12); margin-left: 6px; }
.v2-kb__hint { font-size: var(--fs-12); color: var(--tx-weak); font-weight: 400; margin-left: 6px; letter-spacing: 0; }
.v2-kb__dragging { opacity: 0.5; }
.v2-kb__empty { font-size: var(--fs-12); color: var(--tx-weak); padding: var(--sp-3); text-align: center; border: 1px dashed var(--bd-line); border-radius: var(--radius-xs); }
.v2-kb__pp-body { font-size: var(--fs-12); color: var(--tx-body); }
.v2-kb__modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(31, 39, 51, 0.45); }
.v2-kb__modal[hidden] { display: none; }
.v2-kb__modal-panel { width: min(420px, calc(100vw - 32px)); background: var(--bg-panel); border: 1px solid var(--bd-strong); border-radius: var(--radius-s); padding: var(--sp-4); display: flex; flex-direction: column; gap: 10px; }
.v2-kb__modal-title { font-size: var(--fs-14); font-weight: 600; color: var(--tx-strong); }
.v2-kb__modal-desc { font-size: var(--fs-13); color: var(--tx-body); margin: 0; }
.v2-kb__modal-input { width: 100%; font-family: inherit; font-size: var(--fs-13); line-height: 1.5; padding: 8px 10px; border: 1px solid var(--bd-strong); border-radius: var(--radius-xs); resize: vertical; color: var(--tx-body); background: var(--bg-panel); }
.v2-kb__modal-input:focus { outline: 2px solid var(--c-running); outline-offset: 1px; border-color: var(--c-running-bd); }
.v2-kb__modal-err { font-size: var(--fs-12); color: var(--c-error-fg); background: var(--c-error-bg); border: 1px solid var(--c-error-bd); border-radius: var(--radius-xs); padding: 6px 10px; }
.v2-kb__modal-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); }
.v2-kb__modal-hint { font-size: var(--fs-12); color: var(--tx-weak); }
`;

/* ----------------------------------------------------------------------------
 * 渲染入口：renderKanban(opts)
 * opts 与 GET /api/data 返回同形：{ ws, tasks, teams, links }
 * -------------------------------------------------------------------------- */

export function renderKanban(opts) {
  const tasks = (opts && Array.isArray(opts.tasks) ? opts.tasks : [])
    .filter((t) => t && t.id && !t.deleted)
    .map((t) => ({ ...t, status: normStatus(t.status) }));

  const pool = [];
  const run = [];
  const arch = [];
  for (const t of tasks) {
    if (colOf(t.status) === 'run') run.push(t);
    else if (colOf(t.status) === 'arch') arch.push(t);
    else pool.push(t);
  }
  const byPrio = (a, b) => {
    const d = prioRank(a.priority) - prioRank(b.priority);
    if (d !== 0) return d;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  };
  pool.sort(byPrio);
  run.sort(byPrio);
  arch.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return '<section class="v2-root v2-kanban" id="v2-kanban-root">'
    + '<header class="v2-kb__bar">'
    + '<div class="v2-kb__title">三态任务看板</div>'
    + '<div class="v2-kb__filters">' + filtersHTML(tasks) + '</div>'
    + '</header>'
    + '<div class="v2-kb__err" role="alert" hidden></div>'
    + '<div class="v2-board">'
    + colHTML(COL_DEFS[0], pool)
    + colHTML(COL_DEFS[1], run)
    + colHTML(COL_DEFS[2], arch)
    + '</div>'
    + '<div class="v2-kb__modal" hidden role="dialog" aria-modal="true" aria-labelledby="v2-kb-modal-title">'
    + '<div class="v2-kb__modal-panel">'
    + '<div class="v2-kb__modal-title" id="v2-kb-modal-title">归档任务：<span class="v2-kb__modal-task"></span></div>'
    + '<p class="v2-kb__modal-desc">归档后任务退出活动区，进入右侧归档栏。请填写一句话归档说明（必填）：</p>'
    + '<textarea class="v2-kb__modal-input" rows="2" maxlength="200" placeholder="例如：方案已否决，保留备查"></textarea>'
    + '<div class="v2-kb__modal-err" hidden></div>'
    + '<div class="v2-kb__modal-actions">'
    + '<button type="button" class="v2-btn v2-kb__modal-cancel">取消</button>'
    + '<button type="button" class="v2-btn v2-btn--primary v2-kb__modal-ok">归档</button>'
    + '</div>'
    + '<div class="v2-kb__modal-hint">Esc 取消 · Ctrl+Enter 确认</div>'
    + '</div>'
    + '</div>'
    + '<style>' + KB_STYLE + '</style>'
    + '<script data-kb>' + CLIENT_JS + '</script>'
    + '</section>';
}

/* ----------------------------------------------------------------------------
 * mountKanban(rootEl)：innerHTML 注入等内联脚本不执行的场景下的兜底挂载。
 * 以 new Function 执行与内联一致的客户端脚本（幂等）。
 * -------------------------------------------------------------------------- */

export function mountKanban(rootEl) {
  const root = !rootEl ? null
    : (rootEl.id === 'v2-kanban-root' ? rootEl : rootEl.querySelector('#v2-kanban-root'));
  if (!root) return null;
  if (root.__kb) return root.__kb;
  new Function(CLIENT_JS)();
  return root.__kb || null;
}

/* ----------------------------------------------------------------------------
 * 演示 / 冒烟：node views/kanban.mjs
 * 生成自包含演示页（内联 v2.css + 样例数据，或读 WORKBENCH_LEDGER 指向的
 * 测试账本）写到 <cwd>/.tmp-kanban-demo.html，供浏览器人工验收。
 * -------------------------------------------------------------------------- */

const SAMPLE_TASKS = [
  { id: 'sample-t1', title: '梳理 V2.0 视觉规范验收清单', status: 'backlog', priority: 'P0', assignee: '张三', project: '项目A', desc: '对照 6.10 禁止清单逐条验收四个视图模块，输出问题清单。', updatedAt: Date.now() - 1000 },
  { id: 'sample-t2', title: '补全依赖图泳道联动设计稿', status: 'backlog', priority: 'P1', assignee: '李四', project: '项目B', desc: '依赖图节点点击后泳道滚动到对应区间，联动规则对齐表 27。', updatedAt: Date.now() - 2000 },
  { id: 'sample-t3', title: '团队架构视图数据口径评审', status: 'todo', priority: 'P2', assignee: '', project: '项目A', desc: '角色卡状态条口径与表 6-4 对齐，确认回退次数统计来源。', updatedAt: Date.now() - 3000 },
  { id: 'sample-t4', title: '驾驶舱指标卡布局实现', status: 'todo', priority: 'P1', assignee: '王五', project: '', desc: '总览驾驶舱 6.2：任务数、团队数、进行中占比、异常数四指标。', updatedAt: Date.now() - 4000 },
  { id: 'sample-t5', title: '三态看板后端 archive 动作开发', status: 'running', priority: 'P0', assignee: '张三', project: '项目A', desc: '按 kanban.API-NEEDS.md 实现 POST /api/action archive/unarchive，落账本并写日志。', progress: 60, updatedAt: Date.now() - 5000, dispatch: { teamId: 'v2-console', status: 'queued' } },
  { id: 'sample-t6', title: '壳层整合与 8787 联调', status: 'running', priority: 'P1', assignee: '李四', project: '项目B', desc: '顺序整合四个视图模块，验收拖拽与筛选。', progress: 30, updatedAt: Date.now() - 6000, teamResults: [{ teamId: 'v2-console', output: '已确认整合顺序：视觉规范 -> 驾驶舱 -> 看板 -> 架构 -> 依赖图。', at: Date.now() - 60000 }] },
  { id: 'sample-t7', title: '旧挂绳区交互还原验证', status: 'done', priority: 'P1', assignee: '王五', project: '项目A', desc: '验证 8787 打开即见驾驶舱，三态拖拽与筛选全部可用。', progress: 100, updatedAt: Date.now() - 7000, teamResults: [{ teamId: 'v2-console', output: '验收通过：拖拽、筛选、归档弹窗均正常。', at: Date.now() - 70000 }] },
  { id: 'sample-t8', title: '字体与数字等宽规范落地', status: 'done', priority: 'P2', assignee: '', project: '项目B', desc: '正文 13px 无衬线，数字 tabular-nums，圆角上限 6px。', progress: 100, updatedAt: Date.now() - 8000 },
  { id: 'sample-t9', title: '旧版大圆角样式方案（已否决）', status: 'archived', priority: 'P2', assignee: '张三', project: '项目A', desc: '曾提议 12px 大圆角卡片，违反 6.10 圆角上限，已否决归档。', progress: 100, updatedAt: Date.now() - 9000, log: [{ at: Date.now() - 90000, text: '归档：违反圆角上限，方案否决' }] },
  { id: 'sample-t10', title: '废弃的发光动效试验', status: 'failed', priority: 'P2', assignee: '', project: '项目B', desc: '试验 box-shadow 发光效果，违反视觉规范，已取消。', updatedAt: Date.now() - 10000 },
];

function pickPri(tags) {
  const arr = Array.isArray(tags) ? tags : [];
  for (const x of arr) {
    const name = x && (x.name || x);
    if (name && /^(P[0-2]|高|中|低)$/i.test(String(name))) return String(name).toUpperCase();
  }
  return '';
}

function demoOpts() {
  const env = process.env.WORKBENCH_LEDGER;
  let tasks = [];
  if (env && existsSync(env)) {
    try {
      const ledger = JSON.parse(readFileSync(env, 'utf8'));
      tasks = (ledger.tasks || []).map((t) => ({
        id: t.id,
        title: t.title || t.id,
        status: t.status || 'backlog',
        desc: t.description || '',
        priority: pickPri(t.tags),
        assignee: t.assignee || '',
        contract: t.contract,
        dispatch: t.dispatch,
        teamResults: t.teamResults,
        log: t.log,
        project: t.project || t.projectId || '',
        updatedAt: t.updatedAt,
      }));
    } catch (e) {
      console.error('读取 WORKBENCH_LEDGER 失败：' + e.message);
    }
  }
  if (!tasks.length) tasks = SAMPLE_TASKS;
  return { ws: { id: 'demo', title: '演示工作区', path: '' }, tasks, teams: [], links: [] };
}

function demoPage() {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(path.join(HERE, '..', 'styles', 'v2.css'), 'utf8');
  const demoStrip = `
<div style="margin:0 12px 16px;padding:10px 12px;border:1px dashed var(--bd-strong);border-radius:4px;font-size:12px;color:var(--tx-weak);display:flex;flex-wrap:wrap;align-items:center;gap:8px">
  <strong>演示辅助条（非产品界面）</strong>：fetch 已被替换为载荷捕获桩（不会真正落库）。
  <button class="v2-btn" type="button" onclick="window.__kbDemoDrop('sample-t1','run')">模拟拖拽：sample-t1 → 进行中（move）</button>
  <button class="v2-btn" type="button" onclick="window.__kbDemoDrop('sample-t1','arch')">模拟拖拽：sample-t1 → 归档（弹窗）</button>
  <button class="v2-btn" type="button" onclick="window.__kbDemoDrop('sample-t9','run')">模拟拖拽：sample-t9 → 进行中（unarchive）</button>
</div>`;
  const demoScript = `
<script>
window.__kbPayloads = [];
(function () {
  var realFetch = window.fetch;
  window.fetch = function (url, opt) {
    if (String(url).indexOf('/api/action') >= 0 && opt && opt.body) {
      var p = JSON.parse(opt.body);
      window.__kbPayloads.push(p);
      console.log('KB-DEMO 捕获 /api/action 载荷：', JSON.stringify(p));
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: false, error: '演示模式：后端动作未实现，载荷已捕获打印到控制台。' }); } });
    }
    return realFetch.apply(this, arguments);
  };
})();
window.__kbDemoDrop = function (id, col) {
  var root = document.getElementById('v2-kanban-root');
  if (root && root.__kb) root.__kb.drop(id, col);
};
</script>`;
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>三态任务看板 · 演示</title>',
    '<style>' + css + '</style>',
    '</head>',
    '<body style="margin:0">',
    renderKanban(demoOpts()),
    demoStrip,
    demoScript,
    '</body>',
    '</html>',
  ].join('');
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
  } catch (e) {
    return false;
  }
}

if (isMain()) {
  const out = path.join(process.cwd(), '.tmp-kanban-demo.html');
  writeFileSync(out, demoPage(), 'utf8');
  console.log('已生成演示页：' + out);
  console.log('说明：浏览器打开该文件即可验收三栏布局、筛选、模拟拖拽与归档弹窗；');
  console.log('      fetch 桩会把 /api/action 载荷打印到控制台。');
}
