/* MathSpace Stage 32 — delete homework photos from storage after the teacher marks the work reviewed.
   Requires 32_delete_homework_photos.sql. Load AFTER stage27.js (and stage19.js). */
(function () {
  'use strict';
  if (window.__ms32) return;
  window.__ms32 = true;
  if (typeof A === 'undefined' || typeof F === 'undefined' || typeof sb === 'undefined') {
    console.error('MathSpace Stage 32: A/F/sb not available. Check script order.');
    return;
  }
  const BUCKET = 'homework-photos';
  const say = (m, bad) => { if (typeof toast === 'function') toast(m, !!bad); else alert(m); };

  async function pathsOf(lid, sid) {
    try {
      const r = await sb.from('homework_submissions').select('image_path,image_paths')
        .eq('lesson_id', lid).eq('student_id', sid).maybeSingle();
      if (r.error || !r.data) return [];
      const list = Array.isArray(r.data.image_paths) && r.data.image_paths.length
        ? r.data.image_paths : (r.data.image_path ? [r.data.image_path] : []);
      return list.filter(Boolean);
    } catch (e) { return []; }
  }

  async function cleanup(paths) {
    if (!paths.length) return;
    try {
      const { data, error } = await sb.storage.from(BUCKET).remove(paths);
      if (error) throw error;
      // При відсутньому дозволі Supabase не дає помилки, а просто повертає менше елементів
      if ((data || []).length < paths.length) {
        say('Роботу перевірено, але фото не видалилося. Виконайте 32_delete_homework_photos.sql у Supabase.', true);
      } else {
        say('Фото видалено зі сховища');
      }
    } catch (e) {
      say('Роботу перевірено, але фото не видалилося: ' + (e.message || e), true);
    }
  }

  // Кнопка «Позначити перевіреним» у черзі ДЗ (stage27)
  if (typeof A.msHomeworkMarkReviewed === 'function') {
    const base = A.msHomeworkMarkReviewed;
    A.msHomeworkMarkReviewed = async function (button) {
      const paths = await pathsOf(button.dataset.lid, button.dataset.student);
      const out = await base.apply(this, arguments);   // якщо перевірка не вдалась, тут буде виняток і фото лишаться
      await cleanup(paths);
      return out;
    };
  }

  // Форма коментаря зі сторінки уроку (stage19)
  if (typeof F.hwreview === 'function') {
    const base = F.hwreview;
    F.hwreview = async function (form) {
      const paths = await pathsOf(form.dataset.lid, form.dataset.student);
      const out = await base.apply(this, arguments);
      await cleanup(paths);
      return out;
    };
  }

  // Підказка для викладача
  function note() {
    document.querySelectorAll('[data-act="msHomeworkMarkReviewed"],form[data-form="hwreview"]').forEach(el => {
      const host = el.tagName === 'FORM' ? el : el.parentElement;
      if (!host || host.querySelector('.ms32-note')) return;
      const p = document.createElement('p');
      p.className = 'muted small ms32-note';
      p.textContent = 'Після перевірки фото цієї роботи буде остаточно видалено зі сховища.';
      el.tagName === 'FORM' ? el.appendChild(p) : el.insertAdjacentElement('beforebegin', p);
    });
  }
  document.addEventListener('ms:rendered', note);
  note();
})();
