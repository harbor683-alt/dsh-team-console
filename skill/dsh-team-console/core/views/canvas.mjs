/* 流氏工作台 · 画布首页
 * 底层一整张画布 = 智能体团队关系图（/team?canvas=1 全幅嵌入）
 * 左上角三枚小方块：驾驶舱 / 项目书与任务 / 团队架构，点开浮层看详情
 * 底部可折叠抽屉：依赖泳道（点小箭头折起/展开）
 * 视觉：DeepSeek 官网语言——近白底、#4d6bfe 单色强调、细边、16px 圆角、极轻阴影
 */

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  cockpit: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15.5V9.5M8 15.5V4.5M13 15.5V7.5M18 15.5V11.5"/></svg>',
  book: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3.5h7.5L16 8v8.5H4z"/><path d="M11.5 3.5V8H16"/><path d="M7 11.5h5"/></svg>',
  team: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7.5" y="2.5" width="5" height="4" rx="1.2"/><rect x="2" y="13.5" width="5" height="4" rx="1.2"/><rect x="13" y="13.5" width="5" height="4" rx="1.2"/><path d="M10 6.5v3.5M4.5 13.5v-3.5h11v3.5"/></svg>',
  ask: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 4.5h13v9h-6.5L6 17v-3.5H3.5z"/><path d="M8 8.5h.01M12 8.5h.01"/></svg>',
  deps: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5h7M7 14.5h10"/><circle cx="12" cy="5.5" r="1.8"/><circle cx="5" cy="14.5" r="1.8"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5 8 10.5l4-4"/></svg>',
  external: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3.5H12.5V6.5"/><path d="M12.5 3.5 7.5 8.5"/><path d="M12.5 9.5v3h-9v-9h3"/></svg>',
};

