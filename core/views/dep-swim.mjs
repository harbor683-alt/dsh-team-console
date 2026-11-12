// team-view/views/dep-swim.mjs
// V2.0 依赖图 + 泳道时间线（6.4），按船长追加硬性要求实现：
//   1. 一次只显示当前团队的一张图（团队切换器，默认最近活跃团队），隐藏其余，不堆叠
//   2. 泳道默认零跨泳道连线（"显示关系"开关默认 off）；条色=状态六色、斜纹=返工、圆点=里程碑/归档
//   3. 聚焦模式：hover/点选任务条只画该任务上游/下游正交折线（<=4 条）+关系标签，其余条淡化到 12%，移开恢复
//   4. 依赖图联动：上方点节点 -> 泳道滚动定位并高亮该任务横条，不改变泳道布局
//   5. 泳道顺序 真人->主控->执行层->军师/知识库；单屏最多 6 条，超出折叠"+N"可展开；同角色任务>5 聚成簇条（hover 展开明细）
//   6. 全局/按小时/事件三视野只变刻度
//   7. 依赖图增量重绘：updateTask 仅局部更新节点/横条/相关连线
// 约束：全文件零反斜杠字符；SVG 坐标以 getBoundingClientRect() 为基准、外层 position:relative；遵循 v2.css
// 数据派生（无对应数据即机制预留，不编造）：
//   依赖边 = teams[].tasks[].dependencies（上游->下游，找不到的依赖跳过）；虚线=跨角色、红虚线=端点 failed
//   粗细 = 产物大小（/api/data 无体积字段，统一 1.5，weight 预留）；回退角标 = executions 日志（预留）
//   返工斜纹 = rework（预留）；军师建议 = suggestion（预留）；里程碑 = milestones（预留）；执行区间 = createdAt->updatedAt

const ROWH = 34;
const LANE_CAP = 6;
const CLUSTER_N = 5;
const MAP_STATUS = { pending: 'idle', running: 'running', completed: 'done', failed: 'error', cancelled: 'error' };
const STATUS_LABEL = { idle: '待就绪', running: '执行中', done: '已完成', error: '失败', decision: '待决策', archived: '已归档' };

function cleanStr(v) {
  const s = String(v == null ? '' : v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34) out += String.fromCharCode(39);
    else if (c === 92) out += '/';
    else if (c === 60) out += '&lt;';
    else if (c === 62) out += '&gt;';
    else if (c < 32) out += ' ';
    else out += s.charAt(i);
  }
  return out;
}

function esc(v) {
  const s = String(v == null ? '' : v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else out += ch;
  }
  return out;
}

function trunc(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function p2(x) { return x < 10 ? '0' + x : String(x); }

function fmtClock(ms, withDate) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '--';
  const c = p2(d.getHours()) + ':' + p2(d.getMinutes());
  return withDate ? p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + c : c;
}

function parseTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

function containsAny(role, words) {
  const r = String(role == null ? '' : role).toLowerCase();
  for (let i = 0; i < words.length; i++) {
    if (r.indexOf(words[i]) >= 0) return true;
  }
  return false;
}

const ROLE_CAPTAIN = ['captain', '主控', '调度'];
const ROLE_ADVISOR = ['军师', '参谋', 'strateg', 'advisor', 'think'];
const ROLE_KB = ['知识库', 'knowledge', 'kb', '运营', 'ops'];

