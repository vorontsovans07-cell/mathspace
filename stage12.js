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

  /* ================= РОЗКЛАД (тижневий календар) ================= */
  const H0 = 8, H1 = 22, PX = 48;
  const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const dm = d => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const CX = { cancelled_teacher: 'Скасовано викладачем', cancelled_student: 'Скасовано учнем' };
  S.schedWeek = mondayOf(new Date());
  S.sch = { students: [], teachers: [], names: {}, items: [] };

  const css2 = document.createElement('style');
  css2.textContent = `.sc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.sc-bar .lbl{font-weight:700;flex:1;min-width:170px;font-size:1.05rem}
.sc-wrap{overflow-x:auto;background:#fff;border:1px solid #e3dfed;border-radius:14px}
.sc-grid{display:flex;min-width:760px}
.sc-times{width:54px;flex:none}
.sc-t{font-size:12px;color:#7b7390;text-align:right;padding:2px 6px 0 0;box-sizing:border-box;border-top:1px solid #eee}
.sc-col{flex:1;min-width:0;border-left:1px solid #eee}
.sc-head{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 8px;font-weight:600;box-sizing:border-box;border-bottom:1px solid #eee}
.sc-head i{font-style:normal;font-size:12px;color:#7b7390;align-self:flex-end;padding-bottom:4px}
.sc-col.today .sc-head{color:#2a62e0;border-bottom:3px solid #2a62e0;background:#f0f5ff}
.sc-body{position:relative}
.sc-cell{border-top:1px solid #eee;box-sizing:border-box}
.sc-cell[data-act]{cursor:pointer}
.sc-cell[data-act]:hover{background:#f3effd}
.sc-ev{position:absolute;left:3px;right:3px;box-sizing:border-box;overflow:hidden;background:#f3d9f1;border-radius:6px;padding:4px 7px;font-size:13px;line-height:1.3;cursor:pointer;color:#3a2a55;z-index:1}
.sc-ev.trial{background:repeating-linear-gradient(45deg,#f8e9f6,#f8e9f6 8px,#f0d0ed 8px,#f0d0ed 16px)}
.sc-sub{font-size:12px;color:#6a5b85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sc-ov{position:fixed;inset:0;z-index:50;background:rgba(20,15,40,.5);display:flex;align-items:center;justify-content:center;padding:12px}
.sc-modal{background:#fff;border-radius:16px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:20px}
.sc-modal h3{margin:0 0 6px;display:flex;justify-content:space-between;align-items:center}
.sc-modal h4{margin:16px 0 8px}
.sc-x{border:0;background:none;font-size:26px;cursor:pointer;line-height:1}
.sc-warn{background:#fdeeea;color:#8a3b2a;border-radius:10px;padding:10px 12px;margin:10px 0}
.sc-sum{background:#f3effd;border-radius:10px;padding:10px 12px;margin:10px 0;font-size:15px}
.sc-ev{user-select:none;-webkit-user-select:none}
.sc-ev[data-drag]{cursor:grab}
body.sc-dragging,body.sc-dragging .sc-ev{cursor:grabbing!important}
.sc-dim{opacity:.35}
.sc-drop{background:#cfe0ff!important;border:2px dashed #2a62e0;color:#1d3f8f;pointer-events:none;z-index:5;font-weight:600}
.sc-ev.cx{background:#ececf1;color:#7b7390}
.sc-ev.cx b{text-decoration:line-through}
.sc-cx{font-size:12px;font-weight:600;color:#a23b4c}`;
  document.head.appendChild(css2);

  function modal(html) {
    closeModal();
    const o = document.createElement('div');
    o.id = 'sc-ov';
    o.innerHTML = `<div class="sc-modal">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o || (e.target.closest && e.target.closest('[data-sc-close]'))) closeModal(); });
    document.body.appendChild(o);
    return o.firstChild;
  }
  function closeModal() { const o = document.getElementById('sc-ov'); if (o) o.remove(); }

  TAB.schedule = async function () {
    const isT = staff();
    let people = [];
    try { people = await getPeople(); } catch (e) { /* учень може не мати доступу */ }
    const students = people.filter(p => p.role === 'student');
    let teachers = S.profile.role === 'teacher' ? [S.profile] : people.filter(p => p.role !== 'student');
    if (isT && !teachers.some(t => t.id === S.profile.id)) teachers.push(S.profile);
    const names = Object.fromEntries(people.map(p => [p.id, fullName(p)]));
    names[S.profile.id] = names[S.profile.id] || fullName(S.profile);

    const from = S.schedWeek, to = addDays(from, 7);
    const r = await sb.from('lesson_schedule').select('*')
      .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at', { ascending: true });
    if (r.error) throw new Error('Не вдалося завантажити розклад (' + (r.error.message || r.error.code) + '). Перевірте, що виконано 08_schedule.sql і 09_schedule_calendar.sql.');
    S.sch = { students, teachers, names, items: r.data };

    let h0 = H0, h1 = H1;
    r.data.forEach(l => {
      const s = new Date(l.starts_at), e = new Date(s.getTime() + (+l.duration_min || 60) * 60000);
      h0 = Math.min(h0, s.getHours());
      h1 = Math.max(h1, Math.min(24, Math.ceil((e.getHours() * 60 + e.getMinutes() || 1440) / 60)));
    });
    const hours = []; for (let h = h0; h < h1; h++) hours.push(h);

    const block = l => {
      const s = new Date(l.starts_at), dur = +l.duration_min || 60, e = new Date(s.getTime() + dur * 60000);
      const top = ((s.getHours() - h0) * 60 + s.getMinutes()) * PX / 60;
      const who = isT ? (names[l.student_id] || '') : (names[l.teacher_id] || '');
      const cxl = CX[l.status] || '', planned = !cxl;
      return `<div class="sc-ev${l.is_trial ? ' trial' : ''}${cxl ? ' cx' : ''}" data-act="schedopen" data-id="${l.id}"${isT && planned ? ' data-drag="1"' : ''} style="top:${top}px;height:${Math.max(dur * PX / 60 - 2, 24)}px"><b>${hm(s)}–${hm(e)}</b>${cxl ? `<div class="sc-cx">${cxl}</div>` : ''}<div>${esc(who)}</div><div class="sc-sub">${esc(l.title)}</div></div>`;
    };
    const today = dkey(new Date());
    const cols = WD.map((n, i) => {
      const day = addDays(from, i), k = dkey(day);
      const its = r.data.filter(l => dkey(new Date(l.starts_at)) === k);
      const cells = hours.map(h => `<div class="sc-cell"${isT ? ` data-act="schednew" data-date="${k}" data-h="${h}"` : ''} style="height:${PX}px"></div>`).join('');
      return `<div class="sc-col${k === today ? ' today' : ''}"><div class="sc-head"><span>${n} ${day.getDate()}</span><i>${its.filter(l => !CX[l.status]).length || ''}</i></div>
        <div class="sc-body" data-day="${k}" style="height:${hours.length * PX}px">${cells}${its.map(block).join('')}</div></div>`;
    }).join('');
    const times = `<div class="sc-times"><div class="sc-head"></div>${hours.map(h => `<div class="sc-t" style="height:${PX}px">${pad(h)}:00</div>`).join('')}</div>`;

    return `<div class="card"><div class="sc-bar">
      <button class="btn small secondary" data-act="schedprev">‹</button>
      <button class="btn small secondary" data-act="schedtoday">Сьогодні</button>
      <button class="btn small secondary" data-act="schednext">›</button>
      <span class="lbl">${dm(from)} – ${dm(addDays(from, 6))}</span>
      ${isT ? '<button class="btn small" data-act="schednew">+ Створити урок</button>' : ''}</div>
      <div class="sc-wrap"><div class="sc-grid" data-h0="${h0}">${times}${cols}</div></div>
      ${isT ? '<p class="muted small">Натисніть на вільну клітинку, щоб створити урок на цей час, або на урок, щоб переглянути чи видалити його.</p>' : ''}</div>`;
  };

  A.schedprev = () => { S.schedWeek = addDays(S.schedWeek, -7); renderApp(); };
  A.schednext = () => { S.schedWeek = addDays(S.schedWeek, 7); renderApp(); };
  A.schedtoday = () => { S.schedWeek = mondayOf(new Date()); renderApp(); };

  A.schednew = function (el) { openCreate(el && el.dataset ? el.dataset.date : '', el && el.dataset ? el.dataset.h : ''); };

  function openCreate(date, h) {
    const { students, teachers, names } = S.sch;
    if (!students.length) { toast('Спершу додайте учнів', true); return; }
    date = date || dkey(new Date());
    const time = h !== undefined && h !== '' ? pad(h) + ':00' : '16:00';
    const wd0 = new Date(date + 'T00:00').getDay();
    const days = [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Нд', 0]]
      .map(([t, v]) => `<label class="opt" style="display:inline-flex;margin-right:12px"><input type="checkbox" name="wd" value="${v}"${v === wd0 ? ' checked' : ''}> ${t}</label>`).join('');
    const m = modal(`<h3>Створити урок <button class="sc-x" data-sc-close aria-label="Закрити">×</button></h3>
      <h4>1. Учасники</h4>
      <label class="opt"><input type="checkbox" name="trial"> Пробний урок</label>
      <div class="field"><label>Вчитель</label><select name="tid">${teachers.map(t => `<option value="${esc(t.id)}"${t.id === S.profile.id ? ' selected' : ''}>${esc(names[t.id] || fullName(t))}</option>`).join('')}</select></div>
      <div class="field"><label>Студент</label><select name="sid">${students.map(s => `<option value="${esc(s.id)}">${esc(fullName(s))}</option>`).join('')}</select></div>
      <h4>2. Дата та час</h4>
      <div class="two"><div class="field"><label>Тривалість</label><select name="dur">${[30, 45, 60, 90, 120].map(v => `<option value="${v}"${v === 60 ? ' selected' : ''}>${v} хв</option>`).join('')}</select></div>
      <div class="field"><label>Кількість уроків</label><input type="number" name="count" min="1" max="60" value="1"></div></div>
      <div class="two"><div class="field"><label>Дата початку</label><input type="date" name="date" value="${date}"></div>
      <div class="field"><label>Час початку</label><input type="time" name="time" value="${time}"></div></div>
      <div class="field"><label>Дні тижня</label><div>${days}</div></div>
      <div class="field"><label>Дата закінчення</label><input type="date" name="end" style="max-width:220px"></div>
      <div class="sc-sum" id="sc-sum"></div>
      <h4>3. Нотатка</h4>
      <div class="field"><label>Тема</label><input name="title" maxlength="200" value="Урок математики"></div>
      <div class="field"><label>Нотатка (необов’язково)</label><input name="note" maxlength="500"></div>
      <div class="sc-warn" id="sc-warn" hidden></div>
      <div class="flex"><button class="btn" data-sc-save>Створити</button><button class="btn secondary" data-sc-close>Скасувати</button></div>`);
    const q = s => m.querySelector(s);

    function plan(ignoreEnd) {
      const dt = q('[name=date]').value, tm = q('[name=time]').value;
      if (!dt || !tm) return [];
      const count = Math.min(Math.max(+q('[name=count]').value || 1, 1), 60);
      const ds = [...m.querySelectorAll('[name=wd]:checked')].map(x => +x.value);
      const end = ignoreEnd ? '' : q('[name=end]').value;
      const [y, mo, d] = dt.split('-').map(Number), [hh, mi] = tm.split(':').map(Number);
      if (!ds.length || count === 1) return [new Date(y, mo - 1, d, hh, mi)];
      const out = [];
      for (let i = 0; i < 400 && out.length < count; i++) {
        const x = new Date(y, mo - 1, d + i, hh, mi);
        if (end && dkey(x) > end) break;
        if (ds.includes(x.getDay())) out.push(x);
      }
      return out;
    }
    function refresh(ev) {
      const t = ev && ev.target && ev.target.name;
      if (t === 'sid') {
        const st = students.find(s => s.id === q('[name=sid]').value);
        if (st && st.teacher_id && teachers.some(x => x.id === st.teacher_id)) q('[name=tid]').value = st.teacher_id;
      }
      if (t !== 'end') { const a = plan(true); q('[name=end]').value = a.length > 1 ? dkey(a[a.length - 1]) : ''; }
      const a = plan(false).filter(x => x > new Date());
      q('#sc-sum').textContent = a.length
        ? `Буде створено уроків: ${a.length} · з ${dm(a[0])} по ${dm(a[a.length - 1])}`
        : 'Немає майбутніх дат за цими налаштуваннями';
      q('#sc-warn').hidden = true;
    }
    m.addEventListener('input', refresh); m.addEventListener('change', refresh);
    refresh();

    q('[data-sc-save]').onclick = async function () {
      const btn = this, warn = q('#sc-warn');
      try {
        const sid = q('[name=sid]').value, tid = q('[name=tid]').value, dur = +q('[name=dur]').value;
        const title = q('[name=title]').value.trim();
        const dates = plan(false).filter(x => x > new Date());
        if (!sid || !tid) throw new Error('Оберіть вчителя й студента');
        if (!title) throw new Error('Вкажіть тему');
        if (!dates.length) throw new Error('Немає майбутніх дат за цими налаштуваннями');
        btn.disabled = true;
        const lo = new Date(Math.min(...dates) - 864e5), hi = new Date(Math.max(...dates) + 2 * 864e5);
        const ex = await sb.from('lesson_schedule').select('starts_at,duration_min,status')
          .gte('starts_at', lo.toISOString()).lt('starts_at', hi.toISOString())
          .or(`teacher_id.eq.${tid},student_id.eq.${sid}`);
        if (ex.error) throw ex.error;
        const busy = x => { const a = x.getTime(), b = a + dur * 6e4;
          return ex.data.some(e => { if (CX[e.status]) return false; const s = Date.parse(e.starts_at), f = s + (+e.duration_min || 60) * 6e4; return a < f && s < b; }); };
        const free = dates.filter(x => !busy(x)), taken = dates.filter(busy);
        if (!free.length) { warn.textContent = 'На ці дати немає вільних слотів: у вчителя або учня вже є уроки.'; warn.hidden = false; btn.disabled = false; return; }
        if (taken.length && !confirm(`Зайнято слотів: ${taken.length} (${taken.slice(0, 5).map(x => dm(x) + ' ' + hm(x)).join(', ')}${taken.length > 5 ? '…' : ''}).\nДодати решту (${free.length}), пропустивши зайняті?`)) { btn.disabled = false; return; }
        const note = q('[name=note]').value.trim() || null, trial = q('[name=trial]').checked;
        const { error } = await sb.from('lesson_schedule').insert(free.map(x => ({
          student_id: sid, teacher_id: tid, starts_at: x.toISOString(), duration_min: dur,
          title, note, is_trial: trial })));
        if (error) throw error;
        closeModal();
        toast('Додано уроків: ' + free.length);
        S.schedWeek = mondayOf(free[0]);
        renderApp();
      } catch (e) { btn.disabled = false; toast(e.message || String(e), true); }
    };
  }

  const fmtMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

  async function moveLesson(l, newStart) {
    const dur = +l.duration_min || 60, a = newStart.getTime(), b = a + dur * 6e4;
    const parts = [`student_id.eq.${l.student_id}`];
    if (l.teacher_id) parts.push(`teacher_id.eq.${l.teacher_id}`);
    const ex = await sb.from('lesson_schedule').select('id,starts_at,duration_min,status')
      .gte('starts_at', new Date(a - 864e5).toISOString()).lt('starts_at', new Date(a + 2 * 864e5).toISOString())
      .or(parts.join(','));
    if (ex.error) throw ex.error;
    const clash = ex.data.some(e => {
      if (e.id === l.id || CX[e.status]) return false;
      const s = Date.parse(e.starts_at), f = s + (+e.duration_min || 60) * 6e4;
      return a < f && s < b;
    });
    if (clash) { toast('На цей час уже є інший урок: вільного слота немає', true); return false; }
    const { error } = await sb.from('lesson_schedule').update({ starts_at: newStart.toISOString() }).eq('id', l.id);
    if (error) throw error;
    toast('Урок перенесено на ' + dm(newStart) + ', ' + hm(newStart));
    renderApp();
    return true;
  }

  A.schedopen = function (el) {
    const l = S.sch.items.find(x => String(x.id) === el.dataset.id);
    if (!l) return;
    const s = new Date(l.starts_at), e = new Date(s.getTime() + (+l.duration_min || 60) * 6e4);
    const n = S.sch.names, isT = staff(), cxl = CX[l.status];
    const m = modal(`<h3>${l.is_trial ? 'Пробний урок' : 'Урок'} <button class="sc-x" data-sc-close aria-label="Закрити">×</button></h3>
      ${cxl ? `<div class="sc-warn">❌ ${cxl}</div>` : ''}
      <p><b>${s.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</b><br>${hm(s)}–${hm(e)}</p>
      <p>${esc(l.title)}</p>
      ${n[l.student_id] ? `<p class="muted">Студент: ${esc(n[l.student_id])}</p>` : ''}
      ${n[l.teacher_id] ? `<p class="muted">Вчитель: ${esc(n[l.teacher_id])}</p>` : ''}
      ${l.note ? `<p class="muted" style="white-space:pre-wrap">${esc(l.note)}</p>` : ''}
      ${isT && !cxl ? `<h4>Скасувати урок</h4><div class="flex">
        <button class="btn small secondary" data-sc-cxt>Скасовано викладачем</button>
        <button class="btn small secondary" data-sc-cxs>Скасовано учнем</button></div>
        <h4>Перенести</h4><div class="flex"><input type="date" id="sc-mv-d" value="${dkey(s)}"><input type="time" id="sc-mv-t" value="${hm(s)}">
        <button class="btn small" data-sc-mv>Перенести</button></div>
        <p class="muted small">Урок також можна перетягнути мишею в календарі.</p>` : ''}
      ${isT && cxl ? '<div class="flex"><button class="btn small" data-sc-restore>Відновити урок</button></div>' : ''}
      ${isT ? `<h4>Видалити</h4><div class="flex"><button class="btn small danger" data-sc-del>Видалити урок</button>
        <button class="btn small danger" data-sc-delall>Видалити всі майбутні уроки учня</button></div>` : ''}`);
    const $ = x => m.querySelector(x);
    const setStatus = async st => {
      const { error } = await sb.from('lesson_schedule').update({ status: st }).eq('id', l.id);
      if (error) return toast(error.message, true);
      closeModal(); toast(st === 'planned' ? 'Урок відновлено' : 'Урок скасовано'); renderApp();
    };
    if ($('[data-sc-cxt]')) $('[data-sc-cxt]').onclick = () => setStatus('cancelled_teacher');
    if ($('[data-sc-cxs]')) $('[data-sc-cxs]').onclick = () => setStatus('cancelled_student');
    if ($('[data-sc-restore]')) $('[data-sc-restore]').onclick = () => setStatus('planned');
    if ($('[data-sc-mv]')) $('[data-sc-mv]').onclick = async () => {
      const d = $('#sc-mv-d').value, t = $('#sc-mv-t').value;
      if (!d || !t) return toast('Вкажіть дату й час', true);
      const [y, mo, dd] = d.split('-').map(Number), [hh, mi] = t.split(':').map(Number);
      try { if (await moveLesson(l, new Date(y, mo - 1, dd, hh, mi))) closeModal(); }
      catch (err) { toast(err.message || String(err), true); }
    };
    if ($('[data-sc-del]')) $('[data-sc-del]').onclick = async () => {
      const { error } = await sb.from('lesson_schedule').delete().eq('id', l.id);
      if (error) return toast(error.message, true);
      closeModal(); renderApp();
    };
    if ($('[data-sc-delall]')) $('[data-sc-delall]').onclick = async () => {
      if (!confirm('Видалити ВСІ майбутні уроки цього учня з розкладу?')) return;
      const { error } = await sb.from('lesson_schedule').delete().eq('student_id', l.student_id).gte('starts_at', new Date().toISOString());
      if (error) return toast(error.message, true);
      closeModal(); toast('Майбутні уроки видалено'); renderApp();
    };
  };

  /* ---------- перетягування уроків мишею ---------- */
  let suppressClick = false;
  window.addEventListener('click', ev => {
    if (suppressClick) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);

  document.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'touch' || ev.button !== 0) return;
    const el = ev.target.closest && ev.target.closest('.sc-ev[data-drag]');
    if (!el) return;
    const l = S.sch.items.find(x => String(x.id) === el.dataset.id);
    if (!l) return;
    const dur = +l.duration_min || 60, sx = ev.clientX, sy = ev.clientY;
    const grab = ev.clientY - el.getBoundingClientRect().top;
    const prev = document.createElement('div');
    prev.className = 'sc-ev sc-drop';
    let dragging = false, target = null;

    const mv = e => {
      if (!dragging) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
        dragging = true; el.classList.add('sc-dim'); document.body.classList.add('sc-dragging');
      }
      e.preventDefault();
      const body = [...document.querySelectorAll('.sc-body')].find(b => {
        const r = b.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right;
      });
      if (!body) { target = null; prev.remove(); return; }
      const r = body.getBoundingClientRect(), h0 = +body.closest('.sc-grid').dataset.h0;
      let min = Math.round((h0 * 60 + ((e.clientY - r.top - grab) / PX) * 60) / 15) * 15;
      min = Math.max(h0 * 60, Math.min(min, h0 * 60 + (r.height / PX) * 60 - dur));
      target = { day: body.dataset.day, min };
      if (prev.parentNode !== body) body.appendChild(prev);
      prev.style.top = ((min - h0 * 60) * PX / 60) + 'px';
      prev.style.height = Math.max(dur * PX / 60 - 2, 24) + 'px';
      prev.textContent = fmtMin(min) + '–' + fmtMin(min + dur);
    };
    const stop = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      prev.remove(); el.classList.remove('sc-dim'); document.body.classList.remove('sc-dragging');
    };
    const up = async () => {
      const was = dragging, t = target;
      stop();
      if (!was) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 80);
      if (!t) return;
      const [y, mo, d] = t.day.split('-').map(Number);
      const nd = new Date(y, mo - 1, d, Math.floor(t.min / 60), t.min % 60);
      if (nd.getTime() === new Date(l.starts_at).getTime()) return;
      try { await moveLesson(l, nd); } catch (err) { toast(err.message || String(err), true); }
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
  });

  if (S.profile) renderApp();
})();