export function renderCanvas(opts) {
  const o = opts || {};
  const ws = o.ws || {};
  const qs = o.qs || '';
  const sep = qs.includes('?') ? '&' : '?';
  const url = (p, extra) => p + qs + sep + (extra || 'embed=1');
  const wsName = esc(ws.title || ws.id || 'deepseek');
  const wsPath = esc(ws.path || '');
  const tasks = Number(o.taskCount || 0);
  const members = Number(o.memberCount || 0);
  const projects = Number(o.projectCount || 0);
  const teams = (o.teams || []).filter((t) => t && !t.archived);
  const team = teams.find((t) => t.id === o.team) || teams[0] || null;
  const teamBase = url('/team', 'embed=1&canvas=1') + (team ? '&team=' + encodeURIComponent(team.id) : '');
  const teamName = team ? esc(team.name) : '';

  // 底部抽屉、左侧方块、浮层
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>流氏工作台 · ' + wsName + '</title>'
    + '<style>' + CSS + '</style>'
    + '</head><body class="cw">'
    + '<div class="cw__stage">'
    + '<iframe class="cw__canvas" id="cw-canvas" src="' + esc(teamBase) + '" data-base="' + esc(url('/team', 'embed=1&canvas=1')) + '" title="智能体团队关系图" loading="eager"></iframe>'
    + '</div>'

    + (team ? '<div class="cw__team" id="cw-team" data-current="' + esc(team.id) + '">'
      + '<button type="button" class="cw__team-btn" id="cw-team-btn" aria-haspopup="listbox" aria-expanded="false">'
      + '<span class="cw__team-dot" aria-hidden="true"></span>'
      + '<span class="cw__team-name" id="cw-team-name">' + teamName + '</span>'
      + '<span class="cw__team-car" aria-hidden="true">'
      + '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 8 10.5l4-4"/></svg>'
      + '</span>'
      + '</button>'
      + '<div class="cw__team-menu" id="cw-team-menu" role="listbox" aria-label="切换团队" hidden>'
      + teams.map((t) => '<button type="button" class="cw__team-item' + (t.id === team.id ? ' is-on' : '') + '"'
        + ' role="option" aria-selected="' + (t.id === team.id ? 'true' : 'false') + '"'
        + ' data-team="' + esc(t.id) + '" data-name="' + esc(t.name) + '">'
        + '<span class="cw__team-ic" aria-hidden="true"></span>'
        + '<span class="cw__team-tx">' + esc(t.name) + '</span>'
        + '<span class="cw__team-cnt">' + ((t.members || []).length) + ' 人</span>'
        + '</button>').join('')
      + '</div></div>' : '')

    + '<header class="cw__top">'
    + '<a class="cw__brand" href="' + esc('/' + qs) + '" aria-label="流氏工作台首页">'
    + '<span class="cw__mark" aria-hidden="true"><i></i><i></i><i></i></span>'
    + '<span class="cw__name">流氏工作台</span>'
    + '</a>'
    + '<span class="cw__dot" aria-hidden="true"></span>'
    + '<span class="cw__ws"><b>' + wsName + '</b><span class="cw__path">' + wsPath + '</span></span>'
    + '<span class="cw__stat">' + members + ' 名成员 · ' + tasks + ' 项任务 · ' + projects + ' 份项目书</span>'
    + '<span class="cw__top-actions">'
    + '<a class="cw__link" href="' + esc('/spaces' + qs) + '">全部工作区</a>'
    + '<a class="cw__cta" href="' + esc('/kanban' + qs) + '">新建任务</a>'
    + '</span>'
    + '</header>'

    + '<nav class="cw__rail" aria-label="工作台视图">'
    + tile('驾驶舱', 'cockpit', url('/cockpit'), '/cockpit' + qs, '队伍在岗、指标与待办')
    + tile('项目书', 'book', url('/projects'), '/projects' + qs, '书架 + 全文阅读')
    + tile('拷问台', 'ask', url('/grill'), '/grill' + qs, '每轮只问前沿，答完生成项目卡')
    + tile('团队架构', 'team', url('/team'), '/team' + qs, '完整团队视图与布局切换')
    + '</nav>'

    + '<section class="cw__drawer" id="cw-drawer" data-open="false">'
    + '<button type="button" class="cw__drawer-bar" id="cw-drawer-bar" aria-expanded="false" aria-controls="cw-drawer-body">'
    + '<span class="cw__drawer-ic" aria-hidden="true">' + ICON.deps + '</span>'
    + '<span class="cw__drawer-title">依赖泳道</span>'
    + '<span class="cw__drawer-meta">图与泳道时间线 · ' + tasks + ' 项任务</span>'
    + '<span class="cw__drawer-arrow" aria-hidden="true">' + ICON.arrow + '</span>'
    + '</button>'
    + '<div class="cw__drawer-body" id="cw-drawer-body">'
    + '<iframe data-src="' + esc(url('/deps', 'embed=1&drawer=1')) + '" title="依赖泳道" loading="lazy"></iframe>'
    + '</div>'
    + '</section>'

    + '<div class="cw__modal" id="cw-modal" hidden>'
    + '<div class="cw__sheet" role="dialog" aria-modal="true" aria-labelledby="cw-sheet-title">'
    + '<header class="cw__sheet-head">'
    + '<span class="cw__sheet-title" id="cw-sheet-title"></span>'
    + '<a class="cw__sheet-open" id="cw-sheet-open" href="#" target="_blank" rel="noopener">独立打开 ' + ICON.external + '</a>'
    + '<button type="button" class="cw__sheet-close" id="cw-sheet-close" aria-label="关闭">'
    + '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
    + '</button>'
    + '</header>'
    + '<div class="cw__sheet-body"><iframe id="cw-sheet-frame" title="详情"></iframe></div>'
    + '</div>'
    + '</div>'

    + '<script>' + SCRIPT + '</script>'
    + '</body></html>';
}

