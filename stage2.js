/* MathSpace · етап 2. Підключається одним рядком у index.html: <script src="stage2.js"></script> */
(function(){
  const st = document.createElement('style');
  st.textContent = `textarea{width:100%;border:1px solid #e3dfed;border-radius:12px;padding:11px 13px;background:#fff;color:var(--ink);font:inherit;resize:vertical}
textarea:focus{outline:2px solid #cfc4fb;border-color:var(--brand)}
.opt{display:flex;align-items:center;gap:8px;margin:8px 0;font-weight:500}
.opt input{width:auto}`;
  document.head.appendChild(st);
  const base = tabs;
  window.tabs = function () {
    const t = base();
    const i = t.findIndex(x => x[0] === 'profile');
    t.splice(i < 0 ? t.length : i, 0, ['lessons', 'Уроки', '📚']);
    return t;
  };
})();
/* ===== Етап 2: уроки й тести ===== */
const QT = { single: 'Один варіант', multiple: 'Кілька варіантів', truefalse: 'Правда / неправда', short: 'Коротка відповідь', long: 'Розгорнута відповідь' };
const rt = () => location.hash.split('/'); // ['#','t','lessons', id1, id2]
const isStaff = () => S.profile.role !== 'student';
const must = (...rs) => rs.forEach(r => { if (r.error) throw r.error; });
const back = (h, t) => `<p><a href="${h}">← ${t}</a></p>`;

TAB.lessons = async function () {
  const p = rt();
  if (!isStaff()) return p[3] ? studentLesson(p[3]) : studentList();
  if (!p[3]) return staffStudents();
  return p[4] ? staffLesson(p[3], p[4]) : staffLessons(p[3]);
};

/* --- учень --- */
async function studentList() {
  const r = await sb.from('lessons').select('id,title,description,published_at').order('published_at', { ascending: false });
  must(r);
  return `<div class="card"><h2>Мої уроки</h2>${r.data.map(l => `<div class="row"><div><b>${esc(l.title)}</b><div class="muted small">${esc(l.description)}</div></div><a class="btn small" href="#/t/lessons/${l.id}">Відкрити</a></div>`).join('') || '<div class="empty">Уроків поки немає.</div>'}</div>`;
}

function qInput(q) {
  const n = 'q_' + q.id;
  if (q.qtype === 'single' || q.qtype === 'multiple')
    return (q.options || []).map((o, i) => `<label class="opt"><input type="${q.qtype === 'single' ? 'radio' : 'checkbox'}" name="${n}" value="${i}"> ${esc(o)}</label>`).join('');
  if (q.qtype === 'truefalse')
    return `<label class="opt"><input type="radio" name="${n}" value="true"> Правда</label><label class="opt"><input type="radio" name="${n}" value="false"> Неправда</label>`;
  if (q.qtype === 'long') return `<textarea name="${n}" rows="5" maxlength="5000"></textarea>`;
  return `<input name="${n}" maxlength="200" autocomplete="off">`;
}

async function studentLesson(lid) {
  const [l, q, a] = await Promise.all([
    sb.from('lessons').select('*').eq('id', lid).single(),
    sb.from('questions').select('*').eq('lesson_id', lid).order('sort_order'),
    sb.from('attempts').select('*').eq('lesson_id', lid).order('created_at', { ascending: false })]);
  must(l, q, a);
  const last = S.last && S.last.lid === lid ? S.last.res : null;
  S.last = null;
  let result = '';
  if (last) {
    const m = Object.fromEntries(last.results.map(r => [r.question_id, r]));
    result = `<div class="card hero"><div class="eyebrow">Результат</div><h2>${last.auto_score} / ${last.max_score}</h2>
      ${last.status === 'pending_review' ? '<div class="notice warn">Розгорнуті відповіді перевірить викладач, і бали зміняться.</div>' : ''}
      ${q.data.map((x, i) => { const r = m[x.id] || {}; const mark = r.needs_review ? '⏳' : r.is_correct ? '✅' : '❌';
        return `<div class="row"><div><b>${i + 1}. ${mark}</b> ${esc(x.prompt)}${r.explanation ? `<div class="muted small">${esc(r.explanation)}</div>` : ''}</div><span class="pill">${r.needs_review ? 'на перевірці' : r.points + ' б.'}</span></div>`; }).join('')}</div>`;
  }
  const hist = a.data.length ? `<div class="card"><h2>Мої спроби</h2>${a.data.map(t => `<div class="row"><span>${fmtDate(t.created_at)}</span><span class="pill ${t.status === 'graded' ? 'green' : 'amber'}">${+t.auto_score + +t.manual_score} / ${t.max_score}${t.status === 'graded' ? '' : ' · на перевірці'}</span></div>`).join('')}</div>` : '';
  const form = q.data.length ? `<form data-form="attempt" data-lid="${lid}">${q.data.map((x, i) => `<div class="card" data-q="${x.id}" data-t="${x.qtype}"><div class="flex"><b>${i + 1}.</b><span class="pill blue">${x.points} б.</span></div><p style="white-space:pre-wrap">${esc(x.prompt)}</p>${qInput(x)}</div>`).join('')}<button class="btn">Відправити відповіді</button></form>` : '<div class="empty">У цьому уроці немає тесту.</div>';
  return `${back('#/t/lessons', 'До уроків')}<div class="card"><h2>${esc(l.data.title)}</h2><div class="muted" style="white-space:pre-wrap">${esc(l.data.description)}</div></div>${result}${form}${hist}`;
}

