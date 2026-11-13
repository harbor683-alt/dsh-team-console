/* 拷问台 · 设计树（grilling 的工作台落点）
 * 每一轮 = 一批「前置条件已定」的问题；每题带 ➡️ 推荐答案，答完标记已定。
 * 数据：team-view/data/grill-<ws>.json（服务端 /api/grill 读写）
 * 产物：<ws>/project-card.md（答完一键生成，交给执行 agent 的第一条消息也在这里）
 */

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function stat(rounds) {
  let total = 0;
  let settled = 0;
  (rounds || []).forEach((r) => (r.questions || []).forEach((q) => { total += 1; if (q.status === 'settled') settled += 1; }));
  return { total, settled, rounds: (rounds || []).length };
}

function questionHtml(q, roundIdx) {
  const on = q.status === 'settled';
  return '<article class="gr-q' + (on ? ' is-on' : '') + '" data-q="' + esc(q.id) + '">'
    + '<header class="gr-q__head">'
    + '<span class="gr-q__id">' + esc(q.id) + '</span>'
    + '<span class="gr-q__title">' + esc(q.title) + '</span>'
    + '<label class="gr-q__st"><input type="checkbox" class="gr-set"' + (on ? ' checked' : '') + '> 已定</label>'
    + '</header>'
    + (q.body ? '<p class="gr-q__body">' + esc(q.body) + '</p>' : '')
    + (q.rec ? '<div class="gr-q__rec"><b>→ 推荐</b><span>' + esc(q.rec) + '</span></div>' : '')
    + '<textarea class="gr-ans" rows="2" placeholder="你的答案（同意推荐可留空）">' + esc(q.answer || '') + '</textarea>'
    + '</article>';
}

function roundHtml(r, i) {
  const qs = (r.questions || []).map((q) => questionHtml(q, i)).join('');
  return '<section class="gr-round" data-round="' + esc(r.id) + '">'
    + '<div class="gr-round__head"><span class="gr-round__n">' + (i + 1) + '</span>'
    + '<h3>' + esc(r.title || ('第 ' + (i + 1) + ' 轮')) + '</h3>'
    + (r.note ? '<span class="gr-round__note">' + esc(r.note) + '</span>' : '')
    + '</div>' + qs + '</section>';
}

export function renderGrill(opts) {
  const o = opts || {};
  const ws = o.ws || {};
  const rounds = Array.isArray(o.rounds) ? o.rounds : [];
  const s = stat(rounds);
  const empty = !rounds.length;

  const body = empty
    ? '<div class="gr-empty"><div class="gr-empty__t">这一轮还没开问</div>'
      + '<p>先写入第一轮模板（6 问：交付形态 / 使用场景 / 三条判据 / 边界 / 自主度 / 证据与回滚），答完写回，再让 AI 去干活。</p>'
      + '<button type="button" class="gr-btn gr-btn--primary" id="gr-seed">写入第一轮模板</button></div>'
    : rounds.map(roundHtml).join('');

  return '<section class="gr-root">'
    + '<style>' + CSS + '</style>'
    + '<div class="gr-head">'
    + '<div><h2 class="gr-title">拷问台 · 设计树</h2>'
    + '<p class="gr-sub">每轮只问前置条件已定的问题；每题给推荐答案，你只负责推翻或点头。答完生成 <code>project-card.md</code>。</p></div>'
    + '<div class="gr-stats"><b>' + s.settled + '</b>/' + s.total + ' 已定 · ' + s.rounds + ' 轮</div>'
    + '</div>'
    + '<div class="gr-body">' + body + '</div>'
    + '<div class="gr-foot">'
    + '<button type="button" class="gr-btn gr-btn--primary" id="gr-save">保存答案</button>'
    + '<button type="button" class="gr-btn" id="gr-card">生成 project-card.md</button>'
    + '<button type="button" class="gr-btn" id="gr-copy">复制首条消息</button>'
    + '<span class="gr-msg" id="gr-msg"></span>'
    + '</div>'
    + '<script>' + SCRIPT + '</script>'
    + '</section>';
}

