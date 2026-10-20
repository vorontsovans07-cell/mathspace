/* MathSpace · етап 3б: «Розпочати тест» і таймер. Підключається ПІСЛЯ stage2.js і stage3.js:
   <script src="stage4.js"></script>  (потрібно спершу запустити 03_timer.sql) */
(function () {
  S.test = null;

  // Здача тесту тепер іде через finish_test (його перевіряє сервер)
  const rpc = sb.rpc.bind(sb);
  sb.rpc = async (name, args, opts) => {
    const submit = name === 'submit_attempt';
    const r = await rpc(submit ? 'finish_test' : name, args, opts);
    if (submit && (!r.error || /Час на тест/.test(r.error.message))) {
      S.test = null;
      if (r.error) setTimeout(renderApp, 0);
    }
    return r;
  };

  // --- учень: кнопка старту й таймер ---
  const baseStudent = studentLesson;
  window.studentLesson = async function (lid) {
    const [html, r] = await Promise.all([baseStudent(lid), sb.from('lessons').select('time_limit_minutes').eq('id', lid).single()]);
    if (r.error) throw r.error;
    const i = html.indexOf('<form data-form="attempt"');
    if (i < 0) return html;
    const T = S.test && S.test.lid === lid ? S.test : null;
    if (!T) {
      const j = html.indexOf('</form>', i) + 7, lim = r.data.time_limit_minutes;
      const start = `<div class="card"><h2>Тест</h2><p class="muted">${lim ? `Час на виконання: <b>${lim} хв</b>. Відлік почнеться після натискання кнопки.` : 'Обмеження в часі немає.'}</p>
        <button class="btn" data-act="starttest" data-lid="${lid}">Розпочати тест</button></div>`;
      return html.slice(0, i) + start + html.slice(j);
    }
    const bar = T.deadline ? '<div class="card" style="position:sticky;top:8px;z-index:5;padding:14px 22px"><b>Залишилось: <span id="timer">…</span></b></div>' : '';
    return html.slice(0, i) + bar + html.slice(i);
  };

  A.starttest = async function (el) {
    const { data, error } = await sb.rpc('start_test', { p_lesson: el.dataset.lid });
    if (error) throw error;
    const lim = data.limit_minutes;
    S.test = { lid: el.dataset.lid, sent: false,
      deadline: lim ? Date.now() + (Date.parse(data.started_at) + lim * 60000 - Date.parse(data.now)) : null };
    renderApp();
  };

  setInterval(() => {
    const T = S.test, el = document.getElementById('timer');
    if (!T || !el || !T.deadline) return;
    const ms = T.deadline - Date.now();
    if (ms <= 0) {
      el.textContent = '0:00';
      const f = document.querySelector('form[data-form="attempt"]');
      if (!T.sent && f) { T.sent = true; toast('Час вичерпано, відповіді відправляються'); f.requestSubmit(); }
      return;
    }
    const s = Math.ceil(ms / 1000);
    el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 500);

  // --- викладач: ліміт часу ---
  const baseStaff = staffLesson;
  window.staffLesson = async function (sid, lid) {
    const [html, r] = await Promise.all([baseStaff(sid, lid), sb.from('lessons').select('time_limit_minutes').eq('id', lid).single()]);
    if (r.error) throw r.error;
    const card = `<div class="card"><h2>Час на тест</h2>
      <form data-form="timelimit" data-lid="${lid}" class="flex"><input name="min" type="number" min="1" max="600" value="${r.data.time_limit_minutes ?? ''}" placeholder="хвилин (порожньо — без обмеження)" style="max-width:320px"><button class="btn secondary">Зберегти</button></form>
      <p class="muted small">Відлік починається, коли учень натискає «Розпочати тест». Коли час вичерпано, відповіді відправляються автоматично.</p></div>`;
    const mark = '<div class="card"><h2>Завдання тесту';
    return html.includes(mark) ? html.replace(mark, card + mark) : html + card;
  };

  F.timelimit = async function (f) {
    const v = new FormData(f).get('min');
    const { error } = await sb.from('lessons').update({ time_limit_minutes: v ? Number(v) : null }).eq('id', f.dataset.lid);
    if (error) throw error;
    toast('Збережено');
  };

  if (S.profile) renderApp();
})();
