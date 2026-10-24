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


  // Правильні відповіді тесту й розв'язання ДЗ: бачить лише викладач
  async function addAnswers(doc, root, lid) {
    const cards = [...root.querySelectorAll('[data-q]')];
    if (cards.length) {
      try {
        const ids = cards.map(c => c.getAttribute('data-q'));
        const [qr, kr] = await Promise.all([
          sb.from('questions').select('*').eq('lesson_id', lid),
          sb.from('question_keys').select('*').in('question_id', ids)]);
        if (qr.error || kr.error) throw (qr.error || kr.error);
        {
          const qmap = Object.fromEntries(qr.data.map(x => [x.id, x]));
          const krow = Object.fromEntries(kr.data.map(x => [x.question_id, x]));
          const kmap = Object.fromEntries(kr.data.map(x => [x.question_id, x.correct]));
          cards.forEach(card => {
            const q = qmap[card.getAttribute('data-q')];
            if (!q) return;
            const c = kmap[q.id];
            let body = '';
            if (q.qtype === 'single' || q.qtype === 'multiple') {
              body = (q.options || []).map((o, j) =>
                `<div class="small">${(q.qtype === 'single' ? c === j : (c || []).includes(j)) ? '✅' : '▫️'} ${j + 1}. ${escHtml(o)}</div>`).join('');
            } else if (q.qtype === 'truefalse') {
              body = `<div class="small">✅ ${c ? 'Правда' : 'Неправда'}</div>`;
            } else if (q.qtype === 'matching') {
              body = typeof MSMatch !== 'undefined' && MSMatch.mapping
                ? `<div class="small">${escHtml(MSMatch.mapping(c))}</div>` : '';
            } else if (q.qtype === 'short') {
              body = `<div class="small">✅ ${escHtml((c || []).join(' | '))}</div>`;
            } else {
              body = '<div class="muted small">Розгорнуту відповідь перевіряє викладач вручну</div>';
            }
            const expl = q.explanation || (krow[q.id] && krow[q.id].explanation);
            if (expl) body += `<div class="muted small" style="margin-top:6px">Пояснення: ${escHtml(expl)}</div>`;
            const box = doc.createElement('div');
            box.className = 'notice ms34-ans';
            box.innerHTML = '<b class="small">Відповідь (бачите лише ви)</b>' + body;
            card.appendChild(box);
          });
        }
      } catch (e) {
        const w = doc.createElement('div');
        w.className = 'notice warn small';
        w.textContent = 'Не вдалося завантажити правильні відповіді: ' + (e && e.message ? e.message : e);
        root.insertBefore(w, root.firstChild);
        console.warn('MathSpace Stage 34 answers:', e);
      }
    }
    const exs = [...root.querySelectorAll('.hw-exercise')];
    if (exs.length && window.__msHw) {
      try {
        const [hr, sols] = await Promise.all([
          sb.from('lesson_homework').select('exercises').eq('lesson_id', lid).maybeSingle(),
          window.__msHw.solutionsOf(lid)]);
        const list = window.__msHw.safeExercises(hr.data && hr.data.exercises);
        exs.forEach((el, i) => {
          const x = list[i];
          if (!x) return;
          const d = doc.createElement('details');
          d.className = 'hw-sol';
          d.innerHTML = '<summary><b class="small">Розв’язання (бачите лише ви)</b></summary><div class="hw-sol-body"><div class="hw-sol-text" data-empty="Розв’язання ще не додано."></div></div>';
          d.querySelector('.hw-sol-text').textContent = String((x.id && sols[x.id]) || '');
          el.appendChild(d);
        });
      } catch (e) {
        const w = doc.createElement('div');
        w.className = 'notice warn small';
        w.textContent = 'Не вдалося завантажити розв’язання ДЗ: ' + (e && e.message ? e.message : e);
        root.insertBefore(w, root.firstChild);
        console.warn('MathSpace Stage 34 solutions:', e);
      }
    }
  }

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

    await addAnswers(doc, root, lid);

    const pill = status
      ? `<span class="pill ${status === 'published' ? 'green' : 'amber'}">${status === 'published' ? 'опубліковано' : 'чернетка: учень поки не бачить'}</span>`
      : '';
    const top = `<div class="notice small">👁 Так цей урок бачить учень (з правильними відповідями, їх бачите лише ви). Відповіді тут не надсилаються. ${pill}</div>`;
    const bottom = `<div class="card"><button type="button" class="btn" data-act="ms34edit" data-lid="${escHtml(lid)}">✏️ Редагувати</button></div>`;
    return top + root.innerHTML + bottom;
  };
})();