function tile(label, icon, src, href, hint) {
  return '<button type="button" class="cw__tile" data-title="' + esc(label) + '"'
    + ' data-src="' + esc(src) + '" data-href="' + esc(href) + '" title="' + esc(hint) + '">'
    + '<span class="cw__tile-ic" aria-hidden="true">' + ICON[icon] + '</span>'
    + '<span class="cw__tile-tx">' + esc(label) + '</span>'
    + '</button>';
}

const CSS = `
:root{
  --cw-bg:#f7f9fc;--cw-card:#ffffff;--cw-ink:#16181d;--cw-body:#3d4149;--cw-muted:#7a808a;
  --cw-line:rgba(22,24,29,.08);--cw-line-2:rgba(22,24,29,.14);
  --cw-accent:#4d6bfe;--cw-accent-ink:#3b57e0;--cw-soft:#eef2ff;
  --cw-shadow-1:0 1px 2px rgba(22,24,29,.04);
  --cw-shadow-2:0 10px 30px rgba(22,24,29,.10);
  --cw-shadow-3:0 24px 64px rgba(22,24,29,.20);
}
*{box-sizing:border-box}
html,body{height:100%}
body.cw{margin:0;background:var(--cw-bg);color:var(--cw-body);
  font:14px/1.55 -apple-system,"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;overflow:hidden}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit}
::selection{background:#dbe4ff;color:var(--cw-ink)}

/* ---------- 画布层 ---------- */
.cw__stage{position:absolute;inset:0;background:
  radial-gradient(circle at 1px 1px,rgba(22,24,29,.075) 1px,transparent 0) 0 0/24px 24px,
  linear-gradient(180deg,#fbfcfe 0%,#f6f8fc 100%)}
.cw__canvas{display:block;width:100%;height:100%;border:0;background:transparent}

/* ---------- 顶栏 ---------- */
.cw__top{position:absolute;top:0;left:0;right:0;height:52px;z-index:20;display:flex;align-items:center;gap:10px;
  padding:0 16px;background:rgba(255,255,255,.78);backdrop-filter:blur(14px) saturate(1.2);
  -webkit-backdrop-filter:blur(14px) saturate(1.2);border-bottom:1px solid var(--cw-line)}
.cw__brand{display:inline-flex;align-items:center;gap:8px;min-width:0;flex:none}
.cw__mark{display:inline-flex;align-items:flex-end;gap:2px;width:22px;height:22px;padding:4px;
  background:var(--cw-ink);border-radius:7px}
.cw__mark i{display:block;width:3px;border-radius:1.5px;background:#fff}
.cw__mark i:nth-child(1){height:7px;opacity:.55}
.cw__mark i:nth-child(2){height:13px}
.cw__mark i:nth-child(3){height:9px;opacity:.8}
.cw__name{font-size:13.5px;font-weight:650;letter-spacing:.2px;color:var(--cw-ink);white-space:nowrap}
.cw__dot{width:1px;height:14px;background:var(--cw-line-2);flex:none}
.cw__ws{display:inline-flex;align-items:baseline;gap:8px;min-width:0;font-size:12.5px;color:var(--cw-muted)}
.cw__ws b{color:var(--cw-ink);font-weight:600}
.cw__path{max-width:30ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-variant-numeric:tabular-nums;color:var(--cw-muted);opacity:.9}
.cw__stat{font-size:12px;color:var(--cw-muted);white-space:nowrap;padding-left:4px}
.cw__top-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}
.cw__link{font-size:12.5px;color:var(--cw-muted);padding:6px 8px;border-radius:8px}
.cw__link:hover{color:var(--cw-accent-ink);background:var(--cw-soft)}
.cw__cta{font-size:12.5px;font-weight:600;color:var(--cw-accent-ink);background:var(--cw-soft);
  border:1px solid rgba(77,107,254,.18);padding:6px 12px;border-radius:9px;white-space:nowrap;
  transition:background .15s ease,border-color .15s ease,transform .15s ease}
.cw__cta:hover{background:#e4ebff;border-color:rgba(77,107,254,.32);transform:translateY(-1px)}

/* ---------- 左上角方块 ---------- */
.cw__rail{position:absolute;left:14px;top:66px;z-index:15;display:flex;flex-direction:column;gap:6px}
.cw__tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  width:62px;padding:9px 4px 7px;background:rgba(255,255,255,.92);border:1px solid var(--cw-line);
  border-radius:14px;box-shadow:var(--cw-shadow-1);cursor:pointer;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease,color .16s ease}
.cw__tile-ic{display:inline-flex;color:#4a4f59}
.cw__tile-tx{font-size:10.5px;line-height:1.25;color:var(--cw-muted);text-align:center;letter-spacing:.1px}
.cw__tile:hover{border-color:rgba(77,107,254,.35);box-shadow:0 6px 18px rgba(77,107,254,.14);transform:translateY(-1px)}
.cw__tile:hover .cw__tile-ic{color:var(--cw-accent)}
.cw__tile:hover .cw__tile-tx{color:var(--cw-accent-ink)}
.cw__tile:active{transform:translateY(0)}
.cw__tile:focus-visible{outline:2px solid var(--cw-accent);outline-offset:2px}

/* ---------- 团队切换 chip ---------- */
.cw__team{position:absolute;left:86px;top:64px;z-index:16}
.cw__team-btn{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 9px 0 10px;
  background:rgba(255,255,255,.9);border:1px solid var(--cw-line);border-radius:999px;
  box-shadow:var(--cw-shadow-1);cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  transition:border-color .15s ease,box-shadow .15s ease}
.cw__team-btn:hover{border-color:rgba(77,107,254,.32);box-shadow:0 4px 14px rgba(77,107,254,.12)}
.cw__team-dot{width:6px;height:6px;border-radius:50%;background:var(--cw-accent);flex:none}
.cw__team-name{font-size:12px;font-weight:600;color:var(--cw-ink);letter-spacing:.2px;max-width:24ch;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cw__team-car{display:inline-flex;color:var(--cw-muted);transition:transform .2s cubic-bezier(.2,.8,.2,1)}
.cw__team[data-open="true"] .cw__team-car{transform:rotate(180deg)}
.cw__team-menu{position:absolute;left:0;top:38px;min-width:230px;max-height:min(60vh,420px);overflow:auto;
  padding:6px;background:#fff;border:1px solid var(--cw-line);border-radius:12px;box-shadow:var(--cw-shadow-2);
  animation:cw-rise .16s ease}
.cw__team-menu[hidden]{display:none!important}
.cw__team-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:8px;
  background:transparent;cursor:pointer;text-align:left}
.cw__team-item:hover{background:var(--cw-soft)}
.cw__team-item.is-on{background:#f1f4ff}
.cw__team-ic{width:6px;height:6px;border-radius:50%;background:#cfd4dd;flex:none}
.cw__team-item.is-on .cw__team-ic{background:var(--cw-accent)}
.cw__team-tx{font-size:12.5px;color:var(--cw-ink)}
.cw__team-cnt{margin-left:auto;font-size:11px;color:var(--cw-muted);font-variant-numeric:tabular-nums}

/* ---------- 底部抽屉 ---------- */
.cw__drawer{position:absolute;left:0;right:0;bottom:0;z-index:25;background:var(--cw-card);
  border-top:1px solid var(--cw-line);box-shadow:0 -10px 30px rgba(22,24,29,.07);
  border-radius:16px 16px 0 0;overflow:hidden}
.cw__drawer-bar{display:flex;align-items:center;gap:10px;width:100%;height:46px;padding:0 16px;
  background:transparent;border:0;cursor:pointer;text-align:left}
.cw__drawer-bar:hover{background:#fafbff}
.cw__drawer-ic{display:inline-flex;color:#4a4f59}
.cw__drawer-title{font-size:12.5px;font-weight:650;color:var(--cw-ink);letter-spacing:.2px}
.cw__drawer-meta{font-size:11.5px;color:var(--cw-muted);white-space:nowrap}
.cw__drawer-arrow{margin-left:auto;display:inline-flex;color:var(--cw-muted);
  transition:transform .22s cubic-bezier(.2,.8,.2,1)}
.cw__drawer[data-open="true"] .cw__drawer-arrow{transform:rotate(180deg)}
.cw__drawer-body{height:0;overflow:hidden;transition:height .26s cubic-bezier(.2,.8,.2,1);
  border-top:1px solid transparent}
.cw__drawer[data-open="true"] .cw__drawer-body{border-top-color:var(--cw-line)}
.cw__drawer-body iframe{display:block;width:100%;height:100%;border:0;background:#fff}

/* ---------- 详情浮层 ---------- */
.cw__modal{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:28px;background:rgba(16,18,24,.34);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.cw__modal[hidden]{display:none!important}
.cw__sheet{display:flex;flex-direction:column;width:min(1120px,100%);height:min(84vh,820px);
  background:var(--cw-card);border:1px solid var(--cw-line);border-radius:16px;overflow:hidden;
  box-shadow:var(--cw-shadow-3);animation:cw-rise .22s cubic-bezier(.2,.8,.2,1)}
@keyframes cw-rise{from{opacity:0;transform:translateY(10px) scale(.995)}to{opacity:1;transform:none}}
.cw__sheet-head{display:flex;align-items:center;gap:10px;height:48px;padding:0 10px 0 16px;
  border-bottom:1px solid var(--cw-line);background:#fff}
.cw__sheet-title{font-size:13px;font-weight:650;color:var(--cw-ink);letter-spacing:.2px}
.cw__sheet-open{display:inline-flex;align-items:center;gap:4px;margin-left:auto;font-size:12px;
  color:var(--cw-muted);padding:5px 8px;border-radius:7px}
.cw__sheet-open:hover{color:var(--cw-accent-ink);background:var(--cw-soft)}
.cw__sheet-close{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
  border:0;border-radius:8px;background:transparent;color:var(--cw-muted);cursor:pointer}
.cw__sheet-close:hover{background:#f1f3f7;color:var(--cw-ink)}
.cw__sheet-body{flex:1;min-height:0;background:#fff}
.cw__sheet-body iframe{display:block;width:100%;height:100%;border:0;background:#fff}

@media (max-width:900px){
  .cw__stat,.cw__path{display:none}
  .cw__ws{max-width:14ch}
  .cw__ws b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
@media (max-width:720px){
  .cw__top{height:48px;padding:0 12px;gap:8px}
  .cw__rail{left:10px;top:58px;flex-direction:row;gap:6px}
  .cw__tile{width:54px;padding:7px 3px 6px;border-radius:12px}
  .cw__tile-tx{font-size:10px}
  .cw__modal{padding:0}
  .cw__sheet{width:100%;height:100%;border-radius:0;border:0}
  .cw__drawer{border-radius:12px 12px 0 0}
}
@media (prefers-reduced-motion:reduce){
  .cw__tile,.cw__cta,.cw__drawer-arrow,.cw__drawer-body{transition:none!important}
  .cw__sheet{animation:none}
}
`;

