/* MathSpace · етап 12: вкладки «Прогрес» і «Розклад».
   Підключається ПІСЛЯ stage11.js. Спершу виконайте 08_schedule.sql */
(function () {
  'use strict';
  S.progSid = null;

  const st = document.createElement('style');
  st.textContent = `.bar{height:10px;border-radius:5px;background:#ece8f7;overflow:hidden;flex:1;min-width:80px}
.bar i{display:block;height:100%;background:#e0566b}
.bar.ok i{background:#2e9e5b}`;
  document.head.appendChild(st);

  const base = tabs;
  window.tabs = function () {
    const t = base();
    const i = t.findIndex(x => x[0] === 'profile');
    [['progress', 'Прогрес', '📊'], ['schedule', 'Розклад', '📅']].forEach(x => {
      if (!t.some(y => y[0] === x[0])) t.splice(i < 0 ? t.length : i, 0, x);
    });
    return t;
  };

  const pct = (s, m) => (+m > 0 ? Math.round(100 * s / m) : 0);
  const staff = () => S.profile.role !== 'student';

  async function students() {
    return (await getPeople()).filter(p => p.role === 'student');
  }
  function picker(list, cur, formName) {
    return `<form data-form="${formName}" class="flex" style="margin-bottom:14px">
      <select name="sid" style="max-width:320px">${list.map(s => `<option value="${esc(s.id)}"${s.id === cur ? ' selected' : ''}>${esc(fullName(s))}</option>`).join('')}</select>
      <button class="btn small secondary">Показати</button></form>`;
  }
  F.pickprog = async function (f) { S.progSid = new FormData(f).get('sid'); renderApp(); };

  /* ================= ПРОГРЕС ================= */
  TAB.progress = async function () {
    let sid = S.profile.id, head = '';
    if (staff()) {
      const list = await students();
      if (!list.length) return '<div class="card"><div class="empty">Учнів поки немає.</div></div>';
      if (!list.some(s => s.id === S.progSid)) S.progSid = list[0].id;
      sid = S.progSid;
      head = picker(list, sid, 'pickprog');
    }
    const ls = await sb.from('lessons').select('id,title,lesson_no').eq('student_id', sid);
    must(ls);
    const title = Object.fromEntries(ls.data.map(l => [l.id, (l.lesson_no ? '№' + l.lesson_no + '. ' : '') + l.title]));
    const ids = ls.data.map(l => l.id);
    const at = ids.length ? await sb.from('attempts')
      .select('id,lesson_id,created_at,status,auto_score,manual_score,max_score')
      .in('lesson_id', ids).eq('status', 'graded').order('created_at', { ascending: true }) : { data: [] };
    must(at);
    const rows = at.data.filter(a => +a.max_score > 0);
    if (!rows.length) return `<div class="card"><h2>Прогрес</h2>${head}<div class="empty">Перевірених спроб поки немає.</div></div>`;

    const p = rows.map(a => pct(+a.auto_score + +a.manual_score, a.max_score));
    const avg = Math.round(p.reduce((a, b) => a + b, 0) / p.length);
    const W = 560, H = 150, n = p.length;
    const X = i => (n === 1 ? W / 2 : 14 + i * (W - 28) / (n - 1));
    const Y = v => H - 12 - v * (H - 24) / 100;
    const line = p.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    const dots = p.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="#6d4aff"><title>${fmtDate(rows[i].created_at)}: ${v}%</title></circle>`).join('');

    const byL = {};
    rows.forEach(a => { const o = byL[a.lesson_id] = byL[a.lesson_id] || { best: 0, last: 0 }; const v = pct(+a.auto_score + +a.manual_score, a.max_score); o.best = Math.max(o.best, v); o.last = v; });
    const lessonsHtml = Object.entries(byL).sort((a, b) => a[1].last - b[1].last).map(([id, o]) =>
      `<div class="row"><span style="flex:1.3">${esc(title[id] || 'Урок')}</span><div class="bar${o.last >= 70 ? ' ok' : ''}"><i style="width:${o.last}%"></i></div><b>${o.last}%</b></div>`).join('');

    let weak = '';
    if (staff()) {
      const an = await sb.from('attempt_answers').select('points_awarded,snapshot').in('attempt_id', rows.map(a => a.id));
      if (!an.error) {
        const g = {};
        an.data.forEach(a => {
          const s = a.snapshot || {}, max = +s.points;
          if (!s.prompt || !(max > 0) || a.points_awarded == null) return;
          const k = String(s.prompt).slice(0, 70);
          const o = g[k] = g[k] || { got: 0, max: 0, n: 0 };
          o.got += +a.points_awarded; o.max += max; o.n++;
        });
        const top = Object.entries(g).map(([k, o]) => [k, pct(o.got, o.max), o.n]).filter(x => x[1] < 70).sort((a, b) => a[1] - b[1]).slice(0, 6);
        if (top.length) weak = `<div class="card"><h2>Завдання, де найбільше помилок</h2>${top.map(([k, v, c]) =>
          `<div class="row"><span style="flex:1.3">${esc(k)}${k.length >= 70 ? '…' : ''} <span class="muted small">(спроб: ${c})</span></span><div class="bar"><i style="width:${100 - v}%"></i></div><b>${v}%</b></div>`).join('')}</div>`;
      }
    }

    return `<div class="card"><h2>Прогрес</h2>${head}
      <p>Перевірених спроб: <b>${n}</b> · середній бал: <b>${avg}%</b> · остання: <b>${p[n - 1]}%</b></p>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#f7f5fc;border-radius:12px"><polyline fill="none" stroke="#6d4aff" stroke-width="3" points="${line}"/>${dots}</svg></div>
      <div class="card"><h2>За уроками (остання спроба)</h2>${lessonsHtml}</div>${weak}`;
  };

  /* ================= РОЗКЛАД ================= */
  F.pickplan = async function (f) { S.progSid = new FormData(f).get('sid'); renderApp(); };
  const dtfmt = iso => new Date(iso).toLocaleString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  TAB.schedule = async function () {
    const isT = staff();
    const list = isT ? await students() : [];
    const names = Object.fromEntries(list.map(s => [s.id, fullName(s)]));
    const from = new Date(Date.now() - 3600e3).toISOString();
    const r = await sb.from('lesson_schedule').select('*').gte('starts_at', from).order('starts_at', { ascending: true }).limit(100);
    if (r.error) throw new Error('Не вдалося завантажити розклад (' + (r.error.message || r.error.code) + '). Перевірте, що виконано 08_schedule.sql.');
    const items = r.data.map(l => `<div class="row"><div><b>${dtfmt(l.starts_at)}</b>${isT ? ' · ' + esc(names[l.student_id] || '') : ''}<br>${esc(l.title)}${l.note ? `<br><span class="muted small">${esc(l.note)}</span>` : ''}</div>
      ${isT ? `<button class="btn small danger" data-act="delsched" data-id="${l.id}">Видалити</button>` : ''}</div>`).join('') || '<div class="empty">Найближчих уроків немає.</div>';
    const opts = list.map(s => `<option value="${esc(s.id)}">${esc(fullName(s))}</option>`).join('');
    const days = [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Нд', 0]]
      .map(([t, v]) => `<label class="opt" style="display:inline-flex;margin-right:12px"><input type="checkbox" name="wd" value="${v}"> ${t}</label>`).join('');
    const add = isT ? `<div class="card"><h2>Додати уроки в розклад</h2>
      <form data-form="addsched"><div class="field"><label>Учень</label><select name="sid">${opts}</select></div>
      <div class="two"><div class="field"><label>Дата (перший урок)</label><input type="date" name="date" required></div>
      <div class="field"><label>Час</label><input type="time" name="time" required></div></div>
      <div class="field"><label>Повторювати щотижня в дні (нічого не обрано = один урок)</label><div>${days}</div></div>
      <div class="field"><label>Скільки тижнів наперед</label><input type="number" name="weeks" min="1" max="26" value="8" style="max-width:120px"></div>
      <div class="field"><label>Тема</label><input name="title" required maxlength="200" value="Урок математики"></div>
      <div class="field"><label>Нотатка (необов’язково)</label><input name="note" maxlength="500"></div>
      <button class="btn">Додати в розклад</button></form></div>
      <div class="card"><h2>Очистити розклад</h2>
      <form data-form="clearsched" class="flex"><select name="sid" style="max-width:320px">${opts}</select>
      <button class="btn small danger">Видалити всі майбутні уроки учня</button></form></div>` : '';
    return `<div class="card"><h2>Найближчі уроки</h2>${items}</div>${add}`;
  };

  F.addsched = async function (f) {
    const d = new FormData(f);
    const sid = d.get('sid'), date = d.get('date'), time = d.get('time');
    if (!sid || !date || !time) throw new Error('Оберіть учня, дату й час');
    const weeks = Math.min(Math.max(+d.get('weeks') || 1, 1), 26);
    const days = d.getAll('wd').map(Number);
    const [y, m, dd] = date.split('-').map(Number), [hh, mi] = time.split(':').map(Number);
    let dates = [];
    if (!days.length) dates.push(new Date(y, m - 1, dd, hh, mi));
    else for (let i = 0; i < weeks * 7; i++) {
      const x = new Date(y, m - 1, dd + i, hh, mi);
      if (days.includes(x.getDay())) dates.push(x);
    }
    dates = dates.filter(x => x > new Date());
    if (!dates.length) throw new Error('Немає майбутніх дат за цими налаштуваннями');
    if (dates.length > 120) throw new Error('Забагато уроків за раз (максимум 120)');
    if (dates.length > 1 && !confirm('Буде додано уроків: ' + dates.length + '. Продовжити?')) return;
    const title = String(d.get('title')).trim(), note = String(d.get('note') || '').trim() || null;
    const { error } = await sb.from('lesson_schedule').insert(dates.map(x => ({
      student_id: sid, teacher_id: S.profile.id, starts_at: x.toISOString(), title, note })));
    if (error) throw error;
    toast('Додано уроків: ' + dates.length);
    renderApp();
  };

  F.clearsched = async function (f) {
    const sid = new FormData(f).get('sid');
    if (!sid || !confirm('Видалити ВСІ майбутні уроки цього учня з розкладу?')) return;
    const { error } = await sb.from('lesson_schedule').delete().eq('student_id', sid).gte('starts_at', new Date().toISOString());
    if (error) throw error;
    toast('Майбутні уроки видалено');
    renderApp();
  };
  A.delsched = async function (el) {
    const { error } = await sb.from('lesson_schedule').delete().eq('id', el.dataset.id);
    if (error) throw error;
    renderApp();
  };

  if (S.profile) renderApp();
})();
