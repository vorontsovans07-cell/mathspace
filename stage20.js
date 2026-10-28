/* MathSpace Stage 20 — вибір інструментів «Тест / Домашнє завдання».
   Підключати ОДИН РАЗ після stage19.js. Не змінює збережені дані або SQL. */
(function () {
  'use strict';
  if (window.__msStage20) return;
  window.__msStage20 = true;
  const choices = {
    get: k => { try { return sessionStorage.getItem('ms20_' + k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { sessionStorage.setItem('ms20_' + k, v); } catch (e) {} }
  };
  const style = document.createElement('style');
  style.textContent = `
    .ms20-picker { border:1px solid #dcd4f9; background:#f8f5ff; }
    .ms20-picker select { width:100%;max-width:430px;margin-top:8px; }
    .ms20-kind[hidden] { display:none !important; }
    .ms20-picker .muted { margin:8px 0 0; }
  `;
  document.head.appendChild(style);

  const base = window.staffLesson;
  if (typeof base !== 'function') return;

  function groupType(card) {
    const heading = card.querySelector('h2,h3');
    if (!heading) return null;
    const name = (heading.textContent || '').replace(/\s+/g,' ').trim().toLocaleLowerCase('uk');
    if (name.startsWith('домашнє завдання')) return 'homework';
    if (/^(завдання тесту|додати завдання|тест із фото|завдання з фото|вставити тест текстом|час на тест)/.test(name)) return 'test';
    // Підтримка наступних версій, де назви інструментів трохи змінені.
    if (card.querySelector('form[data-form="aigen"],form[data-form="addq"],form[data-form="textimport"]')) return 'test';
    if (card.querySelector('form[data-form="hwsettings"],form[data-form="hwadd"],form[data-form="hwai"],form[data-form="hwcopy"]')) return 'homework';
    return null;
  }
  window.staffLesson = async function (...args) {
    const html = await base.apply(this, args);
    if (typeof html !== 'string') return html;
    const lid = String(args[1] || '');
    if (!lid) return html;
    const root = document.createElement('div');
    root.innerHTML = html;
    const cards = [...root.querySelectorAll('.card')].filter(el => !el.closest('.card .card'));
    const groups = cards.map(el => ({el,type:groupType(el)})).filter(x => x.type);
    if (!groups.length) return html;
    const available = new Set(groups.map(x => x.type));
    const selected = choices.get(lid);
    const picker = document.createElement('div');
    picker.className = 'card ms20-picker';
    picker.innerHTML = `<h2>Що хочете створити?</h2>
      <label for="ms20-tool-choice">Оберіть тип роботи</label>
      <select id="ms20-tool-choice" data-ms20-choice="${lid.replace(/[&<>"']/g,'')}" aria-label="Оберіть тип роботи">
        <option value="">— Оберіть —</option>
        ${available.has('test') ? '<option value="test">Тест</option>' : ''}
        ${available.has('homework') ? '<option value="homework">Домашнє завдання</option>' : ''}
      </select>
      <p class="muted small">Спочатку оберіть тип роботи. Потім з’являться відповідні інструменти. Наявні завдання залишаються збереженими.</p>`;
    const first = groups[0].el;
    first.parentNode.insertBefore(picker, first);
    const select = picker.querySelector('select');
    select.value = available.has(selected) ? selected : '';
    groups.forEach(({el,type}) => {
      el.classList.add('ms20-kind');
      el.dataset.ms20Kind = type;
      el.hidden = type !== select.value;
    });
    return root.innerHTML;
  };

  document.addEventListener('change', event => {
    const select = event.target.closest?.('select[data-ms20-choice]');
    if (!select) return;
    choices.set(select.dataset.ms20Choice, select.value);
    // Не запускаємо renderApp(): так не губляться введені, але ще не збережені поля.
    document.querySelectorAll('.ms20-kind[data-ms20-kind]').forEach(el => {
      el.hidden = el.dataset.ms20Kind !== select.value;
    });
  });
})();