function buildTeamModel(team) {
  const id = cleanStr(team.id || '');
  const name = cleanStr(team.name || '(未命名团队)');
  const archived = !!team.archived;
  const captainSessionId = cleanStr(team.captainSessionId || '');
  const members = Array.isArray(team.members) ? team.members : [];
  // 成员 -> 泳道分组（主控/军师/知识库按 role 归类，其余归执行层）
  const memberLane = {};
  members.forEach(function (m) {
    const mname = cleanStr(m.name || '');
    const role = cleanStr(m.role || '');
    let laneKey = null;
    if (containsAny(role, ROLE_CAPTAIN)) laneKey = 'captain';
    else if (containsAny(role, ROLE_ADVISOR)) laneKey = 'advisor';
    else if (containsAny(role, ROLE_KB)) laneKey = 'kb';
    if (laneKey && mname) memberLane[mname] = laneKey;
    const mid = cleanStr(m.id || '');
    if (laneKey && mid) memberLane[mid] = laneKey;
  });
  const raw = Array.isArray(team.tasks) ? team.tasks : [];
  const nodes = raw.map(function (t, i) {
    return {
      id: cleanStr(t.id || ('task-' + i)),
      subject: cleanStr(t.subject || t.id || ('任务 ' + (i + 1))),
      status: MAP_STATUS[t.status] || 'idle',
      assignee: cleanStr(t.assignee || ''),
      createdAt: parseTime(t.createdAt),
      updatedAt: parseTime(t.updatedAt),
      deps: Array.isArray(t.dependencies) ? t.dependencies.map(cleanStr) : [],
      weight: null,
      bounces: 0,
      reasons: [],
      suggestion: null,
      rework: false,
      row: -1
    };
  });
  const byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  const edges = [];
  nodes.forEach(function (n) {
    n.deps.forEach(function (d) {
      const from = byId[d];
      if (!from || from.id === n.id) return;
      const key = from.id + '>>' + n.id;
      for (let k = 0; k < edges.length; k++) { if (edges[k].id === key) return; }
      edges.push({
        id: key,
        from: from.id,
        to: n.id,
        dashed: from.assignee !== n.assignee,
        failed: from.status === 'error' || n.status === 'error',
        weight: null,
        failCount: null
      });
    });
  });
  // 层级深度（最长路径松弛，带守卫）
  const depth = {};
  nodes.forEach(function (n) { depth[n.id] = 0; });
  let changed = true; let guard = 0;
  while (changed && guard < 200) {
    changed = false; guard++;
    edges.forEach(function (e) {
      const d = depth[e.from] + 1;
      if (d > depth[e.to]) { depth[e.to] = d; changed = true; }
    });
  }
  const levels = {};
  nodes.forEach(function (n) {
    const d = depth[n.id];
    if (!levels[d]) levels[d] = [];
    levels[d].push(n);
  });
  const levelKeys = Object.keys(levels).map(Number).sort(function (a, b) { return a - b; });
  levelKeys.forEach(function (d) {
    levels[d].sort(function (a, b) {
      if (a.createdAt == null && b.createdAt == null) return 0;
      if (a.createdAt == null) return 1;
      if (b.createdAt == null) return -1;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.subject.localeCompare(b.subject);
    });
  });
  // 泳道：真人 -> 主控 -> 执行层(按任务首次出现) -> 军师 -> 知识库 -> 未指派
  const lanes = [
    { key: 'person', label: '真人', nodes: [] },
    { key: 'captain', label: '主控', nodes: [] }
  ];
  function laneOf(n) {
    if (n.assignee === '') return 'unassigned';
    if (memberLane[n.assignee]) return memberLane[n.assignee];
    if (n.assignee === captainSessionId) return 'captain';
    return 'exec:' + n.assignee;
  }
  const ordered = nodes.slice().sort(function (a, b) {
    if (a.createdAt == null && b.createdAt == null) return 0;
    if (a.createdAt == null) return 1;
    if (b.createdAt == null) return -1;
    return a.createdAt - b.createdAt;
  });
  const laneIndex = { person: 0, captain: 1 };
  const execOrder = [];
  let advisorLane = null, kbLane = null, unassignedLane = null;
  ordered.forEach(function (n) {
    const k = laneOf(n);
    if (k === 'unassigned') { if (!unassignedLane) unassignedLane = { key: 'unassigned', label: '未指派', nodes: [] }; unassignedLane.nodes.push(n); return; }
    if (k === 'advisor') { if (!advisorLane) advisorLane = { key: 'advisor', label: '军师', nodes: [] }; advisorLane.nodes.push(n); return; }
    if (k === 'kb') { if (!kbLane) kbLane = { key: 'kb', label: '知识库', nodes: [] }; kbLane.nodes.push(n); return; }
    if (k === 'captain') { lanes[1].nodes.push(n); return; }
    if (!laneIndex[k]) { laneIndex[k] = lanes.length; lanes.push({ key: k, label: n.assignee, nodes: [] }); execOrder.push(k); }
    lanes[laneIndex[k]].nodes.push(n);
  });
  if (advisorLane) lanes.push(advisorLane);
  if (kbLane) lanes.push(kbLane);
  if (unassignedLane) lanes.push(unassignedLane);
  lanes.forEach(function (lane, li) { lane.nodes.forEach(function (n) { n.row = li; }); });
  // 时间范围与横条百分比
  let t0 = null, t1 = null;
  nodes.forEach(function (n) {
    if (n.createdAt != null) { if (t0 === null || n.createdAt < t0) t0 = n.createdAt; }
    if (n.updatedAt != null) { if (t1 === null || n.updatedAt > t1) t1 = n.updatedAt; }
  });
  if (t0 === null && t1 === null) { t0 = 0; t1 = 3600000; }
  if (t0 === null) t0 = t1 - 3600000;
  if (t1 === null) t1 = t0 + 3600000;
  if (t1 <= t0) t1 = t0 + 3600000;
  const pad = (t1 - t0) * 0.02;
  const s0 = t0 - pad, s1 = t1 + pad;
  const rspan = s1 - s0;
  const minPct = 1.6;
  nodes.forEach(function (n) {
    const start = n.createdAt == null ? s0 : Math.max(s0, n.createdAt);
    const end = n.updatedAt == null ? start : Math.min(s1, Math.max(n.updatedAt, start));
    let wPct = (end - start) / rspan * 100;
    if (wPct < minPct) wPct = minPct;
    let lPct = (start - s0) / rspan * 100;
    if (lPct + wPct > 100) lPct = Math.max(0, 100 - wPct);
    n.leftPct = Math.round(lPct * 100) / 100;
    n.widthPct = Math.round(wPct * 100) / 100;
  });
  // 任务簇：同泳道任务 > CLUSTER_N 时按时间重叠聚簇（不重叠不合并，不撒谎）
  const clusterGroups = {};
  lanes.forEach(function (lane) {
    let groups;
    if (lane.nodes.length > CLUSTER_N) {
      const sorted = lane.nodes.slice().sort(function (a, b) { return a.leftPct - b.leftPct; });
      groups = [];
      let cur = null;
      sorted.forEach(function (n) {
        if (cur && n.leftPct <= cur.right + 0.5) {
          cur.right = Math.max(cur.right, n.leftPct + n.widthPct);
          cur.items.push(n);
        } else {
          cur = { left: n.leftPct, right: n.leftPct + n.widthPct, items: [n] };
          groups.push(cur);
        }
      });
    } else {
      groups = lane.nodes.map(function (n) { return { left: n.leftPct, right: n.leftPct + n.widthPct, items: [n] }; });
    }
    clusterGroups[lane.key] = groups;
  });
  // 最近活跃：任务时间与消息时间的最大值
  let lastActive = 0;
  nodes.forEach(function (n) {
    if (n.createdAt != null && n.createdAt > lastActive) lastActive = n.createdAt;
    if (n.updatedAt != null && n.updatedAt > lastActive) lastActive = n.updatedAt;
  });
  (Array.isArray(team.messages) ? team.messages : []).forEach(function (msg) {
    const t = parseTime(msg.ts);
    if (t != null && t > lastActive) lastActive = t;
  });
  // 团队整体状态
  let tstatus = 'idle';
  let hasRun = false, hasFail = false, allDone = nodes.length > 0;
  nodes.forEach(function (n) {
    if (n.status === 'running') hasRun = true;
    if (n.status === 'error') hasFail = true;
    if (n.status !== 'done') allDone = false;
  });
  if (hasRun) tstatus = 'running'; else if (hasFail) tstatus = 'error'; else if (allDone) tstatus = 'done';
  // 里程碑：预留（无数据为空；归档团队补一枚"已归档"圆点）
  const milestones = [];
  if (archived) milestones.push({ at: Math.round(s0 + rspan / 2), label: '团队已归档' });
  return {
    id: id, name: name, archived: archived, nodes: nodes, edges: edges,
    levels: levels, levelKeys: levelKeys, lanes: lanes,
    clusterGroups: clusterGroups, milestones: milestones,
    t0: s0, t1: s1, status: tstatus, lastActive: lastActive
  };
}

