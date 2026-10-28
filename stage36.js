/* MathSpace Stage 36 — in the teacher's test results show ALL answer options:
   the student's choice and the correct answer are marked inside the full list.
   Works for single choice, multiple choice, true/false and matching in library tests ("Результати"). No SQL.
   Load LAST (after stage35.js). */
(function () {
  'use strict';
  if (window.__ms36) return;
  window.__ms36 = true;
  if (typeof sb === 'undefined' || typeof S === 'undefined') {
    console.error('MathSpace Stage 36: sb/S not available. Check script order.');
    return;
  }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = document.createElement('style');
  css.textContent = `
  .ms36-list{margin-top:8px;border:1px solid #e4dff2;border-radius:12px;padding:8px 10px;background:#fff}
  .ms36-opt{padding:6px 8px;border-radius:8px;margin:3px 0;line-height:1.7}
  .ms36-opt.ok{background:#e9f8ef}
  .ms36-opt.bad{background:#fdecee}
  .ms36-opt.pick:not(.ok):not(.bad){background:#f1edff}
  .ms36-tag{font-size:12px;font-weight:600;margin-left:6px;color:#625a78}
  .ms36-opt.ok .ms36-tag{color:#208a58}
  .ms36-opt.bad .ms36-tag{color:#a33e55}
  .ms36-none{color:#8a809d;font-size:13px}`;
  document.head.appendChild(css);

  const cache = new Map();           // test_id -> questions
  let busy = false;

  async function load(aid) {
    const a = await sb.from('library_attempts').select('test_id,answers').eq('id', aid).single();
    if (a.error) throw a.error;
    let qs = cache.get(a.data.test_id);
    if (!qs) {
      const r = await sb.from('library_questions').select('*').eq('test_id', a.data.test_id)
        .order('sort_order').order('created_at');
      if (r.error) throw r.error;
      qs = r.data; cache.set(a.data.test_id, qs);
    }
    return { qs, ans: a.data.answers || {} };
  }

  function listHtml(q, v) {
    const type = q.qtype, c = q.correct;
    if (type === 'matching') {
      const o = q.options;
      if (!o || !Array.isArray(o.left) || !Array.isArray(o.right)) return null;
      const L = 'АБВГДЕЄЖЗИ';
      const sv = Array.isArray(v) ? v : [], cc = Array.isArray(c) ? c : [];
      const nm = j => j === -1 ? 'немає відповідності' : (Number.isInteger(j) && o.right[j] !== undefined ? (L[j] || (j + 1)) + '. ' + esc(o.right[j]) : '—');
      const cols = typeof MSMatch !== 'undefined' && MSMatch.columns ? MSMatch.columns(o) : '';
      const rows = o.left.map((t, i) => {
        const has = sv[i] !== undefined && sv[i] !== null;
        const ok = has && sv[i] === cc[i];
        const cls = ok ? 'ok pick' : (has ? 'bad pick' : '');
        const mine = has ? nm(sv[i]) : 'без відповіді';
        const tail = ok ? '<span class="ms36-tag">правильно</span>' : `<span class="ms36-tag">правильно: ${nm(cc[i])}</span>`;
        return `<div class="ms36-opt ${cls}">${ok ? '✅' : '❌'} ${i + 1}. ${esc(t)} → <b>${mine}</b>${tail}</div>`;
      }).join('');
      return `<div class="ms36-list">${cols}<b class="small">Відповідь учня по пунктах</b>${rows}</div>`;
    }
    let opts;
    if (type === 'truefalse') opts = ['Правда', 'Неправда'];
    else if (type === 'single' || type === 'multiple') opts = Array.isArray(q.options) ? q.options : null;
    if (!opts) return null;
    const answered = !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
    const rows = opts.map((o, j) => {
      let pick, right;
      if (type === 'truefalse') {
        pick = answered && ((v === true && j === 0) || (v === false && j === 1));
        right = (c === true && j === 0) || (c === false && j === 1);
      } else if (type === 'single') {
        pick = answered && v === j; right = c === j;
      } else {
        pick = answered && [].concat(v).includes(j); right = [].concat(c || []).includes(j);
      }
      const cls = pick && right ? 'ok pick' : pick ? 'bad pick' : right ? 'ok' : '';
      const tag = pick && right ? 'обрав(ла) · правильно'
                : pick ? 'обрав(ла) · неправильно'
                : right ? 'правильна відповідь' : '';
      const mark = pick && right ? '✅' : pick ? '❌' : right ? '✔️' : '▫️';
      const label = type === 'truefalse' ? esc(o) : (j + 1) + '. ' + esc(o);
      return `<div class="ms36-opt ${cls}">${mark} ${label}${tag ? `<span class="ms36-tag">${tag}</span>` : ''}</div>`;
    }).join('');
    return `<div class="ms36-list"><b class="small">Усі варіанти</b>${rows}${answered ? '' : '<div class="ms36-none">Учень не відповів на це завдання</div>'}</div>`;
  }

  async function decorate() {
    if (busy) return;
    const forms = [...document.querySelectorAll('form[data-form="libgrade"]')].filter(f => !f.dataset.ms36);
    if (!forms.length) return;
    busy = true;
    try {
      for (const f of forms) {
        f.dataset.ms36 = '1';
        const body = f.parentElement;
        const items = [...body.querySelectorAll(':scope > .lib-q')];
        if (!items.length) continue;
        const { qs, ans } = await load(f.dataset.id);
        if (!body.isConnected) continue;
        items.forEach((el, i) => {
          const q = qs[i];
          if (!q) return;
          const html = listHtml(q, ans[q.id]);
          if (!html) return;
          const notice = el.querySelector('.notice');
          if (notice) notice.remove();
          const hint = [...el.querySelectorAll('.muted.small')].find(x => x.textContent.trim().startsWith('Правильно'));
          if (hint) hint.remove();
          el.insertAdjacentHTML('beforeend', html);
        });
        // формули в нових варіантах (якщо на сайті підключений автоматичний рендер)
        try {
          if (typeof window.renderMathInElement === 'function') {
            window.renderMathInElement(body, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false });
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('MathSpace Stage 36:', e);
    } finally { busy = false; }
  }

  document.addEventListener('ms:rendered', decorate);
  document.addEventListener('click', e => { if (e.target.closest('[data-act="libview"]')) setTimeout(decorate, 400); });
  setTimeout(decorate, 1200);
})();