const SCRIPT = `
(function () {
  'use strict';
  var drawer = document.getElementById('cw-drawer');
  var bar = document.getElementById('cw-drawer-bar');
  var body = document.getElementById('cw-drawer-body');
  var dFrame = drawer ? drawer.querySelector('iframe') : null;

  function drawerHeight() {
    return Math.round(Math.min(window.innerHeight * 0.52, 520));
  }
  function setDrawer(open, remember) {
    if (!drawer || !bar || !body) return;
    drawer.setAttribute('data-open', open ? 'true' : 'false');
    bar.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && dFrame && !dFrame.getAttribute('src')) {
      dFrame.setAttribute('src', dFrame.getAttribute('data-src') || '');
    }
    body.style.height = open ? drawerHeight() + 'px' : '0px';
    if (remember) {
      try { localStorage.setItem('cw-drawer', open ? '1' : '0'); } catch (e) {}
    }
  }
  if (bar) {
    bar.addEventListener('click', function () {
      setDrawer(drawer.getAttribute('data-open') !== 'true', true);
    });
    var remembered = '0';
    try { remembered = localStorage.getItem('cw-drawer') || '0'; } catch (e) {}
    setDrawer(remembered === '1', false);
    window.addEventListener('resize', function () {
      if (drawer.getAttribute('data-open') === 'true') setDrawer(true, false);
    });
  }

  var modal = document.getElementById('cw-modal');
  var frame = document.getElementById('cw-sheet-frame');
  var title = document.getElementById('cw-sheet-title');
  var openLink = document.getElementById('cw-sheet-open');
  var closeBtn = document.getElementById('cw-sheet-close');
  var lastFocus = null;

  function openView(btn) {
    if (!modal || !frame) return;
    lastFocus = document.activeElement;
    title.textContent = btn.getAttribute('data-title') || '';
    var src = btn.getAttribute('data-src') || '';
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    openLink.setAttribute('href', btn.getAttribute('data-href') || '#');
    modal.hidden = false;
    document.body.classList.add('cw-lock');
    if (closeBtn) closeBtn.focus();
  }
  function closeView() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('cw-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.cw__tile'), function (btn) {
    btn.addEventListener('click', function () { openView(btn); });
  });
  if (closeBtn) closeBtn.addEventListener('click', closeView);
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeView(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeView(); closeTeamMenu(); }
  });

  /* ---------- 团队切换 ---------- */
  var teamBox = document.getElementById('cw-team');
  var teamBtn = document.getElementById('cw-team-btn');
  var teamMenu = document.getElementById('cw-team-menu');
  var teamName = document.getElementById('cw-team-name');
  var canvasFrame = document.getElementById('cw-canvas');

  function closeTeamMenu() {
    if (!teamBox || !teamMenu) return;
    teamMenu.hidden = true;
    teamBox.setAttribute('data-open', 'false');
    if (teamBtn) teamBtn.setAttribute('aria-expanded', 'false');
  }
  function openTeamMenu() {
    if (!teamBox || !teamMenu) return;
    teamMenu.hidden = false;
    teamBox.setAttribute('data-open', 'true');
    if (teamBtn) teamBtn.setAttribute('aria-expanded', 'true');
  }
  function pickTeam(item, remember) {
    if (!item) return;
    var id = item.getAttribute('data-team');
    var name = item.getAttribute('data-name') || '';
    var base = canvasFrame ? canvasFrame.getAttribute('data-base') || '' : '';
    if (canvasFrame && id) canvasFrame.setAttribute('src', base + '&team=' + encodeURIComponent(id));
    if (teamName) teamName.textContent = name;
    if (teamBox) teamBox.setAttribute('data-current', id);
    Array.prototype.forEach.call(teamMenu.querySelectorAll('.cw__team-item'), function (el) {
      var on = el === item;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (remember) { try { localStorage.setItem('cw-team', id); } catch (e) {} }
    closeTeamMenu();
  }
  if (teamBtn && teamMenu) {
    teamBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (teamMenu.hidden) openTeamMenu(); else closeTeamMenu();
    });
    Array.prototype.forEach.call(teamMenu.querySelectorAll('.cw__team-item'), function (item) {
      item.addEventListener('click', function (e) { e.stopPropagation(); pickTeam(item, true); });
    });
    document.addEventListener('click', function (e) {
      if (teamBox && !teamBox.contains(e.target)) closeTeamMenu();
    });
    var savedTeam = '';
    try { savedTeam = localStorage.getItem('cw-team') || ''; } catch (e) {}
    if (savedTeam && teamBox && savedTeam !== teamBox.getAttribute('data-current')) {
      var savedItem = teamMenu.querySelector('.cw__team-item[data-team="' + savedTeam + '"]');
      if (savedItem) pickTeam(savedItem, false);
    }
  }
})();
`;
