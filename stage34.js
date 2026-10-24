/* MathSpace Stage 34 — teacher opens a lesson as the student sees it; "Редагувати" button at the bottom.
   No SQL. Load LAST (after stage31.js and stage32.js), so it wraps every other staffLesson wrapper. */
(function () {
  'use strict';
  if (window.__ms34) return;
  window.__ms34 = true;
  if (typeof window.staffLesson !== 'function' || typeof window.studentLesson !== 'function'
      || typeof A === 'undefined' || typeof F === 'undefined') {
    console.error('MathSpace Stage 34: staffLesson/studentLesson not found. Check script order.');
    return;
  }
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseStaff = window.staffLesson;
  let editing = null;                       // id уроку, який зараз у режимі редагування

  // Вийшли зі сторінки уроку — наступного разу знову відкриється перегляд
  window.addEventListener('hashchange', () => {
    if (editing && !location.hash.endsWith('/' + editing)) editing = null;
  });

  F.ms34off = async function () { /* у режимі перегляду відповіді не надсилаються */ };
  A.ms34edit = async function (el) {
    editing = el.dataset.lid;
    renderApp();
    window.scrollTo({ top: 0 });
  };
  A.ms34preview = async function () {
    editing = null;
    renderApp();
    window.scrollTo({ top: 0 });
  };

  window.staffLesson = async function (sid, lid) {
    if (editing && editing !== lid) editing = null;
    if (editing === lid) {
      const page = await baseStaff.apply(this, arguments);
      if (typeof page !== 'string') return page;
      return `<div class="card"><button type="button" class="btn secondary small" data-act="ms34preview">👁 Переглянути як учень</button></div>` + page;
    }

    let html = await window.studentLesson(lid);
    if (typeof html !== 'string') return html;

    // Порожній урок (щойно створений): одразу режим редагування, бо дивитися ще нема на що
    if (!html.includes('data-q="') && !html.includes('Домашнє завдання')) {
      editing = lid;
      return window.staffLesson.apply(this, arguments);
    }

    let status = '';
    try {
      const r = await sb.from('lessons').select('status').eq('id', lid).single();
      if (!r.error && r.data) status = r.data.status;
    } catch (e) { /* не критично */ }

    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('r');

    // Посилання «назад» веде до уроків цього учня
    root.querySelectorAll('a[href="#/t/lessons"]').forEach(a => {
      a.setAttribute('href', '#/t/lessons/' + sid);
      a.textContent = '← До уроків учня';
    });
    // Спроби учня тут не потрібні: їх видно в режимі редагування
    root.querySelectorAll('.card').forEach(c => {
      const h = c.querySelector(':scope > h2');
      if (h && h.textContent.trim() === 'Мої спроби') c.remove();
    });
    // Форми лише для вигляду: нічого не надсилається
    root.querySelectorAll('form[data-form="attempt"],form[data-form="hwsubmit"]').forEach(f => {
      f.setAttribute('data-form', 'ms34off');
      f.querySelectorAll('input,textarea,select,button').forEach(el => { el.disabled = true; });
      f.querySelectorAll('button:not([type="button"])').forEach(b => b.remove());
    });

    const pill = status
      ? `<span class="pill ${status === 'published' ? 'green' : 'amber'}">${status === 'published' ? 'опубліковано' : 'чернетка: учень поки не бачить'}</span>`
      : '';
    const top = `<div class="notice small">👁 Так цей урок бачить учень. Відповіді тут не надсилаються. ${pill}</div>`;
    const bottom = `<div class="card"><button type="button" class="btn" data-act="ms34edit" data-lid="${escHtml(lid)}">✏️ Редагувати</button></div>`;
    return top + root.innerHTML + bottom;
  };
})();