function nodeHtml(n) {
  const sub = (n.assignee === '' ? '未指派' : n.assignee) + (n.createdAt == null ? '' : ' · ' + fmtClock(n.createdAt, true));
  const badge = '<span class="ds-bounce v2-badge"' + (n.bounces > 0 ? '' : ' hidden') + '>' + n.bounces + '</span>';
  const reasons = n.reasons.length > 0
    ? '<ul class="ds-pop-list">' + n.reasons.map(function (r) { return '<li>' + esc(trunc(cleanStr(r), 80)) + '</li>'; }).join('') + '</ul>'
    : '<div class="ds-pop-empty">暂无打回原因记录</div>';
  return '<div class="ds-node-wrap">'
    + '<div class="v2-node v2-st--' + n.status + ' ds-node ds-hoverable" data-task-id="' + n.id + '" data-status="' + n.status + '" data-row="' + n.row + '" title="' + esc(n.subject) + '">'
    + badge
    + '<div class="ds-bounce-pop v2-popover"><div class="ds-pop-title">打回原因</div>' + reasons + '</div>'
    + '<div class="ds-node-title">' + esc(trunc(n.subject, 16)) + '</div>'
    + '<div class="ds-node-sub">' + esc(sub) + '</div>'
    + '<div class="ds-node-strip"></div>'
    + '</div></div>';
}

function clusterStatus(items) {
  let hasRun = false, hasErr = false, allDone = true;
  items.forEach(function (n) {
    if (n.status === 'running') hasRun = true;
    if (n.status === 'error') hasErr = true;
    if (n.status !== 'done') allDone = false;
  });
  if (hasErr) return 'error';
  if (hasRun) return 'running';
  if (allDone) return 'done';
  return 'idle';
}

function barsHtml(m) {
  let out = '';
  m.lanes.forEach(function (lane, li) {
    const groups = m.clusterGroups[lane.key] || [];
    const folded = li >= LANE_CAP;
    const foldCls = folded ? ' ds-folded' : '';
    const foldAttr = folded ? ' hidden' : '';
    groups.forEach(function (g) {
      const left = Math.min.apply(null, g.items.map(function (n) { return n.leftPct; }));
      const right = Math.max.apply(null, g.items.map(function (n) { return n.leftPct + n.widthPct; }));
      const top = li * ROWH + 5;
      if (g.items.length === 1) {
        const n = g.items[0];
        const extra = n.rework ? ' v2-rework' : '';
        out += '<div class="ds-bar v2-st--' + n.status + extra + foldCls + '" data-task-id="' + n.id + '" data-row="' + li + '" style="left:' + n.leftPct + '%;width:' + n.widthPct + '%;top:' + top + 'px" title="' + esc(n.subject) + '"' + foldAttr + '></div>';
        if (n.suggestion) {
          out += '<span class="ds-mark v2-mark v2-hoverable' + foldCls + '" style="left:' + (n.leftPct + n.widthPct / 2) + '%;top:' + (li * ROWH + 1) + 'px"' + foldAttr + '><span class="v2-popover">' + esc(trunc(cleanStr(n.suggestion), 60)) + '</span></span>';
        }
      } else {
        const st = clusterStatus(g.items);
        const pop = '<div class="v2-popover ds-cluster-pop"><div class="ds-pop-title">' + g.items.length + ' 个任务</div><ul class="ds-pop-list">'
          + g.items.map(function (n) {
            return '<li>' + esc(trunc(n.subject, 24)) + ' <span class="v2-tag v2-st--' + n.status + '">' + STATUS_LABEL[n.status] + '</span></li>';
          }).join('')
          + '</ul></div>';
        const ids = JSON.stringify(g.items.map(function (n) { return n.id; }));
        const extra = g.items.some(function (n) { return n.rework; }) ? ' v2-rework' : '';
        out += '<div class="ds-cluster v2-hoverable v2-st--' + st + extra + foldCls + '" data-row="' + li + '" data-task-ids="' + esc(ids) + '" style="left:' + left + '%;width:' + Math.max(1.6, right - left) + '%;top:' + top + 'px" title="' + esc(g.items.map(function (n) { return n.subject; }).join(' / ')) + '"' + foldAttr + '>'
          + '<span class="ds-cluster-count">' + g.items.length + '</span>'
          + pop
          + '</div>';
      }
    });
  });
  return out;
}

function rowsHtml(m) {
  let out = '<div class="ds-rowlabels">';
  const foldN = m.lanes.length - LANE_CAP;
  m.lanes.forEach(function (lane, li) {
    const folded = li >= LANE_CAP;
    out += '<div class="ds-rowlabel' + (folded ? ' ds-folded' : '') + '" data-row="' + li + '" title="' + esc(lane.label) + '"' + (folded ? ' hidden' : '') + '>' + esc(trunc(lane.label, 12)) + '</div>';
  });
  if (foldN > 0) {
    out += '<div class="ds-rowlabel ds-foldrow"><button type="button" class="v2-btn ds-foldbtn" data-action="fold">展开 +' + foldN + '</button></div>';
  }
  out += '</div>';
  return out;
}

function rowlinesHtml(m) {
  let out = '';
  for (let i = 0; i < m.lanes.length; i++) {
    const folded = i >= LANE_CAP;
    out += '<div class="ds-rowline' + (folded ? ' ds-folded' : '') + '" data-row="' + i + '" style="top:' + (i * ROWH + 33) + 'px"' + (folded ? ' hidden' : '') + '></div>';
  }
  return out;
}

function milestonesHtml(m) {
  let out = '';
  const rspan = m.t1 - m.t0;
  m.milestones.forEach(function (ms) {
    const pct = rspan > 0 ? Math.max(0, Math.min(100, (ms.at - m.t0) / rspan * 100)) : 50;
    out += '<span class="ds-milestone" style="left:' + pct + '%;top:6px" title="' + esc(cleanStr(ms.label)) + '"></span>';
  });
  return out;
}

const ZOOM_BTNS = '<button type="button" class="v2-btn ds-zoombtn v2-selected" data-zoom="global">全局</button>'
  + '<button type="button" class="v2-btn ds-zoombtn" data-zoom="hour">按小时</button>'
  + '<button type="button" class="v2-btn ds-zoombtn" data-zoom="event">事件</button>';

