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
    + '.stream{max-height:320px!important;overflow-y:auto!important;overscroll-behavior:contain}'
    + '.stream::-webkit-scrollbar{width:8px}'
    + '.stream::-webkit-scrollbar-thumb{background:rgba(0,0,0,.14);border-radius:4px}'
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
export function canvasTeamCss() {
  return '<style>'
    + 'html,body{background:transparent!important}'
    + '.v2-root{background:transparent!important}'
    + '.v2-page{padding:64px 24px 84px 96px!important;max-width:none!important}'
    + '.v2-page>h1,.v2-page>.v2-sub{display:none!important}'
    + '.ta-view{padding:0!important;max-width:none!important}'
    + '.ta-view__head{display:none!important}'
    + '.ta-list{gap:20px!important}'
    + '.ta-block{background:transparent!important;border:0!important;border-radius:0!important;padding:0!important}'
    + '.ta-block+.ta-block{margin-top:6px!important}'
    + '.ta-block__bar{margin:0 0 6px!important;padding:0 2px!important;display:flex!important;align-items:center!important;gap:10px!important}'
    + '.ta-block__name{font-size:12.5px!important;font-weight:600!important;color:#16181d!important;letter-spacing:.2px!important;'
    + 'display:inline-flex!important;align-items:center!important;gap:8px!important;padding:4px 11px!important;'
    + 'background:rgba(255,255,255,.82)!important;border:1px solid rgba(22,24,29,.07)!important;border-radius:999px!important;'
    + 'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}'
    + '.ta-block__modes .v2-btn{height:24px!important;padding:0 9px!important;font-size:11px!important;border-radius:999px!important;'
    + 'background:rgba(255,255,255,.82)!important}'
    + '.ta-block__hint{display:none!important}'
    + '.ta-canvas{padding-bottom:4px!important;margin-bottom:0!important}'
    + '.ta-stage{gap:44px!important;padding:30px 20px 12px!important;min-width:520px!important}'
    + '.ta-card{width:208px!important;border-radius:12px!important;background:#fff!important;'
    + 'box-shadow:0 1px 2px rgba(15,17,21,.05)!important;transition:box-shadow .16s ease,border-color .16s ease}'
    + '.ta-card:hover{box-shadow:0 8px 22px rgba(15,17,21,.09)!important;border-color:rgba(77,107,254,.28)!important}'
    + '.ta-card--person{width:auto!important;min-width:132px!important}'
    + '.ta-block--single .ta-block__bar{justify-content:flex-end!important;margin:0 0 2px!important;padding:0 8px 0 0!important;min-height:22px!important}'
    + '.ta-block--single .ta-stage{padding-top:8px!important}'
    + '.ta-view--single .ta-list{gap:0!important}'
    + '.ta-block--single .v2-st--idle{--st-main:#ef4444;--st-bg:rgba(239,68,68,.10);--st-bd:rgba(239,68,68,.26);--st-fg:#dc2626}'
    + '.ta-block--single .v2-st--running{--st-main:#22c55e;--st-bg:rgba(34,197,94,.12);--st-bd:rgba(34,197,94,.28);--st-fg:#15803d}'
    + '.ta-view--canvas .ta-panwrap{position:fixed;inset:0;overflow:hidden;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}'
    + '.ta-view--canvas .ta-card .v2-popover{display:none!important}'
    + '.ta-view--canvas .ta-panwrap.is-dragging{cursor:grabbing}'
    + '.ta-view--canvas .ta-pan{position:absolute;left:0;top:0;transform-origin:0 0;padding:70px 110px 90px 96px;width:max-content;min-width:100%;min-height:100%}'
    + '.ta-view--canvas .ta-canvas{overflow:visible!important;padding-bottom:0!important;margin-bottom:0!important}'
    + '.ta-view--canvas .ta-stage{gap:52px!important;padding:8px 0 12px!important;min-width:0!important}'
    + '.ta-view--canvas .ta-card{width:236px!important}'
    + '.ta-view--canvas .ta-card__name{font-size:15px!important}'
    + '.ta-view--canvas .ta-card__sub,.ta-view--canvas .ta-card__row{font-size:12.5px!important}'
    + '.ta-zoom{position:fixed;right:18px;bottom:64px;z-index:9;display:flex;align-items:center;gap:2px;padding:4px;'
    + 'background:rgba(255,255,255,.92);border:1px solid rgba(22,24,29,.08);border-radius:999px;'
    + 'box-shadow:0 8px 24px rgba(35,42,53,.10);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}'
    + '.ta-zoom__btn{width:28px;height:28px;border:0;border-radius:999px;background:transparent;color:#353638;font-size:14px;cursor:pointer;line-height:1}'
    + '.ta-zoom__btn:hover{background:#f1f3f5}'
    + '.ta-zoom__btn--reset{width:auto;padding:0 9px;font-size:11.5px;color:#61666b}'
    + '.ta-zoom__val{min-width:42px;text-align:center;font-size:11px;color:#61666b;font-variant-numeric:tabular-nums}'
    + '.ta-pan-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:56px;z-index:8;padding:3px 10px;border-radius:999px;'
    + 'background:rgba(255,255,255,.75);color:#9aa1ab;font-size:11px;pointer-events:none}'
    + '@media (max-width:900px){.v2-page{padding:60px 12px 80px 84px!important}}'
    + '</style>';
}

/* 右侧栏里的团队架构（/team?...&canvas=1&pane=1）：窄栏专用，去标题、缩留白 */
export function paneTeamCss() {
  return '<style>'
    + 'html,body{background:#fff!important}'
    + '.v2-page{padding:10px 8px 26px!important;max-width:none!important}'
    + '.ta-view{padding:0!important;max-width:none!important}'
    + '.ta-view__title,.ta-view__hint{display:none!important}'
    + '.ta-view__head{margin:0 0 6px!important;justify-content:flex-end!important}'
    + '.ta-layouts__label{display:none!important}'
    + '.ta-layouts .v2-btn{height:24px!important;padding:0 9px!important;font-size:11px!important;border-radius:999px!important}'
    + '.ta-list{gap:14px!important}'
    + '.ta-stage{gap:26px!important;padding:16px 4px 8px!important;min-width:480px!important}'
    + '.ta-card{width:186px!important;border-radius:10px!important}'
    + '.ta-block__bar{flex-wrap:nowrap!important;gap:6px!important}'
    + '.ta-block__name{font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis}'
    + '.ta-canvas{padding-bottom:2px!important;margin-bottom:0!important}'
    + '</style>';
}

/* 抽屉里的依赖泳道（/deps?drawer=1）：只留图与泳道，去掉标题和说明占位 */
export function canvasDrawerCss() {
  return '<style>'
    + 'html,body{background:#fff!important}'
    + '.v2-page{padding:6px 14px 12px!important;max-width:none!important}'
    + '.ds-root{padding:0!important}'
    + '.ds-title,.ds-sub{display:none!important}'
    + '.ds-tabs{margin:0 0 8px!important}'
    + '.ds-team{margin-top:6px!important}'
    + '</style>';
}
