/* 项目书 · 书架 + 阅读器
 * 左列是书脊清单（来自 <ws>/项目书/*.md），右侧直接读全文并做轻量 markdown 渲染。
 * 风格与流氏工作台画布一致：白卡、细边、#4d6bfe 单色强调。
 */

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function fmtSize(n) {
  const v = Number(n || 0);
  if (!v) return '';
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  return (v / 1024 / 1024).toFixed(1) + ' MB';
}

export function renderProjects(opts) {
  const o = opts || {};
  const projects = Array.isArray(o.projects) ? o.projects : [];
  const current = o.current || (projects[0] && projects[0].name) || '';
  const wsName = esc((o.ws && (o.ws.title || o.ws.id)) || '');

  const books = projects.length
    ? projects.map((p) => {
      const name = String(p.name || '').replace(/[.]md$/, '');
      const on = name === current;
      return '<button type="button" class="pj-book' + (on ? ' is-on' : '') + '" data-name="' + esc(name) + '">'
        + '<span class="pj-book__spine" aria-hidden="true"></span>'
        + '<span class="pj-book__body">'
        + '<span class="pj-book__name">' + esc(name) + '</span>'
        + '<span class="pj-book__meta">' + esc([fmtDate(p.mtime), fmtSize(p.size)].filter(Boolean).join(' · ')) + '</span>'
        + '</span></button>';
    }).join('')
    : '<div class="pj-empty">这个工作区还没有项目书。<br>在 <code>' + esc((o.ws && o.ws.path) || '') + '\\项目书\\</code> 放 <code>.md</code> 就会出现在这里。</div>';

  return '<section class="pj-root" data-ws="' + esc(wsName) + '">'
    + '<style>' + CSS + '</style>'
    + (o.embed ? '' : '<div class="pj-head">'
      + '<div><h2 class="pj-title">项目书</h2>'
      + '<p class="pj-sub">左列选一份，右侧直接读原文；文件改动后刷新即最新。</p></div>'
      + '<div class="pj-count">' + projects.length + ' 份</div>'
      + '</div>')
    + '<div class="pj-grid">'
    + '<div class="pj-list" role="list">' + books + '</div>'
    + '<article class="pj-reader" id="pj-reader">'
    + '<div class="pj-reader__empty">选左侧一份项目书开始阅读。</div>'
    + '</article>'
    + '</div>'
    + '<script>' + SCRIPT + '</script>'
    + '</section>';
}

const CSS = `
.pj-root{max-width:1200px;margin:0 auto;padding:var(--sp-4);font-family:var(--font-sans)}
.pj-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
.pj-title{margin:0;font-size:18px;font-weight:650;color:#16181d;letter-spacing:.2px}
.pj-sub{margin:4px 0 0;font-size:12px;color:#7a808a}
.pj-count{font-size:12px;color:#7a808a;font-variant-numeric:tabular-nums;white-space:nowrap}
.pj-grid{display:grid;grid-template-columns:248px minmax(0,1fr);gap:14px;align-items:start}
.pj-list{display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 190px);overflow:auto;padding-right:2px}
.pj-list::-webkit-scrollbar{width:8px}
.pj-list::-webkit-scrollbar-thumb{background:rgba(22,24,29,.12);border-radius:4px}
.pj-book{display:flex;gap:9px;align-items:stretch;width:100%;padding:9px 10px;text-align:left;cursor:pointer;
  background:#fff;border:1px solid rgba(22,24,29,.08);border-radius:10px;transition:border-color .15s,box-shadow .15s,transform .15s}
.pj-book:hover{border-color:rgba(77,107,254,.3);box-shadow:0 4px 14px rgba(22,24,29,.06);transform:translateY(-1px)}
.pj-book.is-on{border-color:rgba(77,107,254,.42);background:#f7f9ff}
.pj-book__spine{width:4px;border-radius:2px;background:linear-gradient(180deg,#4d6bfe,#8ea4ff);flex:none;opacity:.85}
.pj-book__body{display:flex;flex-direction:column;gap:3px;min-width:0}
.pj-book__name{font-size:13px;font-weight:600;color:#16181d;line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pj-book__meta{font-size:11px;color:#7a808a;font-variant-numeric:tabular-nums}
.pj-empty{font-size:12px;line-height:1.7;color:#7a808a;background:#fafbff;border:1px dashed rgba(22,24,29,.12);
  border-radius:10px;padding:12px}
.pj-empty code{background:#f1f3f7;border-radius:4px;padding:1px 4px;font-size:11px}
.pj-reader{background:#fff;border:1px solid rgba(22,24,29,.08);border-radius:12px;min-height:360px;
  max-height:calc(100vh - 190px);overflow:auto;padding:26px 32px 40px}
.pj-reader__empty{color:#9aa0a8;font-size:13px;padding:24px 4px}
.pj-reader h1{font-size:22px;line-height:1.35;margin:0 0 12px;color:#16181d;font-weight:650}
.pj-reader h2{font-size:16px;margin:24px 0 8px;color:#16181d;font-weight:650;padding-bottom:6px;border-bottom:1px solid rgba(22,24,29,.07)}
.pj-reader h3{font-size:14px;margin:18px 0 6px;color:#16181d;font-weight:600}
.pj-reader p{margin:9px 0;font-size:13.5px;line-height:1.8;color:#3d4149}
.pj-reader ul{margin:8px 0;padding-left:20px}
.pj-reader li{font-size:13.5px;line-height:1.8;color:#3d4149;margin:3px 0}
.pj-reader code{background:#f3f5f9;border-radius:4px;padding:1px 5px;font-size:12px;color:#3b57e0}
.pj-reader pre{background:#f8f9fc;border:1px solid rgba(22,24,29,.07);border-radius:8px;padding:12px 14px;overflow:auto}
.pj-reader pre code{background:transparent;padding:0;color:#2f3440;font-size:12px;line-height:1.65}
.pj-reader blockquote{margin:10px 0;padding:8px 14px;border-left:3px solid rgba(77,107,254,.35);background:#f8faff;color:#4a4f59;font-size:13px}
.pj-reader a{color:#3b57e0;text-decoration:none;border-bottom:1px solid rgba(77,107,254,.3)}
.pj-reader table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12.5px}
.pj-reader th,.pj-reader td{border:1px solid rgba(22,24,29,.09);padding:7px 10px;text-align:left;vertical-align:top;line-height:1.65}
.pj-reader th{background:#f8f9fc;font-weight:600;color:#16181d;white-space:nowrap}
.pj-reader tr:nth-child(even) td{background:#fcfdff}
.pj-reader__bar{display:flex;align-items:center;gap:8px;font-size:12px;color:#7a808a;margin-bottom:14px;
  padding-bottom:10px;border-bottom:1px solid rgba(22,24,29,.07)}
.pj-reader__bar b{color:#16181d;font-weight:600;font-size:13px}
.pj-dot{width:4px;height:4px;border-radius:50%;background:rgba(22,24,29,.25)}
@media (max-width:760px){.pj-grid{grid-template-columns:1fr}.pj-list{max-height:200px}.pj-reader{max-height:none}}
`;

