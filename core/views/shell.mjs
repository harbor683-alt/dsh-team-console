/* 单页工作台壳：一处入口，四段 iframe 承载（各视图保留自己的样式与脚本，互不污染）
 * 布局沿用 V1：工作区条 → 标题 → 项目书/任务挂绳 → 团队 → 泳道，驾驶舱置顶当"今天怎么了"。
 */

const esc2 = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 嵌进 iframe 时，隐藏各视图自己的导航/标题，只留内容 */
export function embedCss() {
  return '<style>'
    + '.v2-nav{display:none!important}'
    + '.v2-page{max-width:none!important;padding:0!important}'
    + '.cockpit-head{display:none!important}'
    + '.v2-page>h1,.v2-page>.v2-sub{display:none!important}'
    + '.ta-view__title{display:none!important}'
    + '.ds-title{display:none!important}'
    + 'html,body{background:transparent!important}'
    + '</style>';
}

/* stage 页面嵌入时：隐藏 ② 团队 / ③ 时间轨（由 team-arch、dep-swim 代替）与缩放按钮 */
export function stageEmbedCss() {
  return '<style>'
    + '[data-sec="team"],[data-sec="timeline"],.zctl{display:none!important}'
    + 'html,body{background:transparent!important}'
    + 'body{padding-bottom:0!important}'
    + '</style>';
}

const NAV = [
  ['sec-cockpit', '驾驶舱'],
  ['sec-stage', '项目书 + 任务'],
  ['sec-team', '团队架构'],
  ['sec-deps', '依赖泳道'],
];

export function renderShell({ ws, spaces = [], qs = '', demo = false }) {
  const wsq = qs || ('?ws=' + encodeURIComponent(ws.id || ws.path || ''));
  const sep = wsq.includes('?') ? '&' : '?';
  const embed = (p) => esc2(p + wsq + sep + 'embed=1');
  const others = spaces.filter((s) => (s.id || s.path) !== (ws.id || ws.path)).slice(0, 3);

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>工作台 · ' + esc2(ws.title || ws.id || '') + '</title>'
    + '<style>'
    + 'html,body{margin:0;background:#f9fafb;color:#0f1115;'
    + 'font-family:-apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}'
    + '.shell{max-width:1280px;margin:0 auto;padding:12px 16px 28px}'
    + '.wsbar{display:flex;align-items:center;gap:10px;font-size:13px;color:#61666b;margin:0 0 14px}'
    + '.chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid rgba(0,0,0,.10);'
    + 'border-radius:999px;padding:4px 12px;color:#0f1115;font-weight:600}'
    + '.wsbar a{color:#4176e6;text-decoration:none}'
    + '.wsbar a:hover{text-decoration:underline}'
    + 'h1{font-size:22px;line-height:1.3;margin:0 0 6px;letter-spacing:.2px}'
    + '.sub{color:#61666b;font-size:13px;margin:0 0 12px}'
    + 'nav{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 12px}'
    + 'nav a{font-size:13px;padding:5px 12px;border-radius:6px;color:#61666b;text-decoration:none;border:1px solid transparent}'
    + 'nav a:hover{background:#f1f3f5;color:#0f1115}'
    + 'nav a.is-on{background:#0f1115;color:#fff;border-color:#0f1115}'
    + '.blk{margin:0 0 10px}'
    + '.blk>iframe{display:block;width:100%;height:0;border:0;background:transparent}'
    + '.anchor{scroll-margin-top:10px}'
    + '</style></head><body><div class="shell">'
    + '<div class="wsbar"><span class="chip">🗂 工作区 ' + esc2(ws.title || ws.id || '') + '</span>'
    + '<span>' + esc2(ws.path || '') + '</span>'
    + (others.length ? '<span>切换：' + others.map((s) => '<a href="/?ws=' + encodeURIComponent(s.id || s.path) + '">' + esc2(s.title || s.id || '') + '</a>').join(' · ') + '</span>' : '')
    + '<a style="margin-left:auto" href="/spaces">全部工作区 →</a></div>'
    + '<h1>工作台</h1>'
    + '<p class="sub">一个界面看全部：驾驶舱 → 项目书与任务 → 团队架构 → 依赖泳道' + (demo ? ' · 演示数据' : '') + '</p>'
    + '<nav>' + NAV.map(([id, label], i) => '<a href="#' + id + '"' + (i === 0 ? ' class="is-on"' : '') + '>' + esc2(label) + '</a>').join('') + '</nav>'
    + '<div class="blk anchor" id="sec-cockpit"><iframe data-auto src="' + embed('/cockpit') + '" title="驾驶舱"></iframe></div>'
    + '<div class="blk anchor" id="sec-stage"><iframe data-auto src="' + embed('/stage') + '" title="项目书与任务"></iframe></div>'
    + '<div class="blk anchor" id="sec-team"><iframe data-auto src="' + embed('/team') + '" title="团队架构"></iframe></div>'
    + '<div class="blk anchor" id="sec-deps"><iframe data-auto src="' + embed('/deps') + '" title="依赖泳道"></iframe></div>'
    + '</div>'
    + '<script>'
    + '(function () {'
    + '  var frames = [].slice.call(document.querySelectorAll("iframe[data-auto]"));'
    + '  function fit(f) {'
    + '    try {'
    + '      var d = f.contentDocument; if (!d) return;'
    + '      var h = Math.max(d.documentElement ? d.documentElement.scrollHeight : 0, d.body ? d.body.scrollHeight : 0);'
    + '      if (h > 40 && Math.abs(h - (+f.dataset.h || 0)) > 1) { f.style.height = h + "px"; f.dataset.h = h; }'
    + '    } catch (e) {}'
    + '  }'
    + '  frames.forEach(function (f) {'
    + '    f.addEventListener("load", function () {'
    + '      fit(f);'
    + '      try { new f.contentWindow.ResizeObserver(function () { fit(f); }).observe(f.contentDocument.body); } catch (e) {}'
    + '    });'
    + '    try { f.contentWindow.addEventListener("resize", function () { fit(f); }); } catch (e) {}'
    + '  });'
    + '  setInterval(function () { frames.forEach(fit); }, 1500);'
    + '  window.addEventListener("resize", function () { frames.forEach(fit); });'
    + '})();'
    + '</script></body></html>';
}
