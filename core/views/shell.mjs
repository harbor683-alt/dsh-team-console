/* 单页工作台壳（framed-sheet）
 * 设计依据：taste-skill app-screen run 的 framed-sheet sheet（seed 1361369707）
 * 结构：chrome 顶栏(48) → 白 sheet（1px 上规则线、无阴影）→ 内容列 1200 居中 → 下划线 tabs → 四段 iframe
 * 颜色预算：只给数据（状态点/状态条/进度），外壳按钮与选中态用墨色与中性灰。
 */

const esc2 = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 嵌入 iframe 的视图统一设计覆盖：扁平面、指标托盘、字号收敛到 24/18/14/13/12 */
export function embedCss() {
  return '<style>'
    + '.v2-nav{display:none!important}'
    + '.v2-page{max-width:none!important;padding:0!important}'
    + '.cockpit-head{display:none!important}'
    + '.v2-page>h1,.v2-page>.v2-sub{display:none!important}'
    + '.ta-view__title{display:none!important}'
    + '.ds-title{display:none!important}'
    + 'html,body{background:#fff!important}'
    + 'body{font-family:-apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif!important;'
    + 'font-size:14px!important;line-height:1.6!important;color:#353638!important}'
    + '.v2-section__title{font-size:14px!important;font-weight:600!important;letter-spacing:0!important;'
    + 'color:#353638!important;margin:0 0 10px!important;padding:0!important;border:0!important}'
    + '.cockpit-card,.v2-card,.ta-card,.ds-node,[class*="v2-kb__card"]{box-shadow:none!important;'
    + 'border:1px solid rgba(0,0,0,.08)!important;border-radius:10px!important;background:#fff!important}'
    + '.metrics{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;'
    + 'background:#fafafa!important;border:1px solid rgba(0,0,0,.08)!important;border-radius:10px!important;'
    + 'overflow:hidden!important;gap:0!important}'
    + '.metrics>.cockpit-card{border:0!important;border-right:1px solid rgba(0,0,0,.06)!important;'
    + 'border-radius:0!important;background:transparent!important;padding:12px 14px!important;box-shadow:none!important}'
    + '.metrics>.cockpit-card:last-child{border-right:0!important}'
    + '.v2-metric{display:block!important}'
    + '.v2-metric__label{display:block!important;font-size:13px!important;font-weight:400!important;'
    + 'color:#61666b!important;margin:0 0 4px!important}'
    + '.v2-metric__value{display:block!important;font-size:26px!important;font-weight:400!important;'
    + 'line-height:1.1!important;letter-spacing:-.2px!important;color:#0f1115!important;font-variant-numeric:tabular-nums}'
    + '.metric-note{font-size:12px!important;color:#61666b!important;margin-top:6px!important;line-height:1.5!important}'
    + '.todo-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important}'
    + '.todo-col-title{font-size:13px!important;font-weight:600!important;color:#61666b!important;margin:0 0 8px!important}'
    + '.cockpit-empty{display:block!important;width:100%!important;border:1px solid rgba(0,0,0,.08)!important;border-radius:10px!important;'
    + 'background:#fafafa!important;color:#61666b!important;font-size:13px!important;line-height:1.6!important;'
    + 'padding:14px 16px!important;white-space:normal!important;overflow-wrap:anywhere!important}'
    + '.v2-tag{font-size:12px!important;border-radius:999px!important}'
    /* 角色小方块：12×12 圆角 3，颜色即状态 */
    + '.v2-statusbar__cell{width:12px!important;min-width:12px!important;height:12px!important;'
    + 'align-self:center!important;border-radius:3px!important}'
    + '.v2-statusbar{align-items:center!important;gap:6px!important;flex-wrap:wrap!important}'
    + '.v2-statusbar .v2-hoverable{display:inline-flex!important;align-items:center!important}'
    + '.v2-legend{font-size:12px!important;color:#61666b!important}'
    + '.v2-btn,.v2-btn--primary{font-size:13px!important;height:32px!important;border-radius:8px!important}'
    + '.ta-view__hint,.ds-hint{font-size:13px!important;color:#61666b!important}'
    /* 动态流里的事件类型标签降为中性，颜色只留给状态点 */
    + '.stream .v2-tag{background:#f1f3f5!important;border-color:transparent!important;color:#61666b!important}'
    + '.stream{font-size:13px!important}'
    + '.stream .v2-item{padding:9px 8px!important;border-bottom:1px solid rgba(0,0,0,.06)!important;'
    + 'border-radius:6px!important}'
    + '.stream .v2-item:hover{background:#fafafa!important}'
    /* 段与段之间的呼吸：驾驶舱内部的四个区 */
    + '.cockpit-zone+.cockpit-zone{margin-top:22px!important}'
    + '.ta-card{border-radius:12px!important;padding:14px 16px!important}'
    + '.ds-node{border-radius:10px!important}'
    + '@media (max-width:900px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}'
    + '.metrics>.cockpit-card:last-child:nth-child(odd){grid-column:1/-1!important}'
    + '.todo-grid{grid-template-columns:1fr!important}}'
    + '@media (max-width:560px){.metrics{grid-template-columns:1fr!important}'
    + '.metrics>.cockpit-card{border-right:0!important;border-bottom:1px solid rgba(0,0,0,.06)!important}'
    + '.metrics>.cockpit-card:last-child{border-bottom:0!important}}'
    + '</style>';
}

