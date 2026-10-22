/* MathSpace Stage 30 — image support for the shared lesson library editor.
   Load after stage29.js. Requires the tiny exposure patch described in README.md.
   Uses the existing "lesson-library" Storage bucket and lesson_templates.content JSON. */
(function () {
  'use strict';
  const BUCKET = 'lesson-library';
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fail = r => { if (r.error) throw r.error; return r.data; };
  const current = () => window.__MS_LessonLibraryCurrent || null;
  const style = document.createElement('style');
  style.textContent = `
    .ms30-qimage{display:block;margin:10px 0;padding:10px;border:1px solid var(--line,#ded9ec);border-radius:12px}
    .ms30-qimage img{display:block;max-width:min(100%,520px);max-height:320px;object-fit:contain;margin:8px 0;border-radius:8px}
    .ms30-qimage .ms30-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .ms30-qimage input[type=file]{max-width:100%}
    .ms30-qimage .muted{font-size:.9rem}
  `;
  document.head.appendChild(style);

  // The original editor owns the lesson state. The tiny README patch exposes a read-only
  // reference to that state so this extension can safely attach image_path to content items.
  function editorRoot() { return document.querySelector('#lt181-editor'); }
  function addImageControls() {
    const root = editorRoot();
    if (!root) return;
    const forms = [...root.querySelectorAll('form[data-form="lt181question"]')];
    forms.forEach(form => {
      if (form.querySelector('.ms30-qimage')) return;
      const state = current();
      const raw = form.querySelector('[name="qi"]')?.value ?? '';
      const idx = raw === '' ? null : Number(raw);
      const q = idx === null ? null : state?.content?.[idx];
      const box = document.createElement('div');
      box.className = 'ms30-qimage';
      box.innerHTML = `<b>Зображення до завдання</b>
        ${q?.image_path ? `<div class="muted">Зображення вже прикріплене.</div><img alt="Зображення до завдання" src="${esc(sb.storage.from(BUCKET).getPublicUrl(q.image_path).data.publicUrl)}">` : '<div class="muted">Зображення необов’язкове. JPG, PNG або WEBP, до 10 МБ.</div>'}
        <input type="file" accept="image/jpeg,image/png,image/webp" data-ms30-image>
        <div class="ms30-actions">
          ${q?.image_path ? '<button type="button" class="btn small danger" data-ms30-remove>Видалити зображення</button>' : ''}
        </div>`;
      form.appendChild(box);
      const remove = box.querySelector('[data-ms30-remove]');
      if (remove) remove.addEventListener('click', async () => {
        const s = current();
        if (!s || idx === null || !s.id) return alert('Спочатку збережіть урок.');
        if (!confirm('Видалити зображення з цього завдання?')) return;
        try {
          const path = s.content[idx].image_path;
          delete s.content[idx].image_path;
          fail(await sb.from('lesson_templates').update({ content: s.content }).eq('id', s.id));
          if (path) await sb.storage.from(BUCKET).remove([path]);
          if (typeof toast === 'function') toast('Зображення видалено');
          if (typeof renderApp === 'function') renderApp();
        } catch (e) { alert(e.message || String(e)); }
      });
    });
  }

  const originalQuestionSave = F.lt181question;
  if (typeof originalQuestionSave !== 'function') {
    console.error('MathSpace Stage 30: F.lt181question not found. Check script order.');
    return;
  }
  F.lt181question = async function (form) {
    const file = form.querySelector('[data-ms30-image]')?.files?.[0] || null;
    if (!file) return originalQuestionSave.apply(this, arguments);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Зображення має бути JPG, PNG або WEBP.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Зображення має бути не більше 10 МБ.');
    const before = current();
    const qiRaw = form.querySelector('[name="qi"]')?.value ?? '';
    const oldIndex = qiRaw === '' ? null : Number(qiRaw);
    await originalQuestionSave.apply(this, arguments);
    // The native handler validates and persists the lesson. Wait until its state is available.
    const state = current() || before;
    if (!state || !state.id) throw new Error('Урок не збережено. Спочатку збережіть назву уроку, а потім додайте зображення.');
    const index = oldIndex === null ? state.content.length - 1 : oldIndex;
    if (index < 0 || !state.content[index]) throw new Error('Не вдалося визначити завдання для зображення.');
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100);
    const path = `${S.profile.id}/${state.id}/question-${crypto.randomUUID()}-${safeName}`;
    const upload = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    const oldPath = state.content[index].image_path;
    state.content[index].image_path = path;
    const save = await sb.from('lesson_templates').update({ content: state.content }).eq('id', state.id);
    if (save.error) {
      delete state.content[index].image_path;
      await sb.storage.from(BUCKET).remove([path]);
      throw save.error;
    }
    if (oldPath) await sb.storage.from(BUCKET).remove([oldPath]);
    if (typeof toast === 'function') toast('Завдання та зображення збережено');
    if (typeof renderApp === 'function') renderApp();
  };

  // Show existing question images in the list of questions, with a preview.
  function decorateQuestionList() {
    const root = editorRoot(), state = current();
    if (!root || !state?.content) return;
    const heading = [...root.querySelectorAll('h2')].find(h => /^Завдання/.test(h.textContent.trim()));
    const card = heading?.closest('.card');
    if (!card) return;
    const rows = [...card.querySelectorAll('.row')];
    rows.forEach((row, i) => {
      if (row.querySelector('.ms30-preview') || !state.content[i]?.image_path) return;
      const url = sb.storage.from(BUCKET).getPublicUrl(state.content[i].image_path).data.publicUrl;
      const preview = document.createElement('div');
      preview.className = 'ms30-preview muted small';
      preview.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener">Переглянути зображення</a>`;
      row.firstElementChild?.appendChild(preview);
    });
  }

  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      addImageControls();
      decorateQuestionList();
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  addImageControls();
  decorateQuestionList();
})();