/* --- викладач / власниця / адміністратор --- */
async function staffStudents() {
  const st = (await getPeople()).filter(p => p.role === 'student');
  return `<div class="card"><h2>Оберіть учня</h2>${st.map(s => personRow(s, `<a class="btn small" href="#/t/lessons/${s.id}">Уроки</a>`)).join('') || '<div class="empty">Учнів поки немає.</div>'}</div>`;
}

async function staffLessons(sid) {
  const [ppl, ls] = await Promise.all([getPeople(), sb.from('lessons').select('id,title,status,created_at').eq('student_id', sid).order('created_at', { ascending: false })]);
  must(ls);
  const s = ppl.find(p => p.id === sid);
  if (!s) throw new Error('Учня не знайдено');
  return `${back('#/t/lessons', 'До списку учнів')}<div class="card"><h2>Новий урок для: ${esc(fullName(s))}</h2>
    <form data-form="newlesson" data-sid="${sid}"><div class="field"><label>Назва</label><input name="title" required maxlength="200"></div>
    <div class="field"><label>Опис або тема</label><textarea name="desc" rows="3" maxlength="5000"></textarea></div><button class="btn">Створити чернетку</button></form></div>
    <div class="card"><h2>Уроки</h2>${ls.data.map(l => `<div class="row"><b>${esc(l.title)}</b><div class="end"><span class="pill ${l.status === 'published' ? 'green' : 'amber'}">${l.status === 'published' ? 'опубліковано' : 'чернетка'}</span><a class="btn small" href="#/t/lessons/${sid}/${l.id}">Відкрити</a></div></div>`).join('') || '<div class="empty">Уроків ще немає.</div>'}</div>`;
}