/* stage 页面嵌入时：隐藏 ② 团队 / ③ 时间轨（由 team-arch、dep-swim 代替）与缩放控件 */
export function stageEmbedCss() {
  return '<style>'
    + '[data-sec="team"],[data-sec="timeline"],.zctl{display:none!important}'
    + 'header>.wsbar,header>h1,header>.sub{display:none!important}'
    + 'header{display:none!important}'
    + 'html,body{background:#fff!important}'
    + 'body{padding-bottom:0!important;padding-top:0!important}'
    + '.toolbar .hint{display:none!important}'
    /* 项目书书架：按内容宽度收窄，别拉满画布 */
    + '.projbar{width:fit-content!important;max-width:100%!important;padding:10px 12px!important}'
    + '.book{height:124px!important}'
    + '.btn.primary{height:32px!important;border-radius:8px!important;font-size:13px!important}'
    + '.book{box-shadow:none!important}'
    + '</style>';
}

const NAV = [
  ['sec-cockpit', '驾驶舱', '队伍在岗、五项指标、待办与动态流'],
  ['sec-stage', '项目书与任务', '项目书书脊 + 任务挂绳（左长期 / 右归档）'],
  ['sec-team', '团队架构', '真人 → 主控 → 执行层，军师与知识库在主控上下'],
  ['sec-deps', '依赖泳道', '任务依赖图 + 按角色的时间泳道'],
];

/* 状态脊：外壳里唯一一件"只有这个产品才有"的东西——按状态比例着色的一条竖脊 */
function spineHtml(counts) {
  const order = [
    ['running', '执行中', '--run'],
    ['done', '已完成', '--done'],
    ['error', '异常', '--bad'],
    ['decision', '待决策', '--warn'],
    ['idle', '空闲', '--idle'],
  ];
  const total = order.reduce((s, [k]) => s + (counts[k] || 0), 0) || 1;
  const segs = order.map(([k, label, cls]) => {
    const n = counts[k] || 0;
    const pct = Math.max(n ? 3 : 0, Math.round((n / total) * 100));
    return n ? '<i class="spine__seg spine__seg--' + k + '" style="flex:' + n + '" title="' + label + ' ' + n + '"></i>' : '';
  }).join('');
  const summary = order.map(([k, label]) => label + ' ' + (counts[k] || 0)).join(' · ');
  return '<span class="spine" title="' + summary + '">' + segs + '</span>';
}

const ICONS = {"sec-cockpit":"<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M8 8l3-2.4\"/></svg>","sec-stage":"<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M3.5 2.5h6l3 3v8h-9z\"/><path d=\"M9.5 2.5v3h3\"/><path d=\"M5.5 9h5\"/></svg>","sec-team":"<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><rect x=\"6\" y=\"1.8\" width=\"4\" height=\"3\" rx=\"1\"/><rect x=\"1.6\" y=\"11\" width=\"4\" height=\"3\" rx=\"1\"/><rect x=\"10.4\" y=\"11\" width=\"4\" height=\"3\" rx=\"1\"/><path d=\"M8 4.8v3.4M4 11V9.6h8V11\"/></svg>","sec-deps":"<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M2 4.5h6M6 11.5h8\"/><circle cx=\"9\" cy=\"4.5\" r=\"1.4\"/><circle cx=\"5\" cy=\"11.5\" r=\"1.4\"/></svg>"};