const SCRIPT = `
(function () {
  'use strict';
  var reader = document.getElementById('pj-reader');
  var books = Array.prototype.slice.call(document.querySelectorAll('.pj-book'));

  function inline(s) {
    return s
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function markdown(src) {
    var lines = String(src || '').split(/\\r?\\n/);
    var out = [], i = 0, inCode = false, code = [], para = [], list = null;
    function flushPara() {
      if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
    }
    function flushList() {
      if (list) { out.push('<' + list + '>' + listItems.join('') + '</' + list + '>'); list = null; listItems = []; }
    }
    var listItems = [];
    for (; i < lines.length; i++) {
      var line = lines[i];
      if (/^\\s*\`\`\`/.test(line)) {
        if (!inCode) { inCode = true; code = []; flushPara(); flushList(); }
        else { inCode = false; out.push('<pre><code>' + esc(code.join('\\n')) + '</code></pre>'); }
        continue;
      }
      if (inCode) { code.push(line); continue; }
      if (!line.trim()) { flushPara(); flushList(); continue; }
      // 表格：表头行 + 分隔行（|---|）开头
      if (/^\\s*\\|/.test(line) && i + 1 < lines.length && /^\\s*\\|?[\\s:|-]+\\|?\\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0) {
        flushPara(); flushList();
        var cells = function (row) {
          var s = row.trim().replace(/^\\|/, '').replace(/\\|$/, '');
          return s.split('|').map(function (c) { return c.trim(); });
        };
        var head = cells(line); i += 2;
        var body = '';
        while (i < lines.length && /^\\s*\\|/.test(lines[i])) {
          var row = cells(lines[i]);
          body += '<tr>' + row.map(function (c) { return '<td>' + inline(esc(c)) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        i--;
        out.push('<table><thead><tr>' + head.map(function (c) { return '<th>' + inline(esc(c)) + '</th>'; }).join('')
          + '</tr></thead><tbody>' + body + '</tbody></table>');
        continue;
      }
      var h = line.match(/^(#{1,3})\\s+(.*)$/);
      if (h) { flushPara(); flushList(); out.push('<h' + h[1].length + '>' + inline(esc(h[2].trim())) + '</h' + h[1].length + '>'); continue; }
      if (/^\\s*[-*]\\s+/.test(line)) {
        flushPara();
        if (list !== 'ul') { flushList(); list = 'ul'; }
        listItems.push('<li>' + inline(esc(line.replace(/^\\s*[-*]\\s+/, ''))) + '</li>');
        continue;
      }
      if (/^\\s*\\d+[.)]\\s+/.test(line)) {
        flushPara();
        if (list !== 'ol') { flushList(); list = 'ol'; }
        listItems.push('<li>' + inline(esc(line.replace(/^\\s*\\d+[.)]\\s+/, ''))) + '</li>');
        continue;
      }
      if (/^\\s*&gt;\\s?/.test(line) || /^\\s*>\\s?/.test(line)) {
        flushPara(); flushList();
        out.push('<blockquote>' + inline(esc(line.replace(/^\\s*>\\s?/, ''))) + '</blockquote>');
        continue;
      }
      para.push(line.trim());
    }
    if (inCode && code.length) out.push('<pre><code>' + esc(code.join('\\n')) + '</code></pre>');
    flushPara(); flushList();
    return out.join('');
  }

  function openBook(name, btn) {
    books.forEach(function (b) { b.classList.toggle('is-on', b === btn); });
    reader.innerHTML = '<div class="pj-reader__empty">读取中…</div>';
    fetch('/api/project?id=' + encodeURIComponent(name), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        reader.innerHTML = '<div class="pj-reader__bar"><b>' + esc(name) + '</b>'
          + '<span class="pj-dot"></span><span>只读预览</span></div>'
          + '<div class="pj-md">' + markdown(text) + '</div>';
        reader.scrollTop = 0;
      })
      .catch(function (e) {
        reader.innerHTML = '<div class="pj-reader__empty">读取失败：' + esc(e.message) + '</div>';
      });
  }
  books.forEach(function (btn) {
    btn.addEventListener('click', function () { openBook(btn.getAttribute('data-name'), btn); });
  });
  var first = document.querySelector('.pj-book.is-on') || books[0];
  if (first) openBook(first.getAttribute('data-name'), first);
})();
`;