async function staffLesson(sid, lid) {
  const [l, q, att] = await Promise.all([
    sb.from('lessons').select('*').eq('id', lid).single(),
    sb.from('questions').select('*').eq('lesson_id', lid).order('sort_order'),
    sb.from('attempts').select('*').eq('lesson_id', lid).order('created_at', { ascending: false }).limit(20)]);
  must(l, q, att);
  const ids = q.data.map(x => x.id), aids = att.data.map(x => x.id);
  const [k, an] = await Promise.all([
    ids.length ? sb.from('question_keys').select('*').in('question_id', ids) : { data: [] },
    aids.length ? sb.from('attempt_answers').select('*').in('attempt_id', aids) : { data: [] }]);
  must(k, an);
  const key = Object.fromEntries(k.data.map(x => [x.question_id, x]));
  const pub = l.data.status === 'published';
  const qs = q.data.map((x, i) => {
    const c = (key[x.id] || {}).correct;
    let ans = '';
    if (x.qtype === 'single' || x.qtype === 'multiple')
      ans = (x.options || []).map((o, j) => `<div class="small">${(x.qtype === 'single' ? c === j : (c || []).includes(j)) ? '✅' : '▫️'} ${j + 1}. ${esc(o)}</div>`).join('');
    else if (x.qtype === 'truefalse') ans = `<div class="small">✅ ${c ? 'Правда' : 'Неправда'}</div>`;
    else if (x.qtype === 'short') ans = `<div class="small">✅ ${esc((c || []).join(' | '))}</div>`;
    else ans = '<div class="muted small">Перевіряє викладач вручну</div>';
    return `<div class="row"><div style="flex:1;min-width:240px"><div class="flex"><b>${i + 1}.</b><span class="pill">${QT[x.qtype] || x.qtype}</span><span class="pill blue">${x.points} б.</span></div><div style="white-space:pre-wrap;margin:6px 0">${esc(x.prompt)}</div>${ans}</div><button class="btn small danger" data-act="delq" data-id="${x.id}">Видалити</button></div>`;
  }).join('') || '<div class="empty">Завдань ще немає. Додайте перше нижче.</div>';
  const attHtml = att.data.map(t => {
    const rows = an.data.filter(a => a.attempt_id === t.id && ['long', 'photo'].includes(a.snapshot.type))
      .sort((a, b) => a.snapshot.sort_order - b.snapshot.sort_order)
      .map(a => `<div style="margin-top:10px"><b class="small">${esc(a.snapshot.prompt)}</b><div class="notice" style="white-space:pre-wrap">${esc(a.answer ?? '—')}</div>
        <form data-form="review" data-id="${a.id}" class="flex"><input name="pts" type="number" min="0" max="${a.snapshot.points}" step="0.5" required value="${a.points_awarded ?? ''}" placeholder="бали (макс. ${a.snapshot.points})" style="width:170px"><input name="c" maxlength="2000" value="${esc(a.teacher_comment)}" placeholder="коментар" style="flex:1;min-width:160px"><button class="btn small">Зберегти</button></form></div>`).join('');
    return `<div class="row" style="display:block"><div class="row" style="border:0;padding:0"><b>${fmtDate(t.created_at)}</b><span class="pill ${t.status === 'graded' ? 'green' : 'amber'}">${+t.auto_score + +t.manual_score} / ${t.max_score}${t.status === 'graded' ? '' : ' · чекає перевірки'}</span></div>${rows}</div>`;
  }).join('') || '<div class="empty">Спроб ще не було.</div>';
  return `${back('#/t/lessons/' + sid, 'До уроків учня')}
    <div class="card"><div class="flex" style="justify-content:space-between"><h2 style="margin:0">Урок</h2><span class="pill ${pub ? 'green' : 'amber'}">${pub ? 'опубліковано' : 'чернетка'}</span></div>
      <form data-form="editlesson" data-id="${lid}" style="margin-top:14px"><div class="field"><label>Назва</label><input name="title" required maxlength="200" value="${esc(l.data.title)}"></div>
      <div class="field"><label>Опис або тема</label><textarea name="desc" rows="3" maxlength="5000">${esc(l.data.description)}</textarea></div>
      <div class="flex"><button class="btn secondary">Зберегти</button>
      <button type="button" class="btn" data-act="publish" data-id="${lid}" data-v="${pub ? 0 : 1}">${pub ? 'Повернути в чернетку' : 'Опублікувати для учня'}</button>
      ${pub ? '' : `<button type="button" class="btn danger" data-act="dellesson" data-id="${lid}" data-sid="${sid}">Видалити урок</button>`}</div></form></div>
    <div class="card"><h2>Завдання тесту (${q.data.length})</h2>${qs}</div>
    <div class="card"><h2>Додати завдання</h2>
      <form data-form="addq" data-lid="${lid}">
        <div class="two"><div class="field"><label>Тип</label><select name="type">${Object.entries(QT).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
        <div class="field"><label>Балів</label><input name="points" type="number" min="0.5" max="100" step="0.5" value="1" required></div></div>
        <div class="field"><label>Умова</label><textarea name="prompt" rows="3" required maxlength="4000"></textarea></div>
        <div class="field"><label>Варіанти (кожен з нового рядка; лише для типів з вибором)</label><textarea name="options" rows="4"></textarea></div>
        <div class="field"><label>Правильна відповідь: № варіанта · кілька номерів через кому · «так»/«ні» · для короткої відповіді допустимі варіанти через « | » (кілька значень в одній відповіді через «;»)</label><input name="correct"></div>
        <div class="field"><label>Пояснення для учня (необов’язково)</label><input name="expl" maxlength="2000"></div>
        <button class="btn">Додати завдання</button></form></div>
    <div class="card"><h2>Спроби учня</h2>${attHtml}</div>`;
}