export function renderShell({ ws, spaces = [], qs = '', demo = false, counts = {}, taskCount = 0 }) {
  const wsq = qs || ('?ws=' + encodeURIComponent(ws.id || ws.path || ''));
  const members = ['running', 'done', 'error', 'decision', 'idle', 'archived']
    .reduce((s, k) => s + (counts[k] || 0), 0);
  const metaLine = (members ? members + ' 名成员' : '暂无团队角色')
    + ' · ' + (taskCount || 0) + ' 项任务'
    + (demo ? ' · 演示数据' : '');
  const sep = wsq.includes('?') ? '&' : '?';
  const embed = (p) => esc2(p + wsq + sep + 'embed=1');
  const standalone = (p) => esc2(p + wsq);
  const others = spaces.filter((s) => (s.id || s.path) !== (ws.id || ws.path)).slice(0, 3);
  const wsName = esc2(ws.title || ws.id || '');

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>工作台 · ' + wsName + '</title>'
    + '<style>'
    + ':root{--ink:#0f1115;--body:#353638;--muted:#61666b;--rule:rgba(0,0,0,.08);'
    + '--rule-strong:rgba(0,0,0,.16);--chrome:#f5f7fa;--sheet:#fff;--tray:#fafafa;'
    + '--run:#4176e6;--done:#22c55e;--bad:#ef4444;--warn:#f59e0b;--idle:#979da6;--accent:#4e6ef2;--accent-strong:#3b5bdb}'
    + '*{box-sizing:border-box}'
    + 'html,body{margin:0;background:var(--chrome);color:var(--body);'
    + 'font:14px/1.6 -apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif;'
    + '-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}'
    + 'a{color:inherit}'
    /* 顶栏：48px，落在 chrome 上，没有分隔线 */
    + '.top{height:48px;display:flex;align-items:center;background:var(--chrome)}'
    + '.top__in{width:100%;max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:12px}'
    + '.brand{display:inline-flex;align-items:center;gap:8px;font-weight:600;color:var(--ink);font-size:14px;text-decoration:none}'
    + '.brand svg{display:block}'
    + '.dot{width:1px;height:16px;background:var(--rule-strong)}'
    + '.wswrap{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);min-width:0}'
    + '.wswrap b{color:var(--ink);font-weight:600}'
    + '.wswrap .path{max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.wswrap a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent}'
    + '.wswrap a:hover{color:var(--accent-strong);border-bottom-color:var(--accent)}'
    + '.spine{display:inline-flex;align-items:center;gap:3px;height:8px;width:132px;margin-left:8px}'
    + '.spine__seg{height:8px;border-radius:3px;min-width:7px;transition:opacity .12s ease}'
    + '.spine:hover .spine__seg{opacity:.75}'
    + '.spine__seg--running{background:var(--run)}.spine__seg--done{background:var(--done)}'
    + '.spine__seg--error{background:var(--bad)}.spine__seg--decision{background:var(--warn)}'
    + '.spine__seg--idle{background:var(--idle)}'
    + '.top__right{margin-left:auto;display:flex;align-items:center;gap:8px}'
    + '.btn{height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--rule-strong);'
    + 'background:#fff;color:var(--ink);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}'
    + '.btn:hover{background:var(--tray)}'
    + '.btn--primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn--primary:hover{background:var(--accent-strong);border-color:var(--accent-strong)}'
    + '.btn--primary:hover{background:#2c2c2e}'
    + '.quiet{font-size:13px;color:var(--muted);text-decoration:none;padding:6px 8px;border-radius:8px}'
    + '.quiet:hover{background:#eef1fb;color:var(--accent-strong)}'
    /* 白 sheet：flush L 形，仅一条 1px 上规则线；无阴影 */
    + '.sheet{background:var(--sheet);border-top:1px solid var(--rule);min-height:calc(100vh - 48px)}'
    + '.wrap{max-width:1200px;margin:0 auto;padding:24px}'
    + '.head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}'
    + 'h1{font-size:26px;line-height:1.2;font-weight:650;letter-spacing:-.3px;margin:0;color:var(--ink)}'
    + '.meta{margin:0;font-size:14px;color:var(--muted)}'
    + '.head__right{margin-left:auto;display:flex;gap:8px;align-items:center}'
    /* 下划线 tabs：整宽 1px 规则线，指示条 2px 与标签同宽 */
    + '.tabs{display:flex;gap:28px;margin:14px 0 0;border-bottom:1px solid var(--rule);position:sticky;top:0;'
    + 'background:var(--sheet);z-index:5}'
    + '.tabs a{position:relative;font-size:14px;color:var(--muted);text-decoration:none;padding:10px 0 9px;'
    + 'border-bottom:2px solid transparent;margin-bottom:-1px}'
    + '.tabs a:hover{color:var(--ink)}'
    + '.tabs a.is-on{color:var(--ink);border-bottom-color:var(--ink)}'
    + /* 段：44px 间距、18/500 标题 + 右侧安静动作 */
    '.sec{margin:44px 0 0;scroll-margin-top:64px}'
    + '.sec__head{display:flex;align-items:baseline;gap:12px;margin:0 0 4px}'
    + 'h2{display:flex;align-items:center;gap:8px;font-size:19px;font-weight:600;line-height:1.4;margin:0;color:var(--ink)}h2 svg{flex:0 0 auto;color:var(--ink);opacity:.85}'
    + '.sec__link{margin-left:auto;font-size:13px;color:var(--muted);text-decoration:none;white-space:nowrap}'
    + '.sec__link:hover{color:var(--accent-strong);text-decoration:underline}'
    + '.sec__lead{margin:0 0 14px;font-size:14px;color:var(--muted)}'
    + '.sec>iframe{display:block;width:100%;height:0;border:0;background:transparent}'
    /* 段之间一条发丝线，长页面才有节奏 */
    + '.sec+.sec{border-top:1px solid var(--rule);margin-top:36px;padding-top:32px}'
    + '::selection{background:#d3e2ff;color:var(--ink)}'
    + 'a:focus-visible,button:focus-visible,.tabs a:focus-visible{outline:2px solid var(--ink);'
    + 'outline-offset:2px;border-radius:6px}'
    + 'html{scroll-behavior:smooth}'
    + '@media (max-width:900px){.wrap{padding:16px}h1{font-size:20px}'
    + '.brand__t,.wswrap .path,.wswrap>span:first-of-type{display:none}'
    + '.wswrap b{max-width:12ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.top__in{padding:0 16px;gap:8px}.spine{display:none}.tabs{gap:18px;overflow-x:auto}}'
    + '</style></head><body>'
    /* 顶栏 */
    + '<header class="top"><div class="top__in">'
    + '<a class="brand" href="/' + esc2(wsq) + '">'
    + '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">'
    + '<rect x="1.5" y="1.5" width="15" height="15" rx="4" fill="none" stroke="#0f1115" stroke-width="1.5"/>'
    + '<rect x="5" y="5" width="3" height="8" rx="1" fill="#0f1115"/>'
    + '<rect x="10" y="5" width="3" height="4.5" rx="1" fill="#0f1115" opacity=".45"/>'
    + '</svg><span class="brand__t">团队控制台</span></a>'
    + '<span class="dot"></span>'
    + '<div class="wswrap"><span>工作区</span><b>' + wsName + '</b>'
    + '<span class="path">' + esc2(ws.path || '') + '</span>'
    + (others.length ? '<span>·</span><a href="/?ws=' + encodeURIComponent(others[0].id || others[0].path) + '">切到 '
      + esc2(others[0].title || others[0].id || '') + '</a>' : '')
    + spineHtml(counts)
    + '</div>'
    + '<div class="top__right">'
    + '<button class="btn btn--primary" id="newTask" title="在任务段新建一张卡">新建任务</button>'
    + '<a class="quiet" href="/spaces">全部工作区</a>'
    + '</div></div></header>'
    /* sheet */
    + '<main class="sheet"><div class="wrap">'
    + '<div class="head"><h1>工作台</h1>'
    + '<p class="meta">' + esc2(metaLine) + '</p>'
    + '<div class="head__right"><a class="quiet" href="/legacy' + esc2(wsq) + '">改造前版本</a></div></div>'
    + '<nav class="tabs">' + NAV.map(([id, label], i) => '<a href="#' + id + '" data-tab="' + id + '"'
      + (i === 0 ? ' class="is-on"' : '') + '>' + esc2(label) + '</a>').join('') + '</nav>'
    + NAV.map(([id, label, lead], i) => {
      const src = embed(id === 'sec-cockpit' ? '/cockpit' : id === 'sec-stage' ? '/stage' : id === 'sec-team' ? '/team' : '/deps');
      const link = standalone(id === 'sec-cockpit' ? '/cockpit' : id === 'sec-stage' ? '/stage' : id === 'sec-team' ? '/team' : '/deps');
      return '<section class="sec" id="' + id + '">'
        + '<div class="sec__head"><h2>' + (ICONS[id] || '') + esc2(label) + '</h2>'
        + '<a class="sec__link" href="' + link + '">独立打开 ↗</a></div>'
        + '<p class="sec__lead">' + esc2(lead) + '</p>'
        + '<iframe data-auto src="' + src + '" title="' + esc2(label) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '"></iframe>'
        + '</section>';
    }).join('')
    + '</div></main>'
    + '<script>'
    + '(function () {'
    // iframe 自适应高度
    + '  var frames = [].slice.call(document.querySelectorAll("iframe[data-auto]"));'
    + '  function fit(f) { try { var d = f.contentDocument; if (!d) return;'
    + '    var h = Math.max(d.documentElement ? d.documentElement.scrollHeight : 0, d.body ? d.body.scrollHeight : 0);'
    + '    if (h > 40 && Math.abs(h - (+f.dataset.h || 0)) > 1) { f.style.height = h + "px"; f.dataset.h = h; } } catch (e) {} }'
    + '  frames.forEach(function (f) {'
    + '    f.addEventListener("load", function () { fit(f);'
    + '      try { new f.contentWindow.ResizeObserver(function () { fit(f); }).observe(f.contentDocument.body); } catch (e) {} });'
    + '    try { f.contentWindow.addEventListener("resize", function () { fit(f); }); } catch (e) {}'
    + '  });'
    + '  setInterval(function () { frames.forEach(fit); }, 1500);'
    + '  window.addEventListener("resize", function () { frames.forEach(fit); });'
    // tabs：scrollspy + 平滑定位
    + '  var tabs = [].slice.call(document.querySelectorAll(".tabs a"));'
    + '  var secs = tabs.map(function (a) { return document.getElementById(a.dataset.tab); });'
    + '  function mark(id) { tabs.forEach(function (a) { a.classList.toggle("is-on", a.dataset.tab === id); }); }'
    + '  function sync() {'
    + '    var line = 80, on = null;'
    + '    secs.forEach(function (s) { if (s && s.getBoundingClientRect().top <= line) on = s.id; });'
    + '    mark(on || (secs[0] && secs[0].id));'
    + '  }'
    + '  var ticking = false;'
    + '  window.addEventListener("scroll", function () {'
    + '    if (ticking) return; ticking = true;'
    + '    requestAnimationFrame(function () { sync(); ticking = false; });'
    + '  }, { passive: true });'
    + '  sync();'
    // 顶栏"新建任务"：直接点 stage 段里自己的按钮（弹窗在 stage 内）
    + '  var nb = document.getElementById("newTask");'
    + '  if (nb) nb.addEventListener("click", function () {'
    + '    var f = document.querySelector("#sec-stage iframe");'
    + '    try {'
    + '      var b = f.contentDocument && f.contentDocument.getElementById("addTask");'
    + '      if (b) { document.getElementById("sec-stage").scrollIntoView({ behavior: "smooth" }); setTimeout(function(){ b.click(); }, 220); return; }'
    + '    } catch (e) {}'
    + '    location.href = "/stage' + wsq.replace(/'/g, "%27") + '";'
    + '  });'
    + '})();'
    + '</script></body></html>';
}
