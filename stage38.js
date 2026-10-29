/* MathSpace Stage 38 — search in the test library ("Бібліотека тестів"): by title and by question text.
   No SQL. Load LAST (after stage37.js). */
(function () {
  'use strict';
  if (window.__ms38) return;
  window.__ms38 = true;
  if (typeof sb === 'undefined' || typeof S === 'undefined') { console.error('MathSpace Stage 38: sb/S not available.'); return; }

  let query = '';
  let texts = null;              // test_id -> lower-cased text of all its questions
  let loading = null;

  const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

  async function loadTexts() {
    if (texts) return texts;
    if (loading) return loading;
    loading = (async () => {
      const map = {};
      for (let from = 0; from < 20000; from += 1000) {          // Supabase віддає максимум 1000 рядків за раз
        const r = await sb.from('library_questions').select('test_id,prompt').range(from, from + 999);
        if (r.error) throw r.error;
        r.data.forEach(x => { map[x.test_id] = (map[x.test_id] || '') + ' ' + norm(x.prompt); });
        if (r.data.length < 1000) break;
      }
      texts = map;
      return map;
    })().catch(e => { console.warn('MathSpace Stage 38:', e); loading = null; texts = {}; return texts; });
    return loading;
  }

  function listCard() {
    return [...document.querySelectorAll('.card')].find(c => {
      const h = c.querySelector(':scope > h2');
      return h && h.textContent.trim() === 'Мої тести';
    });
  }

  async function apply() {
    const card = listCard();
    if (!card) return;
    const rows = [...card.querySelectorAll(':scope > .row')];
    const words = norm(query).split(' ').filter(Boolean);
    const map = words.length ? await loadTexts() : {};
    let shown = 0;
    rows.forEach(row => {
      const a = row.querySelector('a[href^="#/t/library/"]');
      const id = a ? a.getAttribute('href').split('/').pop() : '';
      const hay = norm(row.textContent) + ' ' + (map[id] || '');
      const hit = words.every(w => hay.includes(w));
      row.hidden = !hit;
      if (hit) shown++;
    });
    const info = card.querySelector('.ms38-info');
    if (info) info.textContent = words.length ? (shown ? `Знайдено: ${shown} з ${rows.length}` : 'Нічого не знайдено') : '';
  }

  function mount() {
    const card = listCard();
    if (!card || card.querySelector('.ms38-search')) return;
    const h = card.querySelector(':scope > h2');
    const box = document.createElement('div');
    box.className = 'ms38-search';
    box.style.cssText = 'margin:10px 0 6px';
    box.innerHTML = '<input type="search" id="ms38-q" placeholder="Пошук за назвою або текстом завдань…" autocomplete="off" style="width:100%"><div class="muted small ms38-info" style="margin-top:4px" aria-live="polite"></div>';
    h.insertAdjacentElement('afterend', box);
    const input = box.querySelector('input');
    input.value = query;
    let t = null;
    input.addEventListener('input', () => {
      query = input.value;
      clearTimeout(t);
      t = setTimeout(apply, 250);
    });
    apply();
  }

  document.addEventListener('ms:rendered', mount);
  setTimeout(mount, 1000);
})();