function teamHtml(m, isDefault) {
  const hidden = isDefault ? '' : ' hidden';
  const marker = '<defs><marker id="ds-arrow-' + m.id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z"></path></marker></defs>';
  const levelsHtml = m.levelKeys.map(function (d) {
    return '<div class="ds-col" data-level="' + d + '">' + m.levels[d].map(nodeHtml).join('') + '</div>';
  }).join('');
  const emptyNote = m.nodes.length === 0 ? '<div class="ds-empty">该团队暂无任务数据</div>' : '';
  const visibleRows = Math.min(m.lanes.length, LANE_CAP);
  const foldN = m.lanes.length - LANE_CAP;
  const lanesHeight = visibleRows * ROWH + (foldN > 0 ? 30 : 0) + 6;
  const legend = '<div class="ds-legend v2-legend">'
    + '<span class="ds-lg"><span class="ds-lg-line ds-lg-solid"></span>同角色依赖</span>'
    + '<span class="ds-lg"><span class="ds-lg-line ds-lg-dash"></span>跨角色调用</span>'
    + '<span class="ds-lg"><span class="ds-lg-line ds-lg-fail"></span>失败/打回</span>'
    + '<span class="ds-lg"><span class="ds-lg-swatch v2-rework"></span>返工区间</span>'
    + '<span class="ds-lg"><span class="ds-lg-swatch v2-mark"></span>军师建议</span>'
    + '<span class="ds-range v2-num">' + fmtClock(m.t0, true) + ' — ' + fmtClock(m.t1, true) + '</span>'
    + '</div>';
  const payload = {
    nodes: m.nodes, edges: m.edges, lanes: m.lanes, t0: m.t0, t1: m.t1,
    laneCap: LANE_CAP
  };
  return '<article class="v2-card ds-team" data-team-id="' + m.id + '"' + hidden + '>'
    + '<header class="ds-thead">'
    + '<strong class="ds-tname">' + esc(m.name) + '</strong>'
    + '<span class="v2-tag v2-st--' + m.status + '">' + STATUS_LABEL[m.status] + '</span>'
    + (m.archived ? '<span class="v2-tag v2-st--archived">已归档</span>' : '')
    + '<div class="ds-zoom">'
    + '<button type="button" class="v2-btn ds-reltoggle" data-action="rel" aria-pressed="false">显示关系</button>'
    + ZOOM_BTNS
    + '</div>'
    + '</header>'
    + '<div class="ds-graph">'
    + '<svg class="ds-lines">' + marker + '</svg>'
    + '<div class="ds-levels">' + levelsHtml + '</div>'
    + emptyNote
    + '</div>'
    + '<div class="ds-swim">'
    + '<div class="ds-axiswrap"><div class="ds-axis-spacer"></div><div class="ds-axis"></div></div>'
    + '<div class="ds-swim-grid">'
    + rowsHtml(m)
    + '<div class="ds-laneswrap"><div class="ds-lanes" style="height:' + lanesHeight + 'px">'
    + '<div class="ds-events"></div>'
    + rowlinesHtml(m)
    + barsHtml(m)
    + milestonesHtml(m)
    + '<svg class="ds-swimlines" width="0" height="0"></svg>'
    + '<div class="ds-relabels"></div>'
    + '</div></div>'
    + '</div>'
    + '</div>'
    + legend
    + '<script type="application/json" class="ds-json">' + JSON.stringify(payload) + '</script>'
    + '</article>';
}

function tabsHtml(models, defaultId) {
  let out = '';
  models.forEach(function (m) {
    const sel = m.id === defaultId ? ' v2-selected' : '';
    out += '<button type="button" class="v2-btn ds-tab' + sel + '" data-team="' + m.id + '">'
      + esc(m.name)
      + ' <span class="ds-tab-count v2-num">' + m.nodes.length + '</span>'
      + (m.archived ? ' <span class="v2-tag v2-st--archived">归档</span>' : '')
      + '</button>';
  });
  return out;
}

