/* MathSpace · етап 5: читабельний шрифт і малюнки до завдань.
   Підключається ПІСЛЯ stage5.js: <script src="stage6.js"></script>  (спершу запустіть 04_images.sql) */
(function () {
  /* --- читабельність --- */
  const lk = document.createElement('link');
  lk.rel = 'stylesheet';
  lk.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(lk);
  const st = document.createElement('style');
  st.textContent = `:root{--ink:#241d38;--muted:#625a78}
body{font-family:"Noto Sans","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;font-size:17px;line-height:1.6}
.small{font-size:14.5px}
.notice{font-size:15.5px}
.pill{font-size:13.5px}
.field label{font-size:14.5px;color:#4d4560}
input,select,textarea,button{font-size:1rem}
.nav{font-size:16px}
[data-q] p{font-size:1.2rem;line-height:1.7;color:var(--ink)}
.opt{font-size:1.1rem}
.qimg{display:block;max-width:100%;max-height:420px;margin:10px 0;border-radius:12px;border:1px solid var(--line);background:#fff}`;
  document.head.appendChild(st);

  /* --- малюнки --- */
  const BUCKET = 'lessons';
  async function urls(rows) {
    const paths = rows.map(r => r.image_path).filter(Boolean);
    if (!paths.length) return {};
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    return Object.fromEntries((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
  }
  const imgTag = u => `<img class="qimg" src="${esc(u)}" alt="Малюнок до завдання">`;
  // вставляє розмітку після умови завдання (<p>) у картці з data-q / після умови в списку викладача
  function after(html, marker, tag, add) {
    const i = html.indexOf(marker);
    if (i < 0) return html;
    const j = html.indexOf(tag, i);
    return j < 0 ? html : html.slice(0, j + tag.length) + add + html.slice(j + tag.length);
  }

  const baseStudent = studentLesson;
  window.studentLesson = async function (lid) {
    let html = await baseStudent(lid);
    if (!html.includes('data-q="')) return html;
    const r = await sb.from('questions').select('id,image_path').eq('lesson_id', lid);
    if (r.error) return html;
    const u = await urls(r.data);
    for (const q of r.data) if (q.image_path && u[q.image_path]) html = after(html, `data-q="${q.id}"`, '</p>', imgTag(u[q.image_path]));
    return html;
  };

  const baseStaff = staffLesson;
  window.staffLesson = async function (sid, lid) {
    let html = await baseStaff(sid, lid);
    const r = await sb.from('questions').select('id,image_path').eq('lesson_id', lid);
    if (r.error) return html;
    const u = await urls(r.data);
    for (const q of r.data) {
      const btn = `<button class="btn small danger" data-act="delq" data-id="${q.id}">Видалити</button>`;
      if (!html.includes(btn)) continue;
      const has = q.image_path && u[q.image_path];
      const ctl = `<div style="flex-basis:100%">${has ? imgTag(u[q.image_path]) : ''}
        <form data-form="qimg" data-qid="${q.id}" data-sid="${sid}" data-lid="${lid}" data-old="${esc(q.image_path || '')}" class="flex">
          <input type="file" accept="image/jpeg,image/png,image/webp" required style="flex:1;min-width:200px;max-width:340px">
          <button class="btn small secondary">${has ? 'Замінити малюнок' : 'Додати малюнок'}</button>
          ${has ? `<button type="button" class="btn small danger" data-act="rmqimg" data-qid="${q.id}" data-old="${esc(q.image_path)}">Прибрати</button>` : ''}
        </form></div>`;
      html = html.replace(btn, btn + ctl);
    }
    return html;
  };

  F.qimg = async function (f) {
    const file = f.querySelector('input[type=file]').files[0];
    if (!file) throw new Error('Оберіть файл');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Дозволені лише JPG, PNG або WEBP');
    if (file.size > 15 * 1024 * 1024) throw new Error('Файл більший за 15 МБ');
    const blob = await resizeToJpeg(file, 1600);
    const path = `${f.dataset.sid}/${f.dataset.lid}/q-${Date.now()}.jpg`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const { error } = await sb.rpc('set_question_image', { p_question: f.dataset.qid, p_path: path });
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    if (f.dataset.old) await sb.storage.from(BUCKET).remove([f.dataset.old]);
    toast('Малюнок збережено');
    renderApp();
  };

  A.rmqimg = async function (el) {
    const { error } = await sb.rpc('set_question_image', { p_question: el.dataset.qid, p_path: null });
    if (error) throw error;
    if (el.dataset.old) await sb.storage.from(BUCKET).remove([el.dataset.old]);
    toast('Малюнок прибрано');
    renderApp();
  };

  if (S.profile) renderApp();
})();
