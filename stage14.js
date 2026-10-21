/* MathSpace · етап 14: вкладка «Бібліотека тестів» + публічне проходження тесту за посиланням без реєстрації.
   Підключається ПІСЛЯ stage13.js. Спершу виконайте 10_library.sql */
(function () {
  'use strict';
  S.libOpen = null; S.libAi = null;

  const link = tok => location.origin + location.pathname + '#/test/' + tok;
  const staffNow = () => S.profile && S.profile.role !== 'student';

  const css = document.createElement('style');
  css.textContent = `#pub-ov{position:fixed;inset:0;z-index:200;background:#f7f5fc;overflow:auto}
.pub-in{max-width:760px;margin:0 auto;padding:20px 16px 60px}
.pub-logo{font-weight:800;font-size:1.4rem;color:#6d4aff;margin:6px 0 16px}
.pub-timer{position:sticky;top:8px;z-index:3;padding:12px 18px}
.lib-link{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lib-link input{flex:1;min-width:220px}
.lib-q{border-top:1px solid #e3dfed;padding:12px 0}`;
  document.head.appendChild(css);

  /* ---------- вкладка ---------- */
  const baseTabs = tabs;
  window.tabs = function () {
    const t = baseTabs();
    if (S.profile && S.profile.role !== 'student' && !t.some(x => x[0] === 'library')) {
      const i = t.findIndex(x => x[0] === 'profile');
      t.splice(i < 0 ? t.length : i, 0, ['library', 'Бібліотека тестів', '🗂️']);
    }
    return t;
  };

  /* ---------- розбір форми завдання ---------- */
  function parseQ(f) {
    const fd = new FormData(f), t = fd.get('type'), c = String(fd.get('correct') || '').trim();
    if (t === 'matching') { const m = MSMatch.readForm(f); return { qtype:'matching', prompt:m.prompt, options:m.options, correct:m.correct, points:m.points, explanation:m.explanation || null }; }
    let options = null, correct = null;
    if (t === 'single' || t === 'multiple') {
      options = String(fd.get('options') || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (options.length < 2) throw new Error('додайте щонайменше 2 варіанти');
    }
    if (t === 'single') {
      correct = Number(c) - 1;
      if (!c || !Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new Error('вкажіть номер правильного варіанта');
    } else if (t === 'multiple') {
      correct = c.split(',').map(x => Number(x.trim()) - 1);
      if (!c || correct.some(x => !Number.isInteger(x) || x < 0 || x >= options.length)) throw new Error('вкажіть номери правильних варіантів через кому');
    } else if (t === 'truefalse') {
      const v = c.toLowerCase();
      if (['так', 'правда', 'true'].includes(v)) correct = true;
      else if (['ні', 'неправда', 'false'].includes(v)) correct = false;
      else throw new Error('вкажіть «так» або «ні»');
    } else if (t === 'short') {
      correct = c.split('|').map(x => x.trim()).filter(Boolean);
      if (!correct.length) throw new Error('вкажіть правильну відповідь');
    }
    const prompt = String(fd.get('prompt') || '').trim();
    if (!prompt) throw new Error('вкажіть умову');
    return { qtype: t, prompt, options, correct, points: Number(fd.get('points')) || 1, explanation: String(fd.get('expl') || '').trim() || null };
  }
  const cstr = q => {
    const c = q.correct;
    if (q.type === 'single') return String(c ?? '');
    if (q.type === 'multiple') return [].concat(c ?? []).join(',');
    if (q.type === 'truefalse') return c === true || c === 'true' ? 'так' : 'ні';
    if (q.type === 'short') return [].concat(c ?? []).join(' | ');
    return '';
  };
  const qForm = (q, tid, ai) => `<form data-form="libaddq" data-tid="${tid}"${ai ? ` data-ai="${q.id}"` : ''} style="${ai ? 'border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px' : ''}">
    <div class="two"><div class="field"><label>Тип</label><select name="type">${Object.entries(QT).map(([v, t]) => `<option value="${v}"${v === (q.type || 'single') ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label>Балів</label><input name="points" type="number" min="0.5" max="100" step="0.5" value="${Number(q.points) || 1}" required></div></div>
    <div class="field"><label>Умова (формули: $\\frac{1}{2}$)</label><textarea name="prompt" rows="3" required maxlength="4000">${esc(q.prompt || '')}</textarea></div>
    <div class="field"><label>Варіанти (кожен з нового рядка)</label><textarea name="options" rows="3">${esc(Array.isArray(q.options) ? q.options.join('\n') : '')}</textarea></div>
    <div class="field"><label>Правильна відповідь (один варіант: номер; кілька: 1,3; правда/неправда: так або ні; коротка: відповідь | інша відповідь)</label><input name="correct" value="${esc(ai && q.type !== 'matching' ? cstr(q) : '')}"></div>
    <div class="field"><label>Пояснення</label><input name="expl" maxlength="2000" value="${esc(q.explanation || '')}"></div>
    <div class="flex"><button class="btn small">${ai ? 'Додати в тест' : 'Додати завдання'}</button>${ai ? `<button type="button" class="btn small secondary" data-act="libaidrop" data-id="${q.id}">Відкинути</button>` : ''}</div></form>`;

  const fmtCorrect = q => {
    const c = q.correct;
    if (q.qtype === 'matching') return MSMatch.mapping(c);
    if (q.qtype === 'single') return String(c + 1);
    if (q.qtype === 'multiple') return [].concat(c || []).map(i => i + 1).join(', ');
    if (q.qtype === 'truefalse') return c ? 'Правда' : 'Неправда';
    if (q.qtype === 'short') return [].concat(c || []).join(' | ');
    return 'перевіряє викладач';
  };
  const fmtAns = (q, v) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '— (без відповіді)';
    const o = q.options || [];
    if (q.qtype === 'matching') return MSMatch.mapping(v);
    if (q.qtype === 'single') return o[v] !== undefined ? (v + 1) + '. ' + o[v] : String(v);
    if (q.qtype === 'multiple') return [].concat(v).map(i => o[i] !== undefined ? (i + 1) + '. ' + o[i] : String(i)).join('; ');
    if (q.qtype === 'truefalse') return v === true ? 'Правда' : 'Неправда';
    return String(v);
  };

  /* ---------- список тестів ---------- */
  async function libList() {
    const r = await sb.from('library_tests')
      .select('id,title,share_token,is_active,created_at,library_questions(count),library_attempts(count)')
      .order('created_at', { ascending: false });
    must(r);
    const rows = r.data.map(t => `<div class="row"><span><b>${esc(t.title)}</b>${t.is_active ? '' : ' <span class="pill amber">доступ закрито</span>'}<br>
      <span class="muted small">Завдань: ${t.library_questions[0] ? t.library_questions[0].count : 0} · спроб: ${t.library_attempts[0] ? t.library_attempts[0].count : 0} · ${fmtDate(t.created_at)}</span></span>
      <div class="end"><a class="btn small" href="#/t/library/${t.id}">Відкрити</a>
      <button class="btn small secondary" data-act="libcopy" data-link="${esc(link(t.share_token))}">Копіювати посилання</button></div></div>`).join('');
    return `<div class="card"><h2>Новий тест</h2>
      <form data-form="libnew" class="flex"><input name="title" required maxlength="200" placeholder="Назва тесту" style="flex:1;min-width:220px">
      <input name="min" type="number" min="1" max="600" placeholder="хв (необов’язково)" style="max-width:190px"><button class="btn">Створити</button></form>
      <p class="muted small">Тест із бібліотеки можна надіслати будь-кому за посиланням: учень вводить ім’я й проходить тест без реєстрації.</p></div>
      <div class="card"><h2>Мої тести</h2>${rows || '<div class="empty">Тестів поки немає.</div>'}</div>`;
  }

  /* ---------- сторінка тесту ---------- */
  async function libDetail(id) {
    const [t, qs, at] = await Promise.all([
      sb.from('library_tests').select('*').eq('id', id).single(),
      sb.from('library_questions').select('*').eq('test_id', id).order('sort_order').order('created_at'),
      sb.from('library_attempts').select('*').eq('test_id', id).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(200)]);
    must(t, qs, at);
    const T = t.data, L = link(T.share_token);
    const tg = 'https://t.me/share/url?url=' + encodeURIComponent(L) + '&text=' + encodeURIComponent('Тест: ' + T.title);

    const qlist = qs.data.map((q, i) => `<div class="lib-q"><div class="flex"><b>${i + 1}.</b><span class="pill blue">${esc(QT[q.qtype] || q.qtype)}</span><span class="pill">${q.points} б.</span>
      <button class="btn small danger" data-act="libdelq" data-id="${q.id}" style="margin-left:auto">Видалити</button></div>
      <div style="white-space:pre-wrap;margin:6px 0">${esc(q.prompt)}</div>
      ${q.qtype === 'matching' ? MSMatch.columns(q.options) : q.options ? `<div class="muted small">${q.options.map((o, k) => (k + 1) + '. ' + esc(o)).join('<br>')}</div>` : ''}
      <div class="small"><b>Правильно:</b> ${esc(fmtCorrect(q))}</div></div>`).join('') || '<div class="empty">Завдань ще немає.</div>';

    const ai = S.libAi && S.libAi.tid === id ? S.libAi.items : [];
    const aiCard = `<div class="card"><h2>Завдання з фото (ШІ)</h2>
      <form data-form="libaigen" data-tid="${id}"><div class="field"><label>Фото завдань (до 5 шт., JPG, PNG або WEBP)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required></div><button class="btn">Згенерувати завдання</button></form>
      <div class="notice warn small">Фото надсилаються до Google Gemini. ШІ може помилитися, тому перевіряйте умови й відповіді.</div>
      ${ai.length ? `<h2 style="margin-top:18px">Знайдено завдань: ${ai.length}</h2>
        <div class="flex" style="margin-bottom:12px"><button type="button" class="btn" data-act="libaddall" data-tid="${id}">Додати всі в тест (${ai.length})</button></div>
        ${ai.map(q => qForm(q, id, true)).join('')}` : ''}</div>`;

    const maxManual = qs.data.filter(q => q.qtype === 'long').reduce((s, q) => s + +q.points, 0);
    const attempts = at.data.map(a => {
      const open = S.libOpen === a.id, det = a.details || {}, ans = a.answers || {};
      const body = open ? `<div style="margin-top:10px">${qs.data.map((q, i) => {
        const d = det[q.id], mark = q.qtype === 'long' ? '⏳' : (d === true || d?.correct === true) ? '✅' : (d?.points > 0 ? '🟡' : '❌');
        return `<div class="lib-q"><b>${i + 1}. ${mark}</b>${q.qtype === 'matching' ? `<span class="pill">${d?.points ?? 0} / ${q.points} б.</span>` : ''}<div style="white-space:pre-wrap;margin:4px 0">${esc(q.prompt)}</div>
          <div class="notice" style="white-space:pre-wrap"><b>Відповідь:</b> ${esc(fmtAns(q, ans[q.id]))}</div>
          ${q.qtype === 'long' ? '' : `<div class="muted small">Правильно: ${esc(fmtCorrect(q))}</div>`}</div>`;
      }).join('')}
        <form data-form="libgrade" data-id="${a.id}"${maxManual ? ' data-man="1"' : ''} style="margin-top:10px">
          ${maxManual ? `<div class="flex"><input name="pts" type="number" min="0" max="${maxManual}" step="0.5" required value="${a.manual_score}" style="max-width:200px"><span class="muted small">балів за розгорнуті (макс. ${maxManual})</span></div>` : ''}
          <div class="field" style="margin-top:8px"><label>Коментар для учня (необов’язково)</label><textarea name="comment" rows="2" maxlength="2000">${esc(a.teacher_comment || '')}</textarea></div>
          <button class="btn small">Зберегти ${maxManual ? 'оцінку й коментар' : 'коментар'}</button></form>
        <button class="btn small danger" data-act="libdelatt" data-id="${a.id}" style="margin-top:10px">Видалити спробу</button></div>` : '';
      return `<div class="row" style="display:block"><div class="row" style="border:0;padding:0"><span><b>${esc(a.guest_name)}</b> <span class="muted small">${fmtDate(a.finished_at)}</span></span>
        <div class="end"><span class="pill ${a.status === 'graded' ? 'green' : 'amber'}">${+a.auto_score + +a.manual_score} / ${a.max_score}${a.status === 'graded' ? '' : ' · чекає перевірки'}</span>
        <button class="btn small secondary" data-act="libview" data-id="${a.id}">${open ? 'Сховати' : 'Переглянути'}</button></div></div>${body}</div>`;
    }).join('') || '<div class="empty">Ще ніхто не пройшов цей тест.</div>';

    return `${back('#/t/library', 'До бібліотеки')}
      <div class="card"><h2>${esc(T.title)}</h2>
        <div class="lib-link"><input readonly value="${esc(L)}" onfocus="this.select()">
          <button class="btn" data-act="libcopy" data-link="${esc(L)}">Копіювати посилання</button>
          <a class="btn secondary" href="${esc(tg)}" target="_blank" rel="noopener">Надіслати в Telegram</a></div>
        <p class="muted small">Будь-хто з цим посиланням може пройти тест: ім’я вводиться перед початком, реєстрація не потрібна.${T.is_active ? '' : ' <b>Зараз доступ закрито.</b>'}</p>
        <form data-form="libmeta" data-id="${id}" style="margin-top:12px">
          <div class="field"><label>Назва</label><input name="title" required maxlength="200" value="${esc(T.title)}"></div>
          <div class="field"><label>Опис для учня (необов’язково)</label><textarea name="desc" rows="2" maxlength="2000">${esc(T.description || '')}</textarea></div>
          <div class="two"><div class="field"><label>Час на тест, хв (порожньо — без обмеження)</label><input name="min" type="number" min="1" max="600" value="${T.time_limit_minutes ?? ''}"></div>
          <div class="field"><label class="opt"><input type="checkbox" name="active"${T.is_active ? ' checked' : ''}> Посилання працює</label></div></div>
          <div class="field"><label class="opt"><input type="checkbox" name="show"${T.show_answers ? ' checked' : ''}> Показувати учню правильні відповіді й пояснення після здачі</label></div>
          <div class="flex"><button class="btn secondary">Зберегти</button><button type="button" class="btn danger" data-act="libdel" data-id="${id}">Видалити тест</button></div></form></div>
      <div class="card"><h2>Завдання (${qs.data.length})</h2>${qlist}</div>
      <div class="card"><h2>Додати завдання</h2>${qForm({}, id, false)}</div>
      ${aiCard}
      <div class="card"><h2>Результати (${at.data.length})</h2>${attempts}</div>`;
  }

  TAB.library = async function () {
    if (!isStaff()) return '<div class="card"><div class="empty">Недоступно.</div></div>';
    const p = rt();
    return p[3] ? libDetail(p[3]) : libList();
  };

  /* ---------- дії викладача ---------- */
  F.libnew = async function (f) {
    const fd = new FormData(f), m = fd.get('min');
    const { data, error } = await sb.from('library_tests')
      .insert({ title: String(fd.get('title')).trim(), time_limit_minutes: m ? Number(m) : null }).select('id').single();
    if (error) throw error;
    toast('Тест створено');
    location.hash = '#/t/library/' + data.id;
  };
  F.libmeta = async function (f) {
    const fd = new FormData(f), m = fd.get('min');
    const { error } = await sb.from('library_tests').update({
      title: String(fd.get('title')).trim(), description: String(fd.get('desc') || '').trim() || null,
      time_limit_minutes: m ? Number(m) : null, is_active: fd.get('active') === 'on', show_answers: fd.get('show') === 'on' }).eq('id', f.dataset.id);
    if (error) throw error;
    toast('Збережено'); renderApp();
  };
  A.libdel = async function (el) {
    if (!confirm('Видалити тест разом із завданнями та результатами? Посилання перестане працювати.')) return;
    const { error } = await sb.from('library_tests').delete().eq('id', el.dataset.id);
    if (error) throw error;
    toast('Тест видалено'); location.hash = '#/t/library';
  };
  A.libcopy = async function (el) {
    const l = el.dataset.link;
    try { await navigator.clipboard.writeText(l); toast('Посилання скопійовано'); }
    catch (e) { window.prompt('Скопіюйте посилання (Ctrl+C):', l); }
  };

  async function nextOrder(tid) {
    const r = await sb.from('library_questions').select('sort_order').eq('test_id', tid).order('sort_order', { ascending: false }).limit(1);
    must(r);
    return r.data.length ? r.data[0].sort_order + 1 : 1;
  }
  F.libaddq = async function (f) {
    let row;
    try { row = parseQ(f); } catch (e) { throw new Error('Завдання: ' + e.message); }
    row.test_id = f.dataset.tid; row.sort_order = await nextOrder(f.dataset.tid);
    const { error } = await sb.from('library_questions').insert(row);
    if (error) throw error;
    if (f.dataset.ai && S.libAi) S.libAi.items = S.libAi.items.filter(q => q.id !== f.dataset.ai);
    toast('Завдання додано'); renderApp();
  };
  A.libdelq = async function (el) {
    if (!confirm('Видалити завдання?')) return;
    const { error } = await sb.from('library_questions').delete().eq('id', el.dataset.id);
    if (error) throw error;
    renderApp();
  };
  A.libaidrop = function (el) {
    if (S.libAi) S.libAi.items = S.libAi.items.filter(q => q.id !== el.dataset.id);
    renderApp();
  };
  A.libaddall = async function (el) {
    if (el.dataset.busy) return;
    const forms = [...document.querySelectorAll('form[data-ai][data-form="libaddq"]')];
    if (!forms.length) return;
    if (!confirm('Додати в тест завдань: ' + forms.length + '? ШІ міг помилитися, тож перегляньте умови й відповіді.')) return;
    el.dataset.busy = '1'; el.disabled = true;
    const tid = el.dataset.tid, ok = [], bad = [], rows = [];
    let ord = await nextOrder(tid);
    forms.forEach((f, i) => {
      try { const r = parseQ(f); r.test_id = tid; r.sort_order = ord++; rows.push(r); ok.push(f.dataset.ai); }
      catch (e) { bad.push('№' + (i + 1) + ': ' + e.message); }
    });
    try {
      if (rows.length) { const { error } = await sb.from('library_questions').insert(rows); if (error) throw error; }
      if (S.libAi) S.libAi.items = S.libAi.items.filter(q => !ok.includes(q.id));
      toast(bad.length ? `Додано: ${rows.length}. Не додано: ${bad.length} (${bad.join('; ')})` : `Додано завдань: ${rows.length}`, !!bad.length);
    } finally { renderApp(); }
  };

  const toB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Не вдалося прочитати фото'));
    r.readAsDataURL(blob);
  });
  F.libaigen = async function (f) {
    const files = [...f.querySelector('input[type=file]').files].slice(0, 5);
    if (!files.length) throw new Error('Оберіть фото');
    toast('ШІ читає фото, це може зайняти до хвилини…');
    const images = [];
    for (const file of files) images.push({ mime: 'image/jpeg', data: await toB64(await resizeToJpeg(file, 1600)) });
    const { data, error } = await sb.functions.invoke('generate-questions', { body: { images } });
    if (error) {
      let m = error.message;
      try { m = (await error.context.json()).error || m; } catch (_) { /* залишаємо загальне */ }
      throw new Error(m);
    }
    const items = ((data && data.questions) || []).map((q, i) => ({ ...q, id: Date.now() + '_' + i }));
    if (!items.length) throw new Error('ШІ не знайшов завдань на фото. Спробуйте чіткіше фото.');
    S.libAi = { tid: f.dataset.tid, items };
    toast('Знайдено завдань: ' + items.length); renderApp();
  };

  A.libview = function (el) { S.libOpen = S.libOpen === el.dataset.id ? null : el.dataset.id; renderApp(); };
  F.libgrade = async function (f) {
    const fd = new FormData(f);
    const u = { teacher_comment: String(fd.get('comment') || '').trim() || null };
    if (f.dataset.man) { u.manual_score = Number(fd.get('pts')) || 0; u.status = 'graded'; }
    const { error } = await sb.from('library_attempts').update(u).eq('id', f.dataset.id);
    if (error) throw error;
    toast('Збережено'); renderApp();
  };
  A.libdelatt = async function (el) {
    if (!confirm('Видалити цю спробу?')) return;
    const { error } = await sb.from('library_attempts').delete().eq('id', el.dataset.id);
    if (error) throw error;
    S.libOpen = null; renderApp();
  };

  /* =============== ПУБЛІЧНА СТОРІНКА ТЕСТУ (без входу) =============== */
  const PUBRE = /^#\/test\/([A-Za-z0-9]{16,64})\/?$/;
  const ATTRE = /^#\/attempt\/([0-9a-fA-F-]{36})\/?$/;
  let token = null, attId = null, test = null, root = null, timerId = null, busy = false;
  const KEY = () => 'ms_pub_' + token;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || 'null'); } catch (e) { return null; } };
  const save = o => { try { localStorage.setItem(KEY(), JSON.stringify(o)); } catch (e) { /* ігноруємо */ } };
  const wipe = () => { try { localStorage.removeItem(KEY()); } catch (e) { /* ігноруємо */ } };

  const shell = inner => `<div class="pub-in"><div class="pub-logo">∑ MathSpace</div>
    ${staffNow() ? '<p><a href="#/t/library">← До кабінету</a></p>' : ''}${inner}</div>`;
  function ensureRoot() {
    if (!root) { root = document.createElement('div'); root.id = 'pub-ov'; document.body.appendChild(root); }
    return root;
  }
  function closePub() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (root) { root.remove(); root = null; }
  }

  async function boot() {
    ensureRoot().innerHTML = shell('<div class="card"><p>Завантаження…</p></div>');
    const r = await sb.rpc('get_public_test', { p_token: token });
    if (r.error) { root.innerHTML = shell(`<div class="card"><h2>Тест недоступний</h2><p>${esc(r.error.message)}</p></div>`); return; }
    test = r.data;
    const s = load();
    if (s && s.aid) quiz(s); else nameScreen();
  }

  function nameScreen() {
    const n = test.questions.length, lim = test.time_limit_minutes;
    root.innerHTML = shell(`<div class="card"><h2>${esc(test.title)}</h2>
      ${test.description ? `<p style="white-space:pre-wrap">${esc(test.description)}</p>` : ''}
      <p class="muted">Завдань: ${n}${lim ? ` · час на виконання: <b>${lim} хв</b> (відлік почнеться після старту)` : ''}</p>
      <div class="field"><label>Ваше ім’я та прізвище</label><input id="pub-name" maxlength="120" autocomplete="name"></div>
      <div class="notice warn small" id="pub-err" hidden></div>
      <button class="btn" id="pub-start">Розпочати тест</button></div>`);
    const err = root.querySelector('#pub-err'), btn = root.querySelector('#pub-start');
    btn.onclick = async () => {
      const name = root.querySelector('#pub-name').value.trim();
      if (name.length < 2) { err.textContent = 'Вкажіть ім’я та прізвище'; err.hidden = false; return; }
      btn.disabled = true; err.hidden = true;
      const r = await sb.rpc('start_public_attempt', { p_token: token, p_name: name });
      if (r.error) { err.textContent = r.error.message; err.hidden = false; btn.disabled = false; return; }
      const d = r.data, lim = d.limit_minutes;
      const deadline = lim ? Date.now() + (Date.parse(d.started_at) + lim * 60000 - Date.parse(d.now)) : null;
      const st = { aid: d.attempt_id, name, deadline, answers: {} };
      save(st); quiz(st);
    };
  }

  function collect() {
    const a = {};
    root.querySelectorAll('[data-pq]').forEach(c => {
      const id = c.dataset.pq, t = c.dataset.t;
      if (t === 'matching') { a[id] = MSMatch.collect(c); }
      else if (t === 'multiple') { const v = [...c.querySelectorAll('input:checked')].map(x => +x.value); if (v.length) a[id] = v; }
      else if (t === 'single') { const x = c.querySelector('input:checked'); if (x) a[id] = +x.value; }
      else if (t === 'truefalse') { const x = c.querySelector('input:checked'); if (x) a[id] = x.value === 'true'; }
      else { const el = c.querySelector('input,textarea'); const v = el && el.value.trim(); if (v) a[id] = v; }
    });
    return a;
  }
  function restore(a) {
    root.querySelectorAll('[data-pq]').forEach(c => {
      const id = c.dataset.pq, t = c.dataset.t, v = a[id];
      if (v === undefined) return;
      if (t === 'matching') MSMatch.restore(c, v);
      else if (t === 'multiple') c.querySelectorAll('input').forEach(x => { x.checked = v.includes(+x.value); });
      else if (t === 'single') c.querySelectorAll('input').forEach(x => { x.checked = +x.value === v; });
      else if (t === 'truefalse') c.querySelectorAll('input').forEach(x => { x.checked = (x.value === 'true') === v; });
      else { const el = c.querySelector('input,textarea'); if (el) el.value = v; }
    });
  }

  function quiz(st) {
    const qhtml = (q, i) => {
      const o = q.options || [];
      let inp;
      if (q.qtype === 'matching') inp = MSMatch.input(q.options);
      else if (q.qtype === 'single') inp = o.map((x, k) => `<label class="opt"><input type="radio" name="pq_${q.id}" value="${k}"> <span>${esc(x)}</span></label>`).join('');
      else if (q.qtype === 'multiple') inp = o.map((x, k) => `<label class="opt"><input type="checkbox" value="${k}"> <span>${esc(x)}</span></label>`).join('');
      else if (q.qtype === 'truefalse') inp = `<label class="opt"><input type="radio" name="pq_${q.id}" value="true"> <span>Правда</span></label><label class="opt"><input type="radio" name="pq_${q.id}" value="false"> <span>Неправда</span></label>`;
      else if (q.qtype === 'short') inp = '<input type="text" maxlength="500" placeholder="Ваша відповідь">';
      else inp = '<textarea rows="5" maxlength="8000" placeholder="Ваш розв’язок"></textarea>';
      return `<div class="card" data-pq="${q.id}" data-t="${q.qtype}"><div class="flex"><b>${i + 1}.</b><span class="pill blue">${q.points} б.</span></div>
        <p style="white-space:pre-wrap;font-size:1.15rem">${esc(q.prompt)}</p>${inp}</div>`;
    };
    root.innerHTML = shell(`${st.deadline ? '<div class="card pub-timer"><b>Залишилось: <span id="pub-timer">…</span></b></div>' : ''}
      <h2 style="margin:6px 0 12px">${esc(test.title)}</h2><p class="muted">${esc(st.name || '')}</p>
      <div id="pub-qs">${test.questions.map(qhtml).join('')}</div>
      <div class="notice warn small" id="pub-err" hidden></div>
      <button class="btn" id="pub-send">Здати тест</button>`);
    restore(st.answers || {});
    const persist = () => { st.answers = collect(); save(st); };
    root.addEventListener('input', persist); root.addEventListener('change', persist);
    root.querySelector('#pub-send').onclick = () => submit(st, false);

    if (timerId) clearInterval(timerId);
    let fired = false;
    timerId = setInterval(() => {
      const el = document.getElementById('pub-timer');
      if (!el || !st.deadline) return;
      const ms = st.deadline - Date.now();
      if (ms <= 0) { el.textContent = '0:00'; if (!fired) { fired = true; submit(st, true); } return; }
      const s = Math.ceil(ms / 1000);
      el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 500);
  }

  async function submit(st, auto) {
    if (busy) return;
    const a = collect(), empty = test.questions.length - Object.keys(a).length;
    if (!auto && empty && !window.confirm('Без відповіді: ' + empty + '. Здати тест?')) return;
    busy = true;
    const btn = root.querySelector('#pub-send'), err = root.querySelector('#pub-err');
    if (btn) btn.disabled = true;
    const r = await sb.rpc('submit_public_attempt', { p_attempt: st.aid, p_answers: a });
    busy = false;
    if (r.error) {
      if (/уже здано|не знайдено|Час на тест/.test(r.error.message)) { wipe(); }
      if (err) { err.textContent = r.error.message; err.hidden = false; }
      if (btn) btn.disabled = false;
      return;
    }
    wipe();
    if (timerId) { clearInterval(timerId); timerId = null; }
    showDone(st, r.data);
  }

  const attLink = id => location.origin + location.pathname + '#/attempt/' + id;
  async function copyLink(l) {
    try { await navigator.clipboard.writeText(l); toast('Посилання скопійовано'); }
    catch (e) { window.prompt('Скопіюйте посилання (Ctrl+C):', l); }
  }

  function showDone(st, d) {
    const L = attLink(st.aid);
    root.innerHTML = shell(`<div class="card"><h2>Дякуємо, ${esc(st.name || '')}!</h2>
      <p style="font-size:1.2rem">Ваш результат: <b>${d.auto_score} з ${d.max_score}</b> балів.</p>
      ${d.status === 'review' ? '<p class="muted">Розгорнуті відповіді перевірить викладач, остаточна оцінка може бути вищою.</p>' : ''}
      <div class="flex"><button class="btn" id="pub-review">Переглянути мою спробу</button></div>
      <p class="muted small">Збережіть це посилання, щоб повернутися до своєї спроби пізніше (там з’явиться й оцінка викладача):</p>
      <div class="lib-link"><input readonly value="${esc(L)}" onfocus="this.select()"><button class="btn secondary" id="pub-copy">Копіювати</button></div></div>`);
    root.querySelector('#pub-review').onclick = () => viewAttempt(st.aid, () => showDone(st, d));
    root.querySelector('#pub-copy').onclick = () => copyLink(L);
  }

  async function viewAttempt(id, back) {
    ensureRoot().innerHTML = shell('<div class="card"><p>Завантаження…</p></div>');
    const r = await sb.rpc('get_public_attempt', { p_attempt: id });
    if (r.error) { root.innerHTML = shell(`<div class="card"><h2>Спроба недоступна</h2><p>${esc(r.error.message)}</p></div>`); return; }
    const d = r.data, L = attLink(id);
    const cards = d.questions.map((q, i) => {
      const mark = q.qtype === 'long' ? '📝' : (q.ok === true || q.ok?.correct === true) ? '✅' : (q.ok?.points > 0 ? '🟡' : '❌');
      return `<div class="card"><div class="flex"><b>${i + 1}. ${mark}</b><span class="pill">${q.qtype === 'matching' ? `${q.ok?.points ?? 0} / ` : ''}${q.points} б.</span></div>
        <p style="white-space:pre-wrap;font-size:1.1rem">${esc(q.prompt)}</p>
        <div class="notice" style="white-space:pre-wrap"><b>Моя відповідь:</b> ${esc(fmtAns(q, q.answer))}</div>
        ${d.show_answers && q.qtype !== 'long' && q.correct !== null && q.correct !== undefined ? `<div class="muted small"><b>Правильна відповідь:</b> ${esc(fmtCorrect(q))}</div>` : ''}
        ${d.show_answers && q.explanation ? `<div class="muted small" style="white-space:pre-wrap">${esc(q.explanation)}</div>` : ''}</div>`;
    }).join('');
    root.innerHTML = shell(`${back ? '<p><a href="javascript:void(0)" id="pub-back">← Назад</a></p>' : ''}
      <div class="card"><h2>${esc(d.title)}</h2><p class="muted">${esc(d.guest_name)} · ${fmtDate(d.finished_at)}</p>
        <p style="font-size:1.2rem">Результат: <b>${d.score} з ${d.max_score}</b> балів${d.status === 'review' ? ' <span class="pill amber">частину ще перевіряє викладач</span>' : ''}</p>
        <div class="lib-link"><input readonly value="${esc(L)}" onfocus="this.select()"><button class="btn secondary" id="pub-copy">Копіювати посилання</button></div></div>
      ${d.teacher_comment ? `<div class="card"><h2>Коментар викладача</h2><p style="white-space:pre-wrap">${esc(d.teacher_comment)}</p></div>` : ''}
      ${cards}`);
    root.querySelector('#pub-copy').onclick = () => copyLink(L);
    const bk = root.querySelector('#pub-back'); if (bk && back) bk.onclick = back;
  }

  function route() {
    const ma = ATTRE.exec(location.hash);
    if (ma) { if (ma[1] !== attId || !root) { attId = ma[1]; viewAttempt(ma[1], null); } return; }
    const m = PUBRE.exec(location.hash);
    if (m) { if (m[1] !== token || !root) { token = m[1]; boot(); } }
    else if (staffNow()) closePub();
  }
  window.addEventListener('hashchange', route);
  route();

  if (S.profile) renderApp();
})();