const DS_STYLE = `
.ds-root{padding:var(--sp-3,12px);}
.ds-title{font-size:var(--fs-16,16px);font-weight:600;color:var(--tx-strong);margin:0 0 2px;}
.ds-sub{font-size:var(--fs-13,13px);color:var(--tx-weak);margin:0 0 var(--sp-3,12px);}
.ds-tabs{display:flex;flex-wrap:wrap;gap:var(--sp-2,8px);margin-bottom:var(--sp-3,12px);}
.ds-tab{font-size:var(--fs-13,13px);}
.ds-tab-count{font-variant-numeric:tabular-nums;color:var(--tx-weak);}
.ds-tab .v2-tag{display:inline-block;padding:0 6px;font-size:var(--fs-12,12px);}
.ds-team{margin-bottom:var(--sp-3,12px);padding:var(--sp-3,12px);}
.ds-team[hidden]{display:none;}
.ds-thead{display:flex;align-items:center;gap:var(--sp-2,8px);margin-bottom:var(--sp-3,12px);}
.ds-tname{font-size:var(--fs-16,16px);color:var(--tx-strong);}
.ds-zoom{margin-left:auto;display:flex;gap:6px;}
.ds-zoombtn{font-size:var(--fs-12,12px);padding:2px 10px;}
.ds-reltoggle{font-size:var(--fs-12,12px);padding:2px 10px;}
.ds-graph{position:relative;overflow-x:auto;padding:var(--sp-3,12px);border:1px solid var(--bd-line);border-radius:var(--radius-s,4px);background:var(--bg-page);min-height:120px;}
.ds-lines{position:absolute;top:0;left:0;z-index:0;pointer-events:none;overflow:visible;}
.ds-lines marker path{fill:var(--tx-weak);}
.ds-levels{position:relative;z-index:1;display:flex;gap:64px;align-items:flex-start;min-width:max-content;}
.ds-col{display:flex;flex-direction:column;gap:16px;}
.ds-node-wrap{position:relative;}
.ds-node{width:172px;padding:10px 10px 8px;cursor:pointer;}
.ds-node-title{font-size:var(--fs-13,13px);line-height:1.4;color:var(--tx-strong);max-height:2.8em;overflow:hidden;}
.ds-node-sub{font-size:var(--fs-12,12px);color:var(--tx-weak);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ds-node-strip{height:4px;margin-top:8px;border-radius:var(--radius-xs,2px);background:var(--st-main);}
.ds-bounce{position:absolute;top:-8px;right:-8px;z-index:2;}
.ds-bounce-pop{top:16px;right:-6px;min-width:190px;display:none;}
.ds-node.ds-open .ds-bounce-pop{display:block;}
.ds-pop-title{font-size:var(--fs-12,12px);font-weight:600;color:var(--tx-strong);margin-bottom:6px;}
.ds-pop-empty{font-size:var(--fs-12,12px);color:var(--tx-weak);}
.ds-pop-list{margin:0;padding-left:16px;font-size:var(--fs-12,12px);color:var(--tx-body);}
.ds-empty{padding:24px;font-size:var(--fs-13,13px);color:var(--tx-weak);text-align:center;}
.ds-swim{margin-top:var(--sp-3,12px);}
.ds-axiswrap{display:flex;}
.ds-axis-spacer{width:140px;flex:none;}
.ds-axis{position:relative;flex:1;height:30px;overflow:hidden;}
.ds-tick{position:absolute;top:0;bottom:0;border-left:1px solid var(--bd-line);padding-left:4px;}
.ds-tick-label{font-size:var(--fs-12,12px);color:var(--tx-weak);font-variant-numeric:tabular-nums;white-space:nowrap;}
.ds-tick-end{padding-left:0;border-left:none;}
.ds-tick-end .ds-tick-label{position:absolute;right:100%;top:0;}
.ds-swim-grid{display:flex;margin-top:4px;}
.ds-rowlabels{width:140px;flex:none;}
.ds-rowlabel{height:34px;font-size:var(--fs-12,12px);color:var(--tx-body);line-height:34px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;text-align:right;}
.ds-foldrow{height:30px;line-height:30px;}
.ds-foldbtn{font-size:var(--fs-12,12px);padding:1px 8px;}
.ds-laneswrap{flex:1;overflow-x:auto;overflow-y:auto;max-height:280px;}
.ds-lanes{position:relative;width:100%;}
.ds-rowline{position:absolute;left:0;right:0;border-bottom:1px solid var(--bd-line);z-index:0;}
.ds-events{position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;pointer-events:none;}
.ds-evline{position:absolute;top:0;bottom:0;border-left:1px dashed var(--tx-weak);}
.ds-bar{position:absolute;z-index:2;height:24px;border-radius:var(--radius-xs,2px);background:var(--st-main);border:1px solid var(--st-bd);cursor:pointer;min-width:14px;}
.ds-cluster{position:absolute;z-index:2;height:24px;border-radius:var(--radius-xs,2px);background:var(--st-main);border:1px solid var(--st-bd);cursor:pointer;min-width:14px;display:flex;align-items:center;justify-content:center;}
.ds-cluster-count{font-size:var(--fs-12,12px);color:var(--st-fg);font-variant-numeric:tabular-nums;}
.ds-cluster .v2-popover{min-width:220px;}
.ds-mark{position:absolute;z-index:3;}
.ds-milestone{position:absolute;z-index:2;width:8px;height:8px;border-radius:50%;background:var(--tx-weak);}
.ds-swimlines{position:absolute;top:0;left:0;z-index:4;pointer-events:none;overflow:visible;}
.ds-swimlines marker path{fill:var(--tx-weak);}
.ds-relabels{position:absolute;top:0;left:0;right:0;bottom:0;z-index:5;pointer-events:none;}
.ds-rel-label{position:absolute;font-size:var(--fs-12,12px);white-space:nowrap;pointer-events:none;}
.ds-swim-line.ds-dim{opacity:.12;}
.ds-swim-line.ds-hot{opacity:1;}
.ds-focus .ds-bar:not(.ds-hot){opacity:.12;}
.ds-focus .ds-cluster:not(.ds-hot){opacity:.12;}
.ds-focus .ds-rowlabel:not(.ds-hot){opacity:.12;}
.ds-bar.ds-hot,.ds-cluster.ds-hot{outline:1px solid var(--tx-strong);}
.ds-rowlabel.ds-hot{color:var(--tx-strong);font-weight:600;}
.ds-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:var(--sp-2,8px);}
.ds-lg{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-12,12px);color:var(--tx-weak);}
.ds-lg-line{display:inline-block;width:22px;height:0;border-top-width:2px;border-top-style:solid;}
.ds-lg-solid{border-top-color:var(--tx-weak);}
.ds-lg-dash{border-top-style:dashed;border-top-color:var(--c-running);}
.ds-lg-fail{border-top-style:dashed;border-top-color:var(--c-error);}
.ds-lg-swatch{display:inline-block;width:12px;height:12px;}
.ds-range{margin-left:auto;font-size:var(--fs-12,12px);color:var(--tx-weak);}
`;

