/* MathSpace · етап 6 (v2): читабельний шрифт і малюнки до завдань.
   Підключається ПІСЛЯ stage5.js. Спершу має бути виконаний 04_images.sql */
(function () {
  'use strict';

  /* ---------- доступ до глобальних змінних (без eval) ---------- */
  const esc6 = typeof esc === 'function' ? esc : s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const say = m => { if (typeof toast === 'function') toast(m); else alert(m); };
  const redraw = () => { if (typeof renderApp === 'function') renderApp(); else location.reload(); };

  function resizeImg(file, max) {
    if (typeof resizeToJpeg === 'function') return resizeToJpeg(file, max);
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok(b) : fail(new Error('Не вдалося обробити фото')), 'image/jpeg', 0.85);
      };
      im.onerror = () => fail(new Error('Не вдалося прочитати фото'));
      im.src = url;
    });
  }

  /* ---------- читабельність ---------- */
  try {
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
.qimg{display:block;max-width:100%;max-height:420px;margin:10px 0;border-radius:12px;border:1px solid #ddd;background:#fff}`;
    document.head.appendChild(st);
  } catch (e) { console.warn('stage6 style', e); }

  /* ---------- малюнки ---------- */
  const BUCKET = 'lessons';
  const client = () => (typeof sb !== 'undefined' ? sb : null);

  async function urls(rows) {
    const sb = client();
    const paths = (rows || []).map(r => r.image_path).filter(Boolean);
    if (!sb || !paths.length) return {};
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    return Object.fromEntries((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
  }
  const imgTag = u => `<img class="qimg" src="${esc6(u)}" alt="Малюнок до завдання">`;

  function after(html, marker, tag, add) {
    const i = html.indexOf(marker);
    if (i < 0) return html;
    const j = html.indexOf(tag, i);
    return j < 0 ? html : html.slice(0, j + tag.length) + add + html.slice(j + tag.length);
  }

  if (typeof studentLesson === 'function') {
    const baseStudent = studentLesson;
    window.studentLesson = (async function (lid) {
      let html = await baseStudent.apply(this, arguments);
      try {
        const sb = client();
        if (!sb || typeof html !== 'string' || !html.includes('data-q="')) return html;
        const r = await sb.from('questions').select('id,image_path').eq('lesson_id', lid);
        if (r.error) return html;
        const u = await urls(r.data);
        for (const q of r.data)
          if (q.image_path && u[q.image_path])
            html = after(html, `data-q="${q.id}"`, '</p>', imgTag(u[q.image_path]));
      } catch (e) { console.warn('stage6 student', e); }
      return html;
    });
  } else console.warn('stage6: studentLesson не знайдено');

  if (typeof staffLesson === 'function') {
    const baseStaff = staffLesson;
    window.staffLesson = (async function (sid, lid) {
      let html = await baseStaff.apply(this, arguments);
      try {
        const sb = client();
        if (!sb || typeof html !== 'string') return html;
        const r = await sb.from('questions').select('id,image_path').eq('lesson_id', lid);
        if (r.error) return html;
        const u = await urls(r.data);
        for (const q of r.data) {
          const btn = `<button class="btn small danger" data-act="delq" data-id="${q.id}">Видалити</button>`;
          if (!html.includes(btn)) continue;
          const hasImg = q.image_path && u[q.image_path];
          const ctl = `<div style="flex-basis:100%">${hasImg ? imgTag(u[q.image_path]) : ''}
        <form data-form="qimg" data-qid="${q.id}" data-sid="${sid}" data-lid="${lid}" data-old="${esc6(q.image_path || '')}" class="flex">
          <input type="file" accept="image/jpeg,image/png,image/webp" required style="flex:1;min-width:200px;max-width:340px">
          <button class="btn small secondary">${hasImg ? 'Замінити малюнок' : 'Додати малюнок'}</button>
          ${hasImg ? `<button type="button" class="btn small danger" data-act="rmqimg" data-qid="${q.id}" data-old="${esc6(q.image_path)}">Прибрати</button>` : ''}
        </form></div>`;
          html = html.replace(btn, () => btn + ctl);
        }
      } catch (e) { console.warn('stage6 staff', e); }
      return html;
    });
  } else console.warn('stage6: staffLesson не знайдено');

  const Fobj = typeof F !== 'undefined' ? F : null;
  const Aobj = typeof A !== 'undefined' ? A : null;

  if (Fobj) {
    Fobj.qimg = async function (f) {
      const sb = client();
      const file = f.querySelector('input[type=file]').files[0];
      if (!file) throw new Error('Оберіть файл');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Дозволені лише JPG, PNG або WEBP');
      if (file.size > 15 * 1024 * 1024) throw new Error('Файл більший за 15 МБ');
      const blob = await resizeImg(file, 1600);
      const path = `${f.dataset.sid}/${f.dataset.lid}/q-${Date.now()}.jpg`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.rpc('set_question_image', { p_question: f.dataset.qid, p_path: path });
      if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
      if (f.dataset.old) await sb.storage.from(BUCKET).remove([f.dataset.old]);
      say('Малюнок збережено');
      redraw();
    };
  } else console.warn('stage6: F не знайдено');

  if (Aobj) {
    Aobj.rmqimg = async function (el) {
      const sb = client();
      const { error } = await sb.rpc('set_question_image', { p_question: el.dataset.qid, p_path: null });
      if (error) throw error;
      if (el.dataset.old) await sb.storage.from(BUCKET).remove([el.dataset.old]);
      say('Малюнок прибрано');
      redraw();
    };
  } else console.warn('stage6: A не знайдено');

  try { if (typeof S !== 'undefined' && S.profile) redraw(); } catch (e) { /* ігноруємо */ }
})();
