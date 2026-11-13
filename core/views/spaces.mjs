// 全部工作区索引页：一个工作区一张卡片，点进去就是它的流氏工作台画布。
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderSpaces(spaces, opts = {}) {
  const list = spaces || [];
  const cards = list.map((s) => {
    const t = s.tasks || [];
    const todo = t.filter((x) => x.status === 'todo' || x.status === 'running').length;
    const done = t.filter((x) => x.status === 'done').length;
    const backlog = t.filter((x) => x.status === 'backlog').length;
    const pctDone = t.length ? Math.round((done / t.length) * 100) : 0;
    const href = '/?ws=' + encodeURIComponent(s.id || s.path);
    const cur = opts.current && s.id === opts.current ? ' cur' : '';
    return `<a class="wcard${cur}" href="${href}">
      <div class="wc-h"><span class="wc-t">${esc(s.title)}</span><span class="wc-go">进入画布 →</span></div>
      <div class="wc-p" title="${esc(s.path)}">${esc(s.path)}</div>
      <div class="wc-stats"><span><b>${todo}</b> 待办</span><span><b>${done}</b> 完成</span><span><b>${backlog}</b> 长期</span><span><b>${(s.teams || []).length}</b> 团队</span><span><b>${s.projects || 0}</b> 项目书</span></div>
      <div class="wc-bar"><i style="width:${pctDone}%"></i></div>
    </a>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>流氏工作台 · 全部工作区</title><style>
  :root{--ink:#0f1115;--mut:#61666b;--line:rgba(0,0,0,.10);--bg:#f9fafb}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.7 "Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh}
  .wrap{max-width:1080px;margin:0 auto;padding:44px 26px 60px}
  h1{margin:0 0 6px;font-size:26px;letter-spacing:.5px}
  .sub{color:var(--mut);margin-bottom:26px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .wcard{display:block;text-decoration:none;color:inherit;background:#ffffff;border:1px solid var(--line);border-radius:16px;padding:18px 18px 14px;box-shadow:0 6px 20px rgba(35,42,53,.05);transition:.18s}
  .wcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(35,42,53,.10);border-color:#d3e2ff}
  .wcard.cur{border-color:#4176e6;box-shadow:0 0 0 3px #edf3fe}
  .wc-h{display:flex;align-items:baseline;gap:10px;justify-content:space-between}
  .wc-t{font-size:18px;font-weight:700}
  .wc-go{font-size:12px;color:#4176e6;white-space:nowrap}
  .wc-p{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--mut);margin:6px 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wc-stats{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--mut)}
  .wc-stats b{color:var(--ink);font-size:14px;margin-right:2px}
  .wc-bar{margin-top:12px;height:6px;border-radius:999px;background:#f1f3f5;overflow:hidden}
  .wc-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#7aaaff,#4176e6)}
  footer{margin-top:30px;color:var(--mut);font-size:12px}
  </style></head><body><div class="wrap">
  <h1>🗂 流氏工作台 · 全部工作区</h1>
  <div class="sub">每个工作区一张画布：团队关系图打底，左上角切换驾驶舱 / 项目书 / 拷问台 / 团队架构，底部展开依赖泳道。</div>
  <div class="grid">${cards || '<div class="sub">还没有登记工作区</div>'}</div>
  <footer>数据来自 .dsh/storages/workspace.json 与本地任务账本（按 workspaceId 归到各工作区）</footer>
  </div></body></html>`;
}