const DS_SCRIPT = `
(function () {
  var CLS = ['idle', 'running', 'done', 'error', 'decision', 'archived'];
  var STMAP = { pending: 'idle', running: 'running', completed: 'done', failed: 'error', cancelled: 'error' };
  var MAXHOT = 4;
  function p2(x) { return x < 10 ? '0' + x : String(x); }
  function clock(ms, withDate) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '--';
    var c = p2(d.getHours()) + ':' + p2(d.getMinutes());
    return withDate ? p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + c : c;
  }
  function fmtBytes(b) {
    if (b > 1048576) return (b / 1048576).toFixed(1) + 'MB';
    if (b > 1024) return Math.round(b / 1024) + 'KB';
    return b + 'B';
  }
  function parse(sec) {
    if (sec.dsData) return sec.dsData;
    var el = sec.querySelector('.ds-json');
    sec.dsData = JSON.parse(el.textContent);
    return sec.dsData;
  }
  function findEl(sec, cls, attr, val) {
    var all = sec.querySelectorAll(cls);
    for (var i = 0; i < all.length; i++) { if (all[i].getAttribute(attr) === val) return all[i]; }
    return null;
  }
  function findPath(sec, id) {
    var all = sec.querySelectorAll('.ds-lines path');
    for (var i = 0; i < all.length; i++) { if (all[i].getAttribute('data-edge') === id) return all[i]; }
    return null;
  }
  function clearState(el) {
    for (var i = 0; i < CLS.length; i++) { el.classList.remove('v2-st--' + CLS[i]); }
  }
  function edgeClass(e) {
    return e.failed ? 'v2-line--fail' : (e.dashed ? 'v2-line--cross' : 'v2-line--dep');
  }
  function relLabel(e) {
    var parts = ['依赖'];
    if (e.failed) parts.push('失败');
    if (e.weight != null) parts.push(fmtBytes(e.weight));
    if (e.failCount != null) parts.push('打回' + e.failCount);
    return parts.join(' · ');
  }
  function drawEdges(sec) {
    var data = parse(sec);
    var graph = sec.querySelector('.ds-graph');
    var svg = sec.querySelector('.ds-lines');
    var g = graph.getBoundingClientRect();
    if (g.width < 2 || g.height < 2) return;
    svg.setAttribute('width', g.width);
    svg.setAttribute('height', g.height);
    while (svg.lastChild && svg.lastChild.tagName === 'path') { svg.removeChild(svg.lastChild); }
    var marker = 'url(#ds-arrow-' + sec.getAttribute('data-team-id') + ')';
    data.edges.forEach(function (e) {
      var fn = findEl(sec, '.ds-node', 'data-task-id', e.from);
      var tn = findEl(sec, '.ds-node', 'data-task-id', e.to);
      if (!fn || !tn) return;
      var fr = fn.getBoundingClientRect();
      var tr = tn.getBoundingClientRect();
      var x1 = fr.right - g.left, y1 = fr.top + fr.height / 2 - g.top;
      var x2 = tr.left - g.left, y2 = tr.top + tr.height / 2 - g.top;
      var dx = Math.min(48, Math.max(10, (x2 - x1) / 2));
      var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ',' + (x2 - dx) + ' ' + y2 + ',' + x2 + ' ' + y2;
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('data-edge', e.id);
      p.setAttribute('class', edgeClass(e));
      var w = 1.5;
      if (e.weight != null) { w = e.weight > 100000 ? 3 : (e.weight > 10000 ? 2 : 1.5); }
      p.setAttribute('stroke-width', String(w));
      p.setAttribute('fill', 'none');
      p.setAttribute('marker-end', marker);
      svg.appendChild(p);
    });
  }
  function clusterOf(sec, id) {
    var all = sec.querySelectorAll('.ds-cluster');
    for (var i = 0; i < all.length; i++) {
      var ids;
      try { ids = JSON.parse(all[i].getAttribute('data-task-ids')); } catch (err) { ids = []; }
      for (var k = 0; k < ids.length; k++) { if (ids[k] === id) return all[i]; }
    }
    return null;
  }
  function barEl(sec, id) {
    return findEl(sec, '.ds-bar', 'data-task-id', id) || clusterOf(sec, id);
  }
  function barRect(sec, id) {
    var el = barEl(sec, id);
    return el ? el.getBoundingClientRect() : null;
  }
  function nodeRow(data, id) {
    for (var i = 0; i < data.nodes.length; i++) { if (data.nodes[i].id === id) return data.nodes[i].row; }
    return -1;
  }
  function drawSwimLines(sec) {
    var data = parse(sec);
    var lanes = sec.querySelector('.ds-lanes');
    var svg = sec.querySelector('.ds-swimlines');
    var labels = sec.querySelector('.ds-relabels');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    while (labels.firstChild) labels.removeChild(labels.firstChild);
    var lr = lanes.getBoundingClientRect();
    if (lr.width < 2 || lr.height < 2) return;
    svg.setAttribute('width', lr.width);
    svg.setAttribute('height', lr.height);
    var toggleOn = sec.dsShowRel === true;
    var focusId = sec.dsFocus || null;
    var list = [];
    if (toggleOn) { data.edges.forEach(function (e) { list.push({ edge: e, hot: false }); }); }
    if (focusId) {
      data.edges.forEach(function (e) {
        if (e.from === focusId || e.to === focusId) {
          var found = null;
          for (var i = 0; i < list.length; i++) { if (list[i].edge.id === e.id) { found = list[i]; break; } }
          if (found) found.hot = true; else list.push({ edge: e, hot: true });
        }
      });
    }
    var hotSet = {};
    var hotN = 0;
    list.forEach(function (it) { if (it.hot && hotN < MAXHOT) { hotSet[it.edge.id] = true; hotN++; } });
    var marker = 'url(#ds-arrow-' + sec.getAttribute('data-team-id') + ')';
    list.forEach(function (it) {
      var e = it.edge;
      var a = barRect(sec, e.from);
      var b = barRect(sec, e.to);
      if (!a || !b) return;
      var hot = !!hotSet[e.id];
      var x1 = a.right - lr.left, y1 = a.top + a.height / 2 - lr.top;
      var x2 = b.left - lr.left, y2 = b.top + b.height / 2 - lr.top;
      var d;
      if (Math.abs(y1 - y2) < 1) {
        d = 'M' + x1 + ' ' + y1 + ' L' + (x2 - 6) + ' ' + y2 + ' L' + x2 + ' ' + y2;
      } else {
        var xc = Math.max(x1 + 8, x2 + 8);
        d = 'M' + x1 + ' ' + y1 + ' L' + (x1 + 8) + ' ' + y1 + ' L' + xc + ' ' + y1 + ' L' + xc + ' ' + y2 + ' L' + (x2 - 6) + ' ' + y2 + ' L' + x2 + ' ' + y2;
      }
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('data-swim-edge', e.id);
      p.setAttribute('class', 'ds-swim-line ' + edgeClass(e) + (hot ? ' ds-hot' : ' ds-dim'));
      p.setAttribute('fill', 'none');
      p.setAttribute('marker-end', marker);
      svg.appendChild(p);
      if (hot) {
        var lb = document.createElement('div');
        lb.className = 'ds-rel-label v2-tag' + (e.failed ? ' v2-st--error' : ' v2-st--running');
        lb.textContent = relLabel(e);
        lb.style.left = Math.min(x1 + 12, lr.width - 150) + 'px';
        lb.style.top = Math.max(0, y1 - 12) + 'px';
        labels.appendChild(lb);
      }
    });
  }
  function clearHot(sec) {
    var hs = sec.querySelectorAll('.ds-hot');
    for (var i = 0; i < hs.length; i++) { hs[i].classList.remove('ds-hot'); }
  }
  function focusTask(sec, id, pin) {
    var data = parse(sec);
    sec.dsFocus = id;
    if (pin) sec.dsPin = id;
    sec.querySelector('.ds-lanes').classList.add('ds-focus');
    clearHot(sec);
    var el = barEl(sec, id);
    if (el) el.classList.add('ds-hot');
    var row = nodeRow(data, id);
    var rl = findEl(sec, '.ds-rowlabel', 'data-row', String(row));
    if (rl) rl.classList.add('ds-hot');
    drawSwimLines(sec);
  }
  function unfocus(sec) {
    if (sec.dsPin) return;
    sec.dsFocus = null;
    sec.querySelector('.ds-lanes').classList.remove('ds-focus');
    clearHot(sec);
    drawSwimLines(sec);
  }
  function drawAxis(sec) {
    var data = parse(sec);
    var axis = sec.querySelector('.ds-axis');
    var zoom = sec.dsZoom || 'global';
    while (axis.firstChild) axis.removeChild(axis.firstChild);
    var t0 = data.t0, t1 = data.t1, span = t1 - t0;
    if (!(span > 0)) span = 3600000;
    var ticks = [];
    if (zoom === 'event') {
      var set = {};
      data.nodes.forEach(function (n) {
        if (n.createdAt != null) set[n.createdAt] = 1;
        if (n.updatedAt != null) set[n.updatedAt] = 1;
      });
      Object.keys(set).forEach(function (k) { ticks.push(Number(k)); });
      ticks.sort(function (a, b) { return a - b; });
    } else if (zoom === 'hour') {
      var h = 3600000;
      var first = Math.floor(t0 / h) * h;
      var cnt = 0;
      for (var t = first; t <= t1 && cnt < 97; t += h) { ticks.push(t); cnt++; }
    } else {
      var step = span / 6;
      for (var k = 0; k <= 6; k++) { ticks.push(t0 + step * k); }
    }
    var sparse = ticks.length > 16;
    ticks.forEach(function (t, i) {
      var pct = Math.max(0, Math.min(100, (t - t0) / span * 100));
      var d = document.createElement('div');
      d.className = pct >= 88 ? 'ds-tick ds-tick-end' : 'ds-tick';
      d.style.left = pct + '%';
      if (!(sparse && i % 2 === 1)) {
        var lb = document.createElement('span');
        lb.className = 'ds-tick-label v2-num';
        lb.textContent = clock(t, zoom === 'global');
        d.appendChild(lb);
      }
      axis.appendChild(d);
    });
    var ev = sec.querySelector('.ds-events');
    if (ev) {
      while (ev.firstChild) ev.removeChild(ev.firstChild);
      if (zoom === 'event') {
        ticks.forEach(function (t) {
          var pct = (t - t0) / span * 100;
          var ln = document.createElement('div');
          ln.className = 'ds-evline';
          ln.style.left = pct + '%';
          ev.appendChild(ln);
        });
      }
    }
  }
  function clearSel(sec) {
    var s = sec.querySelectorAll('.ds-node.v2-selected,.ds-bar.v2-selected,.ds-cluster.v2-selected,.ds-rowlabel.v2-selected');
    for (var i = 0; i < s.length; i++) { s[i].classList.remove('v2-selected'); }
  }
  function selectTask(sec, id) {
    clearSel(sec);
    var node = findEl(sec, '.ds-node', 'data-task-id', id);
    if (node) {
      node.classList.add('v2-selected');
      var g = sec.querySelector('.ds-graph');
      var gr = g.getBoundingClientRect();
      var nr = node.getBoundingClientRect();
      g.scrollLeft = Math.max(0, g.scrollLeft + nr.left - gr.left - g.clientWidth / 2);
    }
    var bar = barEl(sec, id);
    var lw = sec.querySelector('.ds-laneswrap');
    if (bar) {
      bar.classList.add('v2-selected');
      var lr = lw.getBoundingClientRect();
      var br = bar.getBoundingClientRect();
      lw.scrollLeft = Math.max(0, lw.scrollLeft + br.left - lr.left - lw.clientWidth / 2);
      lw.scrollTop = Math.max(0, lw.scrollTop + br.top - lr.top - lw.clientHeight / 2);
    }
    focusTask(sec, id, true);
  }
  function updateTask(sec, id, st) {
    var data = parse(sec);
    var s = STMAP[st] || 'idle';
    var node = findEl(sec, '.ds-node', 'data-task-id', id);
    if (node) {
      clearState(node);
      node.classList.add('v2-st--' + s);
      node.setAttribute('data-status', s);
    }
    var bar = findEl(sec, '.ds-bar', 'data-task-id', id);
    if (bar) {
      clearState(bar);
      bar.classList.add('v2-st--' + s);
    }
    var map = {};
    data.nodes.forEach(function (n) { map[n.id] = n; });
    var hit = map[id];
    if (hit) hit.status = s;
    data.edges.forEach(function (e) {
      if (e.from !== id && e.to !== id) return;
      e.failed = map[e.from].status === 'error' || map[e.to].status === 'error';
      var p = findPath(sec, e.id);
      if (p) p.setAttribute('class', edgeClass(e));
    });
    if (sec.dsShowRel || sec.dsFocus) drawSwimLines(sec);
    return true;
  }
  function setFold(sec, expand) {
    var els = sec.querySelectorAll('.ds-folded');
    for (var i = 0; i < els.length; i++) {
      if (expand) els[i].removeAttribute('hidden'); else els[i].setAttribute('hidden', '');
    }
    var data = parse(sec);
    var foldN = data.lanes.length - 6;
    var h = Math.min(data.lanes.length, 6) * 34 + (foldN > 0 ? 30 : 0) + 6;
    if (expand) h = data.lanes.length * 34 + 30 + 6;
    sec.querySelector('.ds-lanes').style.height = h + 'px';
    var btn = sec.querySelector('.ds-foldbtn');
    if (btn) btn.textContent = expand ? '收起' : ('展开 +' + foldN);
  }
  function showTeam(id) {
    var secs = document.querySelectorAll('.ds-team');
    var tabs = document.querySelectorAll('.ds-tab');
    var shown = null;
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (s.getAttribute('data-team-id') === id) { s.removeAttribute('hidden'); shown = s; }
      else { s.setAttribute('hidden', ''); }
    }
    for (var j = 0; j < tabs.length; j++) {
      if (tabs[j].getAttribute('data-team') === id) tabs[j].classList.add('v2-selected');
      else tabs[j].classList.remove('v2-selected');
    }
    if (shown) {
      secs.forEach(function (s) {
        s.dsShowRel = false;
        s.dsFocus = null;
        s.dsPin = null;
        var rl = s.querySelector('.ds-reltoggle');
        if (rl) { rl.classList.remove('v2-selected'); rl.setAttribute('aria-pressed', 'false'); }
        s.querySelector('.ds-lanes').classList.remove('ds-focus');
        clearHot(s);
      });
      drawEdges(shown);
      drawAxis(shown);
      drawSwimLines(shown);
    }
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el.getAttribute) {
      if (el.classList && el.classList.contains('ds-tab')) { showTeam(el.getAttribute('data-team')); return; }
      var sec = el.closest('.ds-team');
      if (sec) {
        if (el.classList && el.classList.contains('ds-zoombtn')) {
          sec.dsZoom = el.getAttribute('data-zoom');
          var zs = sec.querySelectorAll('.ds-zoombtn');
          for (var i = 0; i < zs.length; i++) { zs[i].classList.remove('v2-selected'); }
          el.classList.add('v2-selected');
          drawAxis(sec);
          return;
        }
        if (el.classList && el.classList.contains('ds-reltoggle')) {
          sec.dsShowRel = !(sec.dsShowRel === true);
          el.setAttribute('aria-pressed', sec.dsShowRel ? 'true' : 'false');
          if (sec.dsShowRel) el.classList.add('v2-selected'); else el.classList.remove('v2-selected');
          drawSwimLines(sec);
          return;
        }
        if (el.classList && el.classList.contains('ds-foldbtn')) {
          setFold(sec, el.getAttribute('data-expanded') !== 'true');
          el.setAttribute('data-expanded', el.getAttribute('data-expanded') === 'true' ? 'false' : 'true');
          return;
        }
        if (el.classList && el.classList.contains('ds-node')) { selectTask(sec, el.getAttribute('data-task-id')); return; }
        if (el.classList && el.classList.contains('ds-bar')) { selectTask(sec, el.getAttribute('data-task-id')); return; }
        if (el.classList && el.classList.contains('ds-cluster')) {
          var ids = [];
          try { ids = JSON.parse(el.getAttribute('data-task-ids')); } catch (err) { ids = []; }
          if (ids.length > 0) selectTask(sec, ids[0]);
          return;
        }
        if (el.classList && el.classList.contains('ds-bounce')) { el.parentNode.classList.toggle('ds-open'); return; }
        var lanes = sec.querySelector('.ds-lanes');
        if (el === sec.querySelector('.ds-laneswrap') || (lanes && lanes.contains(el))) {
          sec.dsPin = null;
          unfocus(sec);
          return;
        }
      }
      el = el.parentNode;
    }
  });
  document.addEventListener('mouseover', function (ev) {
    var el = ev.target;
    var sec = el && el.closest ? el.closest('.ds-team') : null;
    if (!sec) return;
    var bar = el && el.closest ? el.closest('.ds-bar') : null;
    if (bar) { focusTask(sec, bar.getAttribute('data-task-id'), false); return; }
    var cl = el && el.closest ? el.closest('.ds-cluster') : null;
    if (cl) {
      var ids = [];
      try { ids = JSON.parse(cl.getAttribute('data-task-ids')); } catch (err) { ids = []; }
      if (ids.length > 0) focusTask(sec, ids[0], false);
    }
  });
  document.addEventListener('mouseout', function (ev) {
    var el = ev.target;
    var sec = el && el.closest ? el.closest('.ds-team') : null;
    if (!sec) return;
    var bar = el && el.closest ? el.closest('.ds-bar, .ds-cluster') : null;
    if (bar) unfocus(sec);
  });
  var resizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      var s = document.querySelector('.ds-team:not([hidden])');
      if (s) { drawEdges(s); drawSwimLines(s); }
    }, 150);
  });
  var secs = document.querySelectorAll('.ds-team');
  for (var i = 0; i < secs.length; i++) {
    (function (sec) {
      sec.depSwim = {
        selectTask: function (id) { selectTask(sec, id); },
        focusTask: function (id) { focusTask(sec, id, true); },
        unfocus: function () { sec.dsPin = null; unfocus(sec); },
        updateTask: function (id, st) { return updateTask(sec, id, st); },
        setZoom: function (z) { sec.dsZoom = z; drawAxis(sec); },
        setRel: function (on) { sec.dsShowRel = !!on; drawSwimLines(sec); },
        setFold: function (expand) { setFold(sec, expand); }
      };
    })(secs[i]);
  }
  var first = document.querySelector('.ds-team:not([hidden])');
  if (first) { drawEdges(first); drawAxis(first); drawSwimLines(first); }
})();
`;

