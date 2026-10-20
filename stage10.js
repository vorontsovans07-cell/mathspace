/* MathSpace · етап 10: панель номерів у тесті (одне завдання на екрані, кожне зберігається окремо)
   + нумерація уроків і дата/час додавання. Підключається ПІСЛЯ stage9.js.
   Спершу виконайте 07_lesson_numbers.sql */
(function () {
  'use strict';

  /* ================= стилі ================= */
  const st = document.createElement('style');
  st.textContent = `.qpanel{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:8px;z-index:4;padding:12px 14px}
.qn{min-width:40px;height:40px;padding:0 6px;border:1px solid #4a90c2;border-radius:10px;background:transparent;color:#4a90c2;font-weight:700;font-size:15px;cursor:pointer}
.qn.cur{border-width:3px}
.qn.done{background:#4a90c2;color:#fff}
.qnav{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}
.qsaved{font-size:14px;color:#2e9e5b}`;
  document.head.appendChild(st);

  /* ================= дата ================= */
  const fmtDT = iso => new Date(iso).toLocaleString('uk-UA',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /* ================= нумерація уроків ================= */
  function decorate(html, rows) {
    for (const l of rows) {
      if (!l.lesson_no) continue;
      const idx = html.indexOf('/' + l.id + '"');
      if (idx < 0) continue;
      const b = html.lastIndexOf('<b>', idx);
      if (b < 0) continue;
      const e = html.indexOf('</b>', b);
      if (e < 0 || e > idx) continue;
      const title = html.slice(b + 3, e);
      html = html.slice(0, b)
        + `<div><b>№${l.lesson_no}. ${title}</b><div class="muted small">🕒 Додано: ${fmtDT(l.created_at)}</div></div>`
        + html.slice(e + 4);
    }
    return html;
  }

  if (typeof studentList === 'function') {
    const baseList = studentList;
    window.studentList = async function () {
      const html = await baseList.apply(this, arguments);
      try {
        const r = await sb.from('lessons').select('id,lesson_no,created_at');
        return r.error ? html : decorate(html, r.data);
      } catch (e) { return html; }
    };
  }

  if (typeof staffLessons === 'function') {
    const baseLessons = staffLessons;
    window.staffLessons = async function (sid) {
      const html = await baseLessons.apply(this, arguments);
      try {
        const r = await sb.from('lessons').select('id,lesson_no,created_at').eq('student_id', sid);
        return r.error ? html : decorate(html, r.data);
      } catch (e) { return html; }
    };
  }

  async function lessonMeta(lid) {
    const r = await sb.from('lessons').select('lesson_no,created_at').eq('id', lid).single();
    return r.error ? null : r.data;
  }

  const baseStudentL = studentLesson;
  window.studentLesson = async function (lid) {
    let html = await baseStudentL.apply(this, arguments);
    try {
      const m = await lessonMeta(lid);
      if (!m || typeof html !== 'string') return html;
      const a = html.indexOf('<h2>');
      const z = a < 0 ? -1 : html.indexOf('</h2>', a);
      if (z < 0) return html;
      html = html.slice(0, a + 4) + (m.lesson_no ? `Урок №${m.lesson_no}. ` : '') + html.slice(a + 4, z + 5)
        + `<div class="muted small" style="margin-top:4px">🕒 Додано: ${fmtDT(m.created_at)}</div>` + html.slice(z + 5);
    } catch (e) { /* без змін */ }
    return html;
  };

  const baseStaffL = staffLesson;
  window.staffLesson = async function (sid, lid) {
    let html = await baseStaffL.apply(this, arguments);
    try {
      const m = await lessonMeta(lid);
      const tag = '<h2 style="margin:0">Урок</h2>';
      if (!m || typeof html !== 'string' || !html.includes(tag)) return html;
      html = html.replace(tag, () => `<h2 style="margin:0">Урок${m.lesson_no ? ' №' + m.lesson_no : ''} <span class="muted small" style="font-weight:400">· 🕒 Додано: ${fmtDT(m.created_at)}</span></h2>`);
    } catch (e) { /* без змін */ }
    return html;
  };

  /* ================= тест: панель номерів ================= */
  const KEY = lid => 'ms_test_' + lid;
  const MAXAGE = 12 * 3600 * 1000;

  function load(lid) {
    try {
      const o = JSON.parse(localStorage.getItem(KEY(lid)) || 'null');
      if (o && Date.now() - o.t < MAXAGE) return o;
    } catch (e) { /* порожньо */ }
    return { t: Date.now(), a: {}, s: [], i: 0 };
  }
  function store(lid, o) {
    o.t = Date.now();
    try { localStorage.setItem(KEY(lid), JSON.stringify(o)); } catch (e) { /* ігноруємо */ }
  }
  function clear(lid) { try { localStorage.removeItem(KEY(lid)); } catch (e) { /* ігноруємо */ } }

  function getVal(card) {
    const t = card.dataset.t;
    if (t === 'multiple') return [...card.querySelectorAll('input:checked')].map(c => c.value);
    if (t === 'single' || t === 'truefalse') { const c = card.querySelector('input:checked'); return c ? c.value : null; }
    const el = card.querySelector('input,textarea');
    return el ? el.value : '';
  }
  function setVal(card, v) {
    const t = card.dataset.t;
    if (t === 'multiple') card.querySelectorAll('input').forEach(c => { c.checked = [].concat(v || []).includes(c.value); });
    else if (t === 'single' || t === 'truefalse') card.querySelectorAll('input').forEach(c => { c.checked = (c.value === v); });
    else { const el = card.querySelector('input,textarea'); if (el && v) el.value = v; }
  }
  const has = v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'string' && !v.trim());

  function enhance(form) {
    const cards = [...form.querySelectorAll('[data-q]')];
    if (!cards.length) return;
    form.dataset.wiz = '1';
    const lid = form.dataset.lid, state = load(lid);
    const saved = new Set(state.s);
    let cur = Math.min(Math.max(+state.i || 0, 0), cards.length - 1);

    cards.forEach(c => { const v = state.a[c.dataset.q]; if (v !== undefined) setVal(c, v); });

    const panel = document.createElement('div');
    panel.className = 'card qpanel';
    cards.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qn'; b.textContent = i + 1;
      b.addEventListener('click', () => go(i));
      panel.appendChild(b);
    });
    form.insertBefore(panel, form.firstChild);
    const timer = document.getElementById('timer');
    if (timer && timer.closest('.card')) panel.style.top = (timer.closest('.card').offsetHeight + 16) + 'px';

    cards.forEach((c, i) => {
      const nav = document.createElement('div');
      nav.className = 'qnav';
      nav.innerHTML = (i > 0 ? '<button type="button" class="btn small secondary" data-w="prev">← Назад</button>' : '')
        + '<button type="button" class="btn small" data-w="save">Зберегти відповідь</button>'
        + (i < cards.length - 1 ? '<button type="button" class="btn small secondary" data-w="next">Далі →</button>' : '')
        + '<span class="qsaved" hidden>✓ Збережено</span>';
      c.appendChild(nav);
      nav.addEventListener('click', ev => {
        const w = ev.target.getAttribute && ev.target.getAttribute('data-w');
        if (w === 'prev') go(i - 1);
        else if (w === 'next') go(i + 1);
        else if (w === 'save') { commit(i); persist(); paint(); if (typeof toast === 'function') toast('Відповідь збережено'); }
      });
    });

    function commit(i) {
      const c = cards[i];
      if (has(getVal(c))) saved.add(c.dataset.q); else saved.delete(c.dataset.q);
    }
    function persist() {
      const a = {};
      cards.forEach(c => { const v = getVal(c); if (has(v)) a[c.dataset.q] = v; });
      store(lid, { a, s: [...saved], i: cur });
    }
    function paint() {
      cards.forEach((c, i) => {
        c.style.display = i === cur ? '' : 'none';
        const ok = saved.has(c.dataset.q) && has(getVal(c));
        const btn = panel.children[i];
        btn.classList.toggle('cur', i === cur);
        btn.classList.toggle('done', ok);
        c.querySelector('.qsaved').hidden = !ok;
      });
    }
    function go(i) {
      if (i < 0 || i >= cards.length) return;
      commit(cur);
      cur = i;
      persist(); paint();
      const top = form.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }

    const touch = ev => {
      const c = ev.target.closest && ev.target.closest('[data-q]');
      if (c) saved.delete(c.dataset.q);
      persist(); paint();
    };
    form.addEventListener('input', touch);
    form.addEventListener('change', touch);

    // перед відправкою: нагадуємо про невідповідані завдання (при автовідправці по таймеру не питаємо)
    form.addEventListener('submit', ev => {
      commit(cur); persist();
      if (S.test && S.test.sent) return;
      const empty = cards.map((c, i) => has(getVal(c)) ? 0 : i + 1).filter(Boolean);
      if (empty.length && !window.confirm('Без відповіді: №' + empty.join(', №') + '. Відправити тест?')) {
        ev.preventDefault(); ev.stopImmediatePropagation();
      }
    }, true);

    paint();
  }

  // після успішної здачі стираємо збережені відповіді
  const rpc0 = sb.rpc;
  sb.rpc = async function (name, args) {
    const r = await rpc0.apply(this, arguments);
    if (name === 'submit_attempt' && args && args.p_lesson && !r.error) clear(args.p_lesson);
    return r;
  };

  let timer = null;
  const obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      document.querySelectorAll('form[data-form="attempt"]:not([data-wiz])').forEach(enhance);
    }, 60);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  if (S.profile) renderApp();
})();