const CSS = `
.gr-root{max-width:1120px;margin:0 auto;padding:var(--sp-4);font-family:var(--font-sans)}
.gr-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
.gr-title{margin:0;font-size:18px;font-weight:650;color:#16181d}
.gr-sub{margin:4px 0 0;font-size:12px;color:#7a808a;line-height:1.6}
.gr-sub code{background:#f1f3f7;border-radius:4px;padding:1px 5px;font-size:11px}
.gr-stats{font-size:12px;color:#7a808a;font-variant-numeric:tabular-nums;white-space:nowrap}
.gr-stats b{color:#16181d;font-size:16px;font-weight:650}
.gr-body{display:flex;flex-direction:column;gap:14px}
.gr-round{background:#fff;border:1px solid rgba(22,24,29,.08);border-radius:10px;padding:14px 16px 8px}
.gr-round__head{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(22,24,29,.07)}
.gr-round__n{width:20px;height:20px;border-radius:5px;background:#0f1115;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;flex:none}
.gr-round__head h3{margin:0;font-size:14px;font-weight:650;color:#16181d}
.gr-round__note{font-size:11.5px;color:#8a9099;margin-left:auto}
.gr-q{border:1px solid rgba(22,24,29,.07);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fcfdff;transition:border-color .15s,background .15s}
.gr-q.is-on{border-color:rgba(34,197,94,.35);background:#f6fdf9}
.gr-q__head{display:flex;align-items:center;gap:8px}
.gr-q__id{font-size:11px;font-weight:700;color:#3b57e0;background:rgba(77,107,254,.1);border-radius:4px;padding:2px 6px;flex:none}
.gr-q__title{font-size:13.5px;font-weight:600;color:#16181d;line-height:1.5}
.gr-q__st{margin-left:auto;font-size:11.5px;color:#7a808a;display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer}
.gr-q__st input{accent-color:#22c55e}
.gr-q__body{margin:6px 0 0;font-size:12.5px;line-height:1.7;color:#5b6169}
.gr-q__rec{display:flex;gap:7px;align-items:flex-start;margin:8px 0 0;background:#f5f8ff;border-left:3px solid rgba(77,107,254,.45);border-radius:0 6px 6px 0;padding:7px 10px;font-size:12.5px;line-height:1.65;color:#3d4149}
.gr-q__rec b{color:#3b57e0;font-weight:600;white-space:nowrap}
.gr-ans{width:100%;box-sizing:border-box;margin-top:8px;padding:7px 9px;border:1px solid rgba(22,24,29,.12);border-radius:6px;
  font:12.5px/1.65 inherit;color:#353638;resize:vertical;outline:none;background:#fff}
.gr-ans:focus{border-color:rgba(77,107,254,.5)}
.gr-empty{background:#fff;border:1px dashed rgba(22,24,29,.14);border-radius:10px;padding:26px 24px;text-align:center}
.gr-empty__t{font-size:15px;font-weight:650;color:#16181d}
.gr-empty p{margin:8px auto 14px;max-width:520px;font-size:12.5px;line-height:1.75;color:#7a808a}
.gr-foot{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 0;background:linear-gradient(180deg,rgba(249,250,251,0),#f9fafb 30%)}
.gr-btn{padding:6px 12px;border:1px solid rgba(0,0,0,.12);border-radius:6px;background:#fff;font:12.5px/1.4 inherit;color:#353638;cursor:pointer}
.gr-btn:hover{background:#f1f3f5}
.gr-btn--primary{background:#0f1115;border-color:#0f1115;color:#fff}
.gr-btn--primary:hover{background:#26292f}
.gr-msg{font-size:12px;color:#61666b;margin-left:4px}
.gr-msg.err{color:#b91c1c}
@media (max-width:760px){.gr-head{flex-direction:column;align-items:flex-start}}
`;

const SCRIPT = `
(function () {
  'use strict';
  var msg = document.getElementById('gr-msg');
  function say(t, bad) { if (!msg) return; msg.textContent = t || ''; msg.className = 'gr-msg' + (bad ? ' err' : ''); }
  function collect() {
    var out = {};
    Array.prototype.forEach.call(document.querySelectorAll('.gr-q'), function (card) {
      var id = card.getAttribute('data-q');
      var ta = card.querySelector('.gr-ans');
      var cb = card.querySelector('.gr-set');
      out[id] = { answer: ta ? ta.value : '', status: cb && cb.checked ? 'settled' : 'open' };
    });
    return out;
  }
  function post(payload) {
    return fetch('/api/grill', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.error ? j.error : 'HTTP ' + r.status); return j; }); });
  }
  var seed = document.getElementById('gr-seed');
  if (seed) seed.addEventListener('click', function () {
    say('写入中…');
    post({ op: 'seed' }).then(function () { location.reload(); }).catch(function (e) { say('失败：' + e.message, true); });
  });
  var save = document.getElementById('gr-save');
  if (save) save.addEventListener('click', function () {
    say('保存中…');
    post({ op: 'save', answers: collect() })
      .then(function (j) { say('已保存 · ' + (j.settled || 0) + '/' + (j.total || 0) + ' 已定'); })
      .catch(function (e) { say('失败：' + e.message, true); });
  });
  var card = document.getElementById('gr-card');
  if (card) card.addEventListener('click', function () {
    say('生成中…');
    post({ op: 'save', answers: collect() })
      .then(function () { return post({ op: 'card' }); })
      .then(function (j) { say('已生成：' + (j.path || 'project-card.md')); })
      .catch(function (e) { say('失败：' + e.message, true); });
  });
  var copy = document.getElementById('gr-copy');
  if (copy) copy.addEventListener('click', function () {
    var got = {};
    Array.prototype.forEach.call(document.querySelectorAll('.gr-q'), function (c) {
      var ta = c.querySelector('.gr-ans');
      var v = ta ? ta.value.trim() : '';
      if (v) got[c.querySelector('.gr-q__title').textContent] = v;
    });
    var lines = ['按拷问台的答案开工，规则：不确定先问，不要自己拍板。', ''];
    Object.keys(got).forEach(function (k) { lines.push('- ' + k + '：' + got[k]); });
    var text = lines.join('\\n');
    var done = function () { say('首条消息已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { say('复制失败，请手动选中', true); });
    else { say('浏览器不支持自动复制', true); }
  });
})();
`;
