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
  let editing = null, demo = false, curLid = null, mode = 'preview', attId = null;
  const cache = {};                       // lid -> { qmap, kmap, krow }

  window.addEventListener('hashchange', () => {
    if (curLid && !location.hash.endsWith('/' + curLid)) { editing = null; demo = false; curLid = null; mode = 'preview'; attId = null; }
  });

  F.ms34off = async function () { /* перегляд: відповіді не надсилаються */ };
  A.ms34edit = async function (el) { editing = el.dataset.lid; demo = false; mode = 'preview'; attId = null; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34preview = async function () { editing = null; demo = false; mode = 'preview'; attId = null; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34demo = async function () { editing = null; demo = true; mode = 'preview'; attId = null; renderApp(); window.scrollTo({ top: 0 }); };

  A.ms34att = async function () { editing = null; demo = false; mode = 'attempts'; attId = null; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34attopen = async function (el) { mode = 'attempts'; attId = el.dataset.id; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34attback = async function () { if (attId) attId = null; else mode = 'preview'; renderApp(); window.scrollTo({ top: 0 }); };
  A.ms34demooff = async function () { demo = false; mode = 'preview'; attId = null; renderApp(); window.scrollTo({ top: 0 }); };

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


  /* Справжня сторінка учня ховає тест за кнопкою «Розпочати тест» (її може натискати лише учень).
     Для викладача будуємо таку саму форму завдань напряму. */
  async function buildTest(lid) {
    if (typeof qInput !== 'function') return '';
    const r = await sb.from('questions').select('*').eq('lesson_id', lid).order('sort_order');
    if (r.error || !r.data.length) return '';
    let urlBy = {};
    const paths = r.data.map(x => x.image_path).filter(Boolean);
    if (paths.length) {
      try {
        const u = await sb.storage.from('lessons').createSignedUrls(paths, 3600);
        urlBy = Object.fromEntries((u.data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
      } catch (e) { /* без малюнків */ }
    }
    return `<form data-form="attempt" data-lid="${escHtml(lid)}">${r.data.map((x, i) =>
      `<div class="card" data-q="${escHtml(x.id)}" data-t="${escHtml(x.qtype)}"><div class="flex"><b>${i + 1}.</b><span class="pill blue">${Number(x.points)} б.</span></div>`
      + `<p style="white-space:pre-wrap">${escHtml(x.prompt)}</p>`
      + (x.image_path && urlBy[x.image_path] ? `<img class="qimg" src="${escHtml(urlBy[x.image_path])}" alt="Малюнок до завдання">` : '')
      + `${qInput(x)}</div>`).join('')}<button class="btn">Відправити відповіді</button></form>`;
  }


  /* ---------- спроби учня: список за датою й часом + розбір однієї спроби ---------- */
  const LET = 'АБВГДЕЄЖЗИ';
  const when = iso => new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pv = raw => {
    if (typeof raw !== 'string') return raw;
    const t = raw.trim();
    if (!t || t === '—') return null;
    try { return JSON.parse(t); } catch (e) { return raw; }
  };
  const mark = (pick, right) => pick && right ? '✅' : pick ? '❌' : right ? '✔️' : '▫️';
  const optRow = (txt, pick, right) => {
    const cls = pick && right ? 'ok pick' : pick ? 'bad pick' : right ? 'ok' : '';
    const tag = pick && right ? 'обрав(ла) · правильно' : pick ? 'обрав(ла) · неправильно' : right ? 'правильна відповідь' : '';
    return `<div class="ms36-opt ${cls}">${mark(pick, right)} ${txt}${tag ? `<span class="ms36-tag">${tag}</span>` : ''}</div>`;
  };
  function answerView(a, q, c) {
    const t = a.snapshot && a.snapshot.type;
    const raw = a.answer;
    if (t === 'long' || t === 'photo') {
      const max = Number(a.snapshot.points) || 0;
      return `<div class="notice" style="white-space:pre-wrap">${escHtml(raw ?? '—')}</div>`
        + `<form data-form="review" data-id="${escHtml(a.id)}" class="flex"><input name="pts" type="number" min="0" max="${max}" step="0.5" required value="${a.points_awarded ?? ''}" placeholder="бали (макс. ${max})" style="width:170px">`
        + `<input name="c" maxlength="2000" value="${escHtml(a.teacher_comment || '')}" placeholder="коментар" style="flex:1;min-width:160px"><button class="btn small">Зберегти</button></form>`;
    }
    if (t === 'short') {
      const v = typeof raw === 'string' ? raw : (raw == null ? '' : String(raw));
      const good = q ? [].concat(c || []).join(' | ') : '';
      return `<div class="small">Відповідь учня: <b>${v ? escHtml(v) : '— (без відповіді)'}</b></div>` + (q ? `<div class="muted small">Правильно: ${escHtml(good)}</div>` : '');
    }
    const v = pv(raw);
    const answered = !(v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length));
    if (!q) return `<div class="muted small">Завдання змінено після спроби, варіанти недоступні. Відповідь учня: ${escHtml(JSON.stringify(v))}</div>`;
    if (t === 'single' || t === 'multiple') {
      const rows = (q.options || []).map((o, j) => {
        const pick = answered && (t === 'single' ? Number(v) === j : [].concat(v).map(Number).includes(j));
        const right = t === 'single' ? c === j : [].concat(c || []).includes(j);
        return optRow(`${j + 1}. ${escHtml(o)}`, pick, right);
      }).join('');
      return `<div class="ms36-list">${rows}${answered ? '' : '<div class="ms36-none">Учень не відповів</div>'}</div>`;
    }
    if (t === 'truefalse') {
      const sv = v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
      return `<div class="ms36-list">${optRow('Правда', sv === true, c === true)}${optRow('Неправда', sv === false, c === false)}${sv === null ? '<div class="ms36-none">Учень не відповів</div>' : ''}</div>`;
    }
    if (t === 'matching') {
      const o = q.options || {}, left = o.left || [], right = o.right || [];
      const sv = Array.isArray(v) ? v : [], cc = Array.isArray(c) ? c : [];
      const nm = j => j === -1 ? 'немає відповідності' : (Number.isInteger(j) && right[j] !== undefined ? (LET[j] || j + 1) + '. ' + escHtml(right[j]) : '—');
      const cols = typeof MSMatch !== 'undefined' && MSMatch.columns ? MSMatch.columns(o) : '';
      const rows = left.map((tx, i) => {
        const has = sv[i] !== undefined && sv[i] !== null, ok = has && Number(sv[i]) === cc[i];
        return `<div class="ms36-opt ${ok ? 'ok pick' : has ? 'bad pick' : ''}">${ok ? '✅' : '❌'} ${i + 1}. ${escHtml(tx)} → <b>${has ? nm(Number(sv[i])) : 'без відповіді'}</b><span class="ms36-tag">${ok ? 'правильно' : 'правильно: ' + nm(cc[i])}</span></div>`;
      }).join('');
      return `<div class="ms36-list">${cols}${rows}</div>`;
    }
    return `<div class="muted small">${escHtml(JSON.stringify(v))}</div>`;
  }

  async function attemptsPage(sid, lid) {
    const back = `<div class="card flex"><button type="button" class="btn secondary small" data-act="ms34attback">← ${attId ? 'До списку спроб' : 'До уроку'}</button></div>`;
    const l = await sb.from('lessons').select('title').eq('id', lid).single();
    const title = l.data ? l.data.title : 'Урок';
    const at = await sb.from('attempts').select('*').eq('lesson_id', lid).order('created_at', { ascending: false }).limit(100);
    if (at.error) throw at.error;
    if (!attId) {
      const rows = at.data.map(t => {
        const sc = (+t.auto_score || 0) + (+t.manual_score || 0);
        const done = t.status === 'graded';
        return `<div class="row"><span><b>${escHtml(when(t.created_at))}</b></span><div class="end"><span class="pill ${done ? 'green' : 'amber'}">${sc} / ${t.max_score}${done ? '' : ' · чекає перевірки'}</span><button type="button" class="btn small" data-act="ms34attopen" data-id="${escHtml(t.id)}">Відкрити</button></div></div>`;
      }).join('') || '<div class="empty">Спроб ще не було.</div>';
      return back + `<div class="card"><h2>Спроби учня</h2><p class="muted small">${escHtml(title)}. Обрана спроба відкриється повністю: усі завдання, відповіді учня й правильні відповіді.</p>${rows}</div>`;
    }
    const t = at.data.find(x => x.id === attId);
    if (!t) { attId = null; return attemptsPage(sid, lid); }
    const [qr, ar] = await Promise.all([
      sb.from('questions').select('*').eq('lesson_id', lid).order('sort_order'),
      sb.from('attempt_answers').select('*').eq('attempt_id', attId)]);
    if (qr.error) throw qr.error;
    if (ar.error) throw ar.error;
    let keys = {};
    if (qr.data.length) {
      const kr = await sb.from('question_keys').select('*').in('question_id', qr.data.map(x => x.id));
      if (!kr.error) keys = Object.fromEntries(kr.data.map(x => [x.question_id, x.correct]));
    }
    const list = ar.data.slice().sort((a, b) => (a.snapshot.sort_order || 0) - (b.snapshot.sort_order || 0));
    const sc = (+t.auto_score || 0) + (+t.manual_score || 0), done = t.status === 'graded';
    const cards = list.map((a, i) => {
      const sn = a.snapshot || {};
      const q = (a.question_id && qr.data.find(x => x.id === a.question_id))
        || qr.data.find(x => x.prompt === sn.prompt) || null;
      const max = Number(sn.points) || 0, pa = a.points_awarded;
      const badge = pa === null || pa === undefined ? '⏳' : Number(pa) >= max ? '✅' : Number(pa) > 0 ? '⚠️' : '❌';
      return `<div class="card"><div class="flex"><b>${i + 1}.</b> ${badge}<span class="pill blue">${pa === null || pa === undefined ? '—' : pa} / ${max} б.</span></div>`
        + `<p style="white-space:pre-wrap">${escHtml(sn.prompt)}</p>${answerView(a, q, q ? keys[q.id] : null)}</div>`;
    }).join('') || '<div class="card"><div class="empty">У цій спробі немає відповідей.</div></div>';
    return back + `<div class="card"><h2>Спроба від ${escHtml(when(t.created_at))}</h2><span class="pill ${done ? 'green' : 'amber'}">${sc} / ${t.max_score}${done ? '' : ' · чекає перевірки'}</span></div>` + cards;
  }

  const libBtn = lid => `<button type="button" class="btn secondary" data-act="ms34tolib" data-lid="${escHtml(lid)}">📚 Додати тест у бібліотеку</button>`;

  /* ---------- сторінка уроку ---------- */
  window.staffLesson = async function (sid, lid) {
    curLid = lid;
    if (mode === 'attempts') return attemptsPage(sid, lid);
    if (editing && editing !== lid) editing = null;
    if (editing === lid) {
      const page = await baseStaff.apply(this, arguments);
      if (typeof page !== 'string') return page;
      return `<div class="card flex"><button type="button" class="btn secondary small" data-act="ms34preview">👁 Переглянути як учень</button>${libBtn(lid).replace('class="btn secondary"', 'class="btn secondary small"')}</div>` + page;
    }

    let html = await window.studentLesson(lid);
    if (typeof html !== 'string') return html;

    // Порожній урок: одразу режим редагування, бо дивитися ще нема на що
    if (!html.includes('data-q="') && !html.includes('Розпочати тест') && !html.includes('Домашнє завдання')) {
      editing = lid; demo = false;
      return window.staffLesson.apply(this, arguments);
    }

    let status = '', limit = null;
    try {
      const r = await sb.from('lessons').select('status,time_limit_minutes').eq('id', lid).single();
      if (!r.error && r.data) { status = r.data.status; limit = r.data.time_limit_minutes; }
    } catch (e) { /* не критично */ }

    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('r');
    const findGate = () => [...root.querySelectorAll('.card')].find(c => {
      const h = c.querySelector(':scope > h2');
      return h && h.textContent.trim() === 'Тест' && !c.querySelector('[data-q]');
    });
    let hadTest = false;
    if (demo) {
      // пробний режим: показуємо всі завдання, як у учня після «Розпочати тест»
      if (!root.querySelector('[data-q]')) {
        const gate = findGate();
        if (gate) {
          const built = await buildTest(lid);
          if (built) { gate.insertAdjacentHTML('beforebegin', built); gate.remove(); }
        }
      }
      hadTest = !!root.querySelector('form[data-form="attempt"]');
    } else {
      // звичайний перегляд: тест згорнуто в одну картку з кнопкою, завдання не розписуємо
      const form = root.querySelector('form[data-form="attempt"]');
      const gate = form ? null : findGate();
      const host = form || gate;
      if (host) {
        let n = form ? form.querySelectorAll('[data-q]').length : 0;
        if (!form) {
          const c = await sb.from('questions').select('id', { count: 'exact', head: true }).eq('lesson_id', lid);
          n = c.count || 0;
        }
        host.insertAdjacentHTML('beforebegin',
          `<div class="card"><h2>Тест</h2><p class="muted">Завдань: ${n} · ${limit ? 'ліміт часу ' + limit + ' хв' : 'без обмеження часу'}</p>`
          + `<button type="button" class="btn" data-act="ms34demo">▶ Пройти тест як учень</button></div>`);
        host.remove();
        hadTest = true;
      }
    }

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

    // Спроби учня: окрема кнопка
    let attempts = '';
    if (!demo) {
      try {
        const [all, wait] = await Promise.all([
          sb.from('attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', lid),
          sb.from('attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', lid).neq('status', 'graded')]);
        const n = all.count || 0, w = wait.count || 0;
        attempts = `<div class="card flex"><button type="button" class="btn secondary" data-act="ms34att">📋 Спроби учня (${n})</button>`
          + (w ? `<span class="pill amber">чекає перевірки: ${w}</span>` : '') + '</div>';
      } catch (e) { console.warn('MathSpace Stage 34 attempts:', e); }
    }

    const pill = status
      ? `<span class="pill ${status === 'published' ? 'green' : 'amber'}">${status === 'published' ? 'опубліковано' : 'чернетка: учень поки не бачить'}</span>`
      : '';
    const top = demo
      ? `<div class="notice small">▶ Пробний режим: так учень проходить тест. Відповіді нічого не змінюють і не зберігаються.${limit ? ` Ліміт часу в справжньому тесті: ${limit} хв (тут не діє).` : ''} <button type="button" class="btn small secondary" data-act="ms34demooff" style="margin-left:8px">Вийти з пробного режиму</button></div>`
      : `<div class="notice small">👁 Так цей урок бачить учень (правильні відповіді тесту дивіться в пробному проходженні, розв’язання ДЗ видно нижче й бачите лише ви). Відповіді тут не надсилаються.${limit ? ` Ліміт часу для учня: ${limit} хв.` : ''} ${pill}</div>`;
    const bottom = demo ? '' : `${attempts}<div class="card flex"><button type="button" class="btn" data-act="ms34edit" data-lid="${escHtml(lid)}">✏️ Редагувати</button>${hadTest ? libBtn(lid) : ''}</div>`;
    return top + root.innerHTML + bottom;
  };
})();