Object.assign(A, {
  async publish(el) {
    const { error } = await sb.rpc('publish_lesson', { p_lesson: el.dataset.id, p_publish: el.dataset.v === '1' });
    if (error) throw error;
    toast(el.dataset.v === '1' ? 'Урок опубліковано' : 'Урок повернено в чернетку');
    renderApp();
  },
  async delq(el) {
    if (!window.confirm('Видалити це завдання?')) return;
    const { error } = await sb.rpc('delete_question', { p_question: el.dataset.id });
    if (error) throw error;
    renderApp();
  },
  async dellesson(el) {
    if (!window.confirm('Видалити цей урок разом із завданнями?')) return;
    const { error } = await sb.from('lessons').delete().eq('id', el.dataset.id);
    if (error) throw error;
    toast('Урок видалено');
    location.hash = '#/t/lessons/' + el.dataset.sid;
  }
});

Object.assign(F, {
  async newlesson(f) {
    const fd = new FormData(f);
    const { data, error } = await sb.from('lessons').insert({ student_id: f.dataset.sid, title: fd.get('title').trim(), description: (fd.get('desc') || '').trim() }).select('id').single();
    if (error) throw error;
    location.hash = `#/t/lessons/${f.dataset.sid}/${data.id}`;
  },
  async editlesson(f) {
    const fd = new FormData(f);
    const { error } = await sb.from('lessons').update({ title: fd.get('title').trim(), description: (fd.get('desc') || '').trim() }).eq('id', f.dataset.id);
    if (error) throw error;
    toast('Збережено');
  },
  async addq(f) {
    const fd = new FormData(f), t = fd.get('type'), c = (fd.get('correct') || '').trim();
    let options = null, correct = null;
    if (t === 'single' || t === 'multiple') options = (fd.get('options') || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (t === 'single') {
      correct = Number(c) - 1;
      if (!c || !Number.isInteger(correct)) throw new Error('Вкажіть номер правильного варіанта');
    } else if (t === 'multiple') {
      correct = c.split(',').map(x => Number(x.trim()) - 1);
      if (!c || correct.some(x => !Number.isInteger(x))) throw new Error('Вкажіть номери правильних варіантів через кому');
    } else if (t === 'truefalse') {
      const v = c.toLowerCase();
      if (['так', 'правда', 'true'].includes(v)) correct = true;
      else if (['ні', 'неправда', 'false'].includes(v)) correct = false;
      else throw new Error('Вкажіть «так» або «ні»');
    } else if (t === 'short') {
      correct = c.split('|').map(x => x.trim()).filter(Boolean);
    }
    const { error } = await sb.rpc('save_question', {
      p_lesson: f.dataset.lid, p_id: null, p_type: t, p_prompt: fd.get('prompt').trim(),
      p_options: options, p_correct: correct, p_points: Number(fd.get('points')), p_explanation: (fd.get('expl') || '').trim()
    });
    if (error) throw error;
    toast('Завдання додано');
    renderApp();
  },
  async attempt(f) {
    const ans = {};
    for (const q of f.querySelectorAll('[data-q]')) {
      const id = q.dataset.q, t = q.dataset.t;
      if (t === 'multiple') ans[id] = [...q.querySelectorAll('input:checked')].map(c => Number(c.value));
      else if (t === 'single' || t === 'truefalse') {
        const c = q.querySelector('input:checked');
        if (c) ans[id] = t === 'single' ? Number(c.value) : c.value === 'true';
      } else {
        const v = q.querySelector('input,textarea').value.trim();
        if (v) ans[id] = v;
      }
    }
    const { data, error } = await sb.rpc('submit_attempt', { p_lesson: f.dataset.lid, p_answers: ans });
    if (error) throw error;
    S.last = { lid: f.dataset.lid, res: data };
    toast('Відповіді відправлено');
    renderApp();
    window.scrollTo(0, 0);
  },
  async review(f) {
    const fd = new FormData(f);
    const { error } = await sb.rpc('review_answer', { p_answer: f.dataset.id, p_points: Number(fd.get('pts')), p_comment: fd.get('c') || '' });
    if (error) throw error;
    toast('Оцінку збережено');
    renderApp();
  }
});


if (S.profile) renderApp();
