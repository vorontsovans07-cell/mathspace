/* MathSpace Stage 34 (v3) — lesson page for staff:
   · opens as the student sees it, with the teacher-only answers, student attempts and an "Edit" button at the bottom;
   · "Пройти тест як учень": a trial run of the test (nothing is saved, graded locally);
   · "Додати тест у бібліотеку": copies the lesson's test into the test library.
   No SQL. Load AFTER stage31/32 and BEFORE stage35 (it must wrap every other staffLesson wrapper). */
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
  const say = (m, bad) => { if (typeof toast === 'function') toast(m, !!bad); else alert(m); };
  const baseStaff = window.staffLesson;
  let editing = null, demo = false, curLid = null;
  const cache = {};                       // lid -> { qmap, kmap, krow }

  window.addEventListener('hashchange', () => {
    if (curLid && !location.hash.endsWith('/' + curLid)) { editing = null; demo = false; curLid = null; }
  });

  F.ms34off = async function () { /* перегляд: відповіді не надсилаються */ };
  A.ms34edit = async function (el) { editing = el.dataset.lid; demo = false; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34preview = async function () { editing = null; demo = false; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34demo = async function () { editing = null; demo = true; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34demooff = async function () { demo = false; renderApp(); window.scrollTo({ top: 0 }); };

  /* ---------- правильна відповідь у вигляді HTML ---------- */
  function answerBody(q, c) {
    if (q.qtype === 'single' || q.qtype === 'multiple') {
      return (q.options || []).map((o, j) =>
        `<div class="small">${(q.qtype === 'single' ? c === j : [].concat(c || []).includes(j)) ? '✅' : '▫️'} ${j + 1}. ${escHtml(o)}</div>`).join('');
    }
    if (q.qtype === 'truefalse') return `<div class="small">✅ ${c ? 'Правда' : 'Неправда'}</div>`;
    if (q.qtype === 'matching') return typeof MSMatch !== 'undefined' && MSMatch.mapping ? `<div class="small">${escHtml(MSMatch.mapping(c))}</div>` : '';
    if (q.qtype === 'short') return `<div class="small">✅ ${escHtml([].concat(c || []).join(' | '))}</div>`;
    return '<div class="muted small">Розгорнуту відповідь перевіряє викладач вручну</div>';
  }

  /* ---------- ключі тесту (кеш) ---------- */
  async function loadKeys(lid, ids) {
    const [qr, kr] = await Promise.all([
      sb.from('questions').select('*').eq('lesson_id', lid),
      sb.from('question_keys').select('*').in('question_id', ids)]);
    if (qr.error || kr.error) throw (qr.error || kr.error);
    const d = {
      qmap: Object.fromEntries(qr.data.map(x => [x.id, x])),
      krow: Object.fromEntries(kr.data.map(x => [x.question_id, x])),
      kmap: Object.fromEntries(kr.data.map(x => [x.question_id, x.correct]))
    };
    cache[lid] = d;
    return d;
  }

  /* ---------- відповіді тесту й розв'язання ДЗ у перегляді ---------- */
  async function addAnswers(doc, root, lid, show) {
    const cards = [...root.querySelectorAll('[data-q]')];
    if (cards.length) {
      try {
        const d = await loadKeys(lid, cards.map(c => c.getAttribute('data-q')));
        if (show) cards.forEach(card => {
          const q = d.qmap[card.getAttribute('data-q')];
          if (!q) return;
          let body = answerBody(q, d.kmap[q.id]);
          const expl = q.explanation || (d.krow[q.id] && d.krow[q.id].explanation);
          if (expl) body += `<div class="muted small" style="margin-top:6px">Пояснення: ${escHtml(expl)}</div>`;
          const box = doc.createElement('div');
          box.className = 'notice ms34-ans';
          box.innerHTML = '<b class="small">Відповідь (бачите лише ви)</b>' + body;
          card.appendChild(box);
        });
      } catch (e) {
        const w = doc.createElement('div');
        w.className = 'notice warn small';
        w.textContent = 'Не вдалося завантажити правильні відповіді: ' + (e && e.message ? e.message : e);
        root.insertBefore(w, root.firstChild);
        console.warn('MathSpace Stage 34 answers:', e);
      }
    }
    const exs = [...root.querySelectorAll('.hw-exercise')];
    if (show && exs.length && window.__msHw) {
      try {
        const [hr, sols] = await Promise.all([
          sb.from('lesson_homework').select('exercises').eq('lesson_id', lid).maybeSingle(),
          window.__msHw.solutionsOf(lid)]);
        const list = window.__msHw.safeExercises(hr.data && hr.data.exercises);
        exs.forEach((el, i) => {
          const x = list[i];
          if (!x) return;
          const dt = doc.createElement('details');
          dt.className = 'hw-sol';
          dt.innerHTML = '<summary><b class="small">Розв’язання (бачите лише ви)</b></summary><div class="hw-sol-body"><div class="hw-sol-text" data-empty="Розв’язання ще не додано."></div></div>';
          dt.querySelector('.hw-sol-text').textContent = String((x.id && sols[x.id]) || '');
          el.appendChild(dt);
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

  /* ---------- пробне проходження тесту (нічого не зберігається) ---------- */
  const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  F.ms34demo = async function (form) {
    const d = cache[form.dataset.lid];
    if (!d) throw new Error('Дані тесту ще не завантажені. Оновіть сторінку.');
    let got = 0, max = 0, manual = 0, right = 0, total = 0;
    form.querySelectorAll('.ms34-res,.ms34-sum').forEach(x => x.remove());
    form.querySelectorAll('[data-q]').forEach(card => {
      const id = card.dataset.q, t = card.dataset.t, q = d.qmap[id];
      if (!q) return;
      const pts = Number(q.points) || 0, c = d.kmap[id];
      let ok = null;
      if (t === 'matching') {
        const a = MSMatch.collect(card);
        ok = Array.isArray(c) && a.length === c.length && a.every((v, i) => v !== null && v === c[i]);
      } else if (t === 'multiple') {
        const a = [...card.querySelectorAll('input:checked')].map(x => Number(x.value)).sort((x, y) => x - y);
        const cc = [].concat(c || []).map(Number).sort((x, y) => x - y);
        ok = a.length === cc.length && a.every((v, i) => v === cc[i]);
      } else if (t === 'single') {
        const x = card.querySelector('input:checked'); ok = !!x && Number(x.value) === Number(c);
      } else if (t === 'truefalse') {
        const x = card.querySelector('input:checked'); ok = !!x && (x.value === 'true') === !!c;
      } else if (t === 'short') {
        const v = norm(card.querySelector('input').value);
        ok = !!v && [].concat(c || []).some(z => norm(z) === v);
      }
      const res = document.createElement('div');
      res.className = 'notice small ms34-res';
      if (ok === null) { manual += pts; res.textContent = 'Розгорнуту відповідь у справжньому тесті перевіряє викладач.'; }
      else {
        max += pts; total++;
        if (ok) { got += pts; right++; res.innerHTML = '✅ Правильно'; }
        else { res.classList.add('warn'); res.innerHTML = '❌ Неправильно. Правильна відповідь:' + answerBody(q, c); }
      }
      card.appendChild(res);
    });
    form.querySelectorAll('input,textarea,select').forEach(el => { el.disabled = true; });
    const sum = document.createElement('div');
    sum.className = 'card ms34-sum';
    sum.innerHTML = `<h2>Пробний результат: ${got} / ${max} б. (${right} з ${total} правильно)</h2>`
      + `<p class="muted small">Це перевірка в пробному режимі, нічого не збережено.${manual ? ' Розгорнуті відповіді (' + manual + ' б.) не враховано.' : ''} Короткі відповіді порівнюються спрощено.</p>`;
    form.insertBefore(sum, form.firstChild);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- додати тест уроку в бібліотеку тестів ---------- */
  A.ms34tolib = async function (el) {
    const lid = el.dataset.lid;
    const l = await sb.from('lessons').select('title,description,time_limit_minutes').eq('id', lid).single();
    if (l.error) throw l.error;
    const qs = await sb.from('questions').select('*').eq('lesson_id', lid).order('sort_order');
    if (qs.error) throw qs.error;
    if (!qs.data.length) throw new Error('У цьому уроці ще немає завдань тесту.');
    if (!confirm(`Додати тест «${l.data.title}» (завдань: ${qs.data.length}) до бібліотеки тестів? Урок залишиться без змін.`)) return;
    el.disabled = true;
    const uploaded = [];
    let testId = null;
    try {
      const kr = await sb.from('question_keys').select('*').in('question_id', qs.data.map(x => x.id));
      if (kr.error) throw kr.error;
      const keys = Object.fromEntries(kr.data.map(x => [x.question_id, x]));
      const t = await sb.from('library_tests')
        .insert({ title: l.data.title, time_limit_minutes: l.data.time_limit_minutes || null }).select('id').single();
      if (t.error) throw t.error;
      testId = t.data.id;
      if (l.data.description) { try { await sb.from('library_tests').update({ description: l.data.description }).eq('id', testId); } catch (e) { /* не критично */ } }
      let imgWarn = 0;
      const rows = [];
      for (let i = 0; i < qs.data.length; i++) {
        const q = qs.data[i], k = keys[q.id] || {};
        let image_path = null;
        if (q.image_path) {
          try {
            const dl = await sb.storage.from('lessons').download(q.image_path);
            if (dl.error) throw dl.error;
            const path = `${S.profile.id}/${testId}/q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const up = await sb.storage.from('library-test-images').upload(path, dl.data, { contentType: dl.data.type || 'image/jpeg', upsert: false });
            if (up.error) throw up.error;
            uploaded.push(path); image_path = path;
          } catch (e) { imgWarn++; }
        }
        rows.push({ test_id: testId, qtype: q.qtype, prompt: q.prompt, options: q.options ?? null,
          correct: k.correct === undefined ? null : k.correct, points: Number(q.points) || 1,
          explanation: k.explanation || q.explanation || null, sort_order: i + 1, image_path });
      }
      const ins = await sb.from('library_questions').insert(rows);
      if (ins.error) throw ins.error;
      say(`Тест додано до бібліотеки: ${rows.length} завдань${imgWarn ? `, малюнків не скопійовано: ${imgWarn}` : ''}`, !!imgWarn);
      location.hash = '#/t/library/' + testId;
    } catch (e) {
      if (testId) { try { await sb.from('library_tests').delete().eq('id', testId); } catch (x) { /* ignore */ } }
      if (uploaded.length) { try { await sb.storage.from('library-test-images').remove(uploaded); } catch (x) { /* ignore */ } }
      throw e;
    } finally { if (el.isConnected) el.disabled = false; }
  };

  const libBtn = lid => `<button type="button" class="btn secondary" data-act="ms34tolib" data-lid="${escHtml(lid)}">📚 Додати тест у бібліотеку</button>`;

  /* ---------- сторінка уроку ---------- */
  window.staffLesson = async function (sid, lid) {
    curLid = lid;
    if (editing && editing !== lid) editing = null;
    if (editing === lid) {
      const page = await baseStaff.apply(this, arguments);
      if (typeof page !== 'string') return page;
      return `<div class="card flex"><button type="button" class="btn secondary small" data-act="ms34preview">👁 Переглянути як учень</button>${libBtn(lid).replace('class="btn secondary"', 'class="btn secondary small"')}</div>` + page;
    }

    let html = await window.studentLesson(lid);
    if (typeof html !== 'string') return html;

    // Порожній урок: одразу режим редагування, бо дивитися ще нема на що
    if (!html.includes('data-q="') && !html.includes('Домашнє завдання')) {
      editing = lid; demo = false;
      return window.staffLesson.apply(this, arguments);
    }

    let status = '';
    try {
      const r = await sb.from('lessons').select('status').eq('id', lid).single();
      if (!r.error && r.data) status = r.data.status;
    } catch (e) { /* не критично */ }

    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('r');
    const hadTest = !!root.querySelector('form[data-form="attempt"]');

    root.querySelectorAll('a[href="#/t/lessons"]').forEach(a => {
      a.setAttribute('href', '#/t/lessons/' + sid);
      a.textContent = '← До уроків учня';
    });
    // власна історія «Мої спроби» не потрібна, замість неї нижче буде огляд спроб учня
    root.querySelectorAll('.card').forEach(c => {
      const h = c.querySelector(':scope > h2');
      if (h && h.textContent.trim() === 'Мої спроби') c.remove();
    });
    root.querySelectorAll('form[data-form="hwsubmit"]').forEach(f => {
      f.setAttribute('data-form', 'ms34off');
      f.querySelectorAll('input,textarea,select,button').forEach(el => { el.disabled = true; });
      f.querySelectorAll('button:not([type="button"])').forEach(b => b.remove());
    });
    root.querySelectorAll('form[data-form="attempt"]').forEach(f => {
      if (demo) {
        f.setAttribute('data-form', 'ms34demo');
        const b = f.querySelector('button:not([type="button"])');
        if (b) b.textContent = 'Завершити пробний тест';
      } else {
        f.setAttribute('data-form', 'ms34off');
        f.querySelectorAll('input,textarea,select,button').forEach(el => { el.disabled = true; });
        f.querySelectorAll('button:not([type="button"])').forEach(b => b.remove());
      }
    });

    await addAnswers(doc, root, lid, !demo);

    // Огляд спроб учня: беремо готовий блок зі сторінки редагування
    let attempts = '';
    if (!demo) {
      try {
        const editHtml = await baseStaff.apply(this, arguments);
        if (typeof editHtml === 'string') {
          const ed = new DOMParser().parseFromString('<div id="e">' + editHtml + '</div>', 'text/html');
          const card = [...ed.querySelectorAll('.card')].find(c => {
            const h = c.querySelector(':scope > h2');
            return h && /^Спроби/i.test(h.textContent.trim());
          });
          if (card) attempts = card.outerHTML;
        }
      } catch (e) { console.warn('MathSpace Stage 34 attempts:', e); }
    }

    const pill = status
      ? `<span class="pill ${status === 'published' ? 'green' : 'amber'}">${status === 'published' ? 'опубліковано' : 'чернетка: учень поки не бачить'}</span>`
      : '';
    const top = demo
      ? `<div class="notice small">▶ Пробний режим: так учень проходить тест. Відповіді нічого не змінюють і не зберігаються. <button type="button" class="btn small secondary" data-act="ms34demooff" style="margin-left:8px">Вийти з пробного режиму</button></div>`
      : `<div class="notice small">👁 Так цей урок бачить учень (з правильними відповідями, їх бачите лише ви). Відповіді тут не надсилаються. ${pill}
          ${hadTest ? '<button type="button" class="btn small" data-act="ms34demo" style="margin-left:8px">▶ Пройти тест як учень</button>' : ''}</div>`;
    const bottom = demo ? '' : `${attempts}<div class="card flex"><button type="button" class="btn" data-act="ms34edit" data-lid="${escHtml(lid)}">✏️ Редагувати</button>${hadTest ? libBtn(lid) : ''}</div>`;
    return top + root.innerHTML + bottom;
  };
})();