export function renderDepSwim(opts) {
  const data = opts || {};
  const teams = Array.isArray(data.teams) ? data.teams : [];
  const models = teams.map(buildTeamModel);
  // 默认：最近活跃的非归档团队（任务/消息时间最新），其次任一有任务团队
  let best = null;
  models.forEach(function (m) {
    if (m.nodes.length === 0) return;
    if (m.archived) return;
    if (best === null || m.lastActive > best.lastActive) best = m;
  });
  if (best === null) {
    models.forEach(function (m) {
      if (m.nodes.length === 0) return;
      if (best === null || m.lastActive > best.lastActive) best = m;
    });
  }
  if (best === null && models.length > 0) best = models[0];
  const defaultId = best ? best.id : null;
  const sections = models.map(function (m) { return teamHtml(m, m.id === defaultId); }).join('');
  return '<section class="v2-root ds-root">'
    + '<style>' + DS_STYLE + '</style>'
    + '<h2 class="ds-title">任务依赖图与泳道时间线</h2>'
    + '<p class="ds-sub">泳道默认只显示时间条，跨泳道连线默认关闭（点"显示关系"开启）；hover 或点选任务条聚焦上游/下游（最多 4 条）；点击上方依赖图节点在下方泳道定位同一条任务。</p>'
    + '<nav class="ds-tabs">' + tabsHtml(models, defaultId) + '</nav>'
    + sections
    + '<script>' + DS_SCRIPT + '</script>'
    + '</section>';
}
