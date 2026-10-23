/* MathSpace Stage 21 — clipboard/drop/file photo import for Gemini.
   Load after stage18_1.js, stage19.js and stage20.js (when present).
   Enhances only forms aigen, libaigen, hwai and lt181ai.
*/
(function () {
  'use strict';
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const SELECTOR = 'form[data-form="aigen"],form[data-form="libaigen"],form[data-form="hwai"],form[data-form="lt181ai"],form[data-form="lt181hwai"]';
  const MAX = 5;
  const SIZE = 4_500_000; // compatible with current homework/library limits
  const state = new WeakMap();
  const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const say = msg => { if (typeof toast === 'function') toast(msg, true); else alert(msg); };
  const css = document.createElement('style');
  css.textContent = `
  .ms21-zone{border:2px dashed #bdb1e8;background:#faf8ff;border-radius:14px;padding:14px;margin:8px 0;outline:none;cursor:pointer;transition:background .15s,border-color .15s}
  .ms21-zone:focus,.ms21-zone.ms21-over{background:#eee9ff;border-color:#7660dd}
  .ms21-zone strong{display:block;margin-bottom:3px;color:#463688}
  .ms21-zone p{margin:4px 0;color:#69617d;font-size:13px}
  .ms21-preview{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0}
  .ms21-thumb{width:115px;border:1px solid #e4dff2;border-radius:10px;padding:5px;background:white}
  .ms21-thumb img{width:100%;height:82px;object-fit:contain;border-radius:6px}
  .ms21-thumb small{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ms21-thumb button{width:100%;margin-top:5px;font-size:12px;padding:5px;border:1px solid #dbcfe8;border-radius:6px;background:#faf7ff;cursor:pointer}
  `;
  document.head.appendChild(css);
  function context(form) { return state.get(form); }
  function sync(form) {
    const st = context(form);
    if (!st) return;
    const dt = new DataTransfer();
    st.files.forEach(f => dt.items.add(f));
    st.input.files = dt.files;
    st.input.required = true;
    st.count.textContent = `${st.files.length} / ${MAX} фото`;
    st.preview.replaceChildren();
    st.urls.forEach(u => URL.revokeObjectURL(u));
    st.urls = [];
    st.files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      st.urls.push(url);
      const card = document.createElement('div'); card.className = 'ms21-thumb';
      const img = document.createElement('img'); img.src = url; img.alt = 'Фото ' + (index + 1);
      const label = document.createElement('small'); label.textContent = file.name || `Зображення ${index+1}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Видалити';
      remove.addEventListener('click', () => {
        st.files.splice(index,1);
        sync(form);
      });
      card.append(img, label, remove); st.preview.append(card);
    });
  }
  // Великі фото стискаємо до JPEG 1600 px, а не відхиляємо
  async function shrink(f) {
    if (f.size <= SIZE && f.size <= 1_500_000) return f;
    if (typeof resizeToJpeg !== 'function') return f;
    try {
      const blob = await resizeToJpeg(f, 1600);
      return new File([blob], (f.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return f; }
  }
  async function add(form, items) {
    const st = context(form);
    if (!st) return;
    const files = Array.from(items || []);
    let added = 0;
    for (let f of files) {
      if (!(f instanceof File) || !TYPES.has(f.type)) continue;
      if (st.files.length >= MAX) { say('Можна додати не більше 5 фотографій'); break; }
      f = await shrink(f);
      if (f.size > SIZE) { say(`Фото «${f.name || 'без назви'}» занадто велике навіть після стискання`); continue; }
      if (st.files.length >= MAX) { say('Можна додати не більше 5 фотографій'); break; }
      st.files.push(f); added++;
    }
    if (added) sync(form);
    else if (files.length && !files.some(f => TYPES.has(f.type))) say('Підтримуються JPG, PNG та WEBP');
  }
  function mount(form) {
    if (context(form)) return;
    const input = form.querySelector('input[type="file"]');
    if (!input) return;
    const zone = document.createElement('div'); zone.className = 'ms21-zone';
    zone.tabIndex = 0;
    zone.setAttribute('role','group');
    zone.setAttribute('aria-label','Вставте фото через Ctrl+V або перетягніть сюди');
    zone.innerHTML = '<strong>Вставте фото: Ctrl + V</strong><p>Або перетягніть зображення сюди, або виберіть файл нижче.</p><p>JPG, PNG, WEBP · до 5 фото · не більше 4,5 МБ кожне</p>';
    const preview = document.createElement('div'); preview.className = 'ms21-preview';
    const count = document.createElement('div'); count.className = 'muted small'; count.setAttribute('aria-live','polite');
    input.before(zone); input.after(count, preview);
    const st = {input, files: Array.from(input.files || []), preview, count, urls: []};
    state.set(form, st);
    input.addEventListener('change', () => {
      const picked = Array.from(input.files || []);
      // File picker adds to the existing clipboard/drop collection.
      add(form, picked);
      if (!picked.length) sync(form);
    });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('ms21-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('ms21-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('ms21-over');
      const files = Array.from(e.dataTransfer?.files || []);
      add(form, files);
    });
    zone.addEventListener('paste', e => {
      const files = Array.from(e.clipboardData?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return; e.preventDefault(); e.stopPropagation(); add(form, files);
    });
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }});
    zone.addEventListener('click', () => zone.focus());
    // Clipboard paste while focused within this form (e.g. its native file input).
    form.addEventListener('paste', e => {
      if (e.target.closest('.ms21-zone') || e.target.closest('input[type=text],textarea,[contenteditable]')) return;
      const files = Array.from(e.clipboardData?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return; e.preventDefault(); add(form, files);
    });
    sync(form);
  }
  function discover() { document.querySelectorAll(SELECTOR).forEach(mount); }
  let scheduled = false;
  const obs = new MutationObserver(() => { if (scheduled) return; scheduled = true; queueMicrotask(() => {scheduled = false; discover();}); });
  obs.observe(document.documentElement,{childList:true,subtree:true});
  discover();
})();
