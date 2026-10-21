/* MathSpace · етап 16: «Вставити тест текстом».
   Викладач вставляє текст тесту, який склав ШІ (формат нижче). Сайт розбирає його на завдання
   й додає в той самий список «Знайдено завдань», що й «Тест із фото (ШІ)». Звідти завдання можна
   відредагувати й додати всі одним натисканням. Працює і в уроці, і в «Бібліотеці тестів».
   Підключається ПІСЛЯ stage15.js. SQL не потрібен. */
(function () {
  'use strict';

  /* ================= промпт для ШІ ================= */
  const PROMPT = String.raw`Склади тест з математики для учня [клас], тема: [тема]. Кількість завдань: [N].
Виведи завдання СУВОРО в такому форматі, без таблиць, без жирного шрифту, без нумерації варіантів літерами чи цифрами:

ЗАВДАННЯ 1
Тип: Один варіант
Балів: 1
Умова: ...
Варіанти:
...
...
...
Відповідь: ...
Пояснення: ...

Правила:
1. Тип лише один із: Один варіант | Кілька варіантів | Правда / неправда | Коротка відповідь | Розгорнута відповідь.
2. Формули пиши у LaTeX в ОДИНАРНИХ знаках долара: $\frac{1}{2}$, $\sqrt{x}$, $x^{2}$, $\le$, $\pi$.
   Не використовуй \( \), \[ \] чи подвійні $$.
3. Варіанти: кожен з нового рядка, без «А)», «1.» тощо. Блок «Варіанти:» лише для типів з вибором.
4. Відповідь:
   - Один варіант: номер правильного варіанта (1, 2, 3...)
   - Кілька варіантів: номери через кому (1,3)
   - Правда / неправда: так або ні
   - Коротка відповідь: допустимі записи через « | », БЕЗ LaTeX, так, як це друкують з клавіатури:
     1/2 | 0.5 ; корінь пиши sqrt(2), число пі pi ; кілька значень в одній відповіді через « ; » (наприклад -3;3).
     Відповідь має бути однозначним числом або виразом.
   - Розгорнута відповідь: залиш порожнім і напиши зразок розв'язання в «Пояснення».
5. Пояснення: 1-2 речення, як отримати відповідь.
6. Двічі перевір розрахунки перед виводом.`;

  /* ================= розбір тексту ================= */
  const HEADER = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:завдання|питання|task|question)\s*(?:№|#)?\s*\d*\s*[.:)]?\s*(?:\*\*|__)?\s*$/i;
  const LABEL = /^\s*(?:[-*•]\s+)?(?:\*\*|__)?\s*(тип|балів|бали|бал|умова|варіанти|варіант|відповідь|правильна відповідь|пояснення)\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/i;
  const KEY = { 'тип': 'type', 'балів': 'points', 'бали': 'points', 'бал': 'points', 'умова': 'prompt',
    'варіанти': 'options', 'варіант': 'options', 'відповідь': 'answer', 'правильна відповідь': 'answer', 'пояснення': 'expl' };
  const RULE = /^\s*([-*_])\1{2,}\s*$/;
  const LAT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], CYR = ['а', 'б', 'в', 'г', 'д', 'е', 'є', 'ж'];

  function blocksOf(text) {
    const blocks = [];
    let cur = null, field = null;
    const start = () => { cur = { f: {} }; blocks.push(cur); field = null; };
    for (const raw of String(text).replace(/\r/g, '').split('\n')) {
      if (RULE.test(raw)) continue;
      if (HEADER.test(raw)) { start(); continue; }
      const m = LABEL.exec(raw);
      if (m) {
        const key = KEY[m[1].toLowerCase().replace(/\s+/g, ' ')];
        if (!cur || ((key === 'type' || key === 'prompt') && cur.f[key] !== undefined)) start();
        field = key; cur.f[key] = [];
        if (m[2].trim()) cur.f[key].push(m[2]);
        continue;
      }
      if (cur && field) cur.f[field].push(raw);
    }
    return blocks;
  }

  const clean = lines => (lines || []).join('\n').replace(/\*\*|__/g, '').trim();

  function typeOf(s, hasOptions) {
    const t = String(s || '').toLowerCase();
    if (!t) return hasOptions ? 'single' : 'short';
    if (/(правда|true|так\s*\/\s*ні)/.test(t)) return 'truefalse';
    if (/(кілька|декілька|multiple|множин)/.test(t)) return 'multiple';
    if (/(один|single|одна)/.test(t)) return 'single';
    if (/(розгорн|long|письмов|розв)/.test(t)) return 'long';
    if (/(корот|short|числов)/.test(t)) return 'short';
    return null;
  }

  function optionsOf(lines) {
    const raw = (lines || []).map(l => l.replace(/\*\*|__/g, '').trim()).filter(Boolean);
    const BULLET = /^[-•*]\s+/;
    const MARK = /^(?:\(?[A-Za-zА-ЯІЇЄҐа-яіїєґ]|\d{1,2})[).]\s+/;
    const all = raw.length > 0 && raw.every(l => BULLET.test(l) || MARK.test(l));
    return raw.map(l => {
      l = l.replace(BULLET, '');
      return all ? l.replace(MARK, '') : l;
    });
  }

  function indexOfToken(tok) {
    let t = tok.trim().toLowerCase().replace(/[).]+$/, '');
    if (/^\d+$/.test(t)) return Number(t);
    let i = LAT.indexOf(t);
    if (i < 0) i = CYR.indexOf(t);
    return i >= 0 ? i + 1 : NaN;
  }

  // LaTeX у відповіді коротких завдань → запис, який можна надрукувати з клавіатури
  function texToPlain(s) {
    s = String(s).replace(/\$/g, '').replace(/\\left|\\right/g, '').replace(/\\,/g, '');
    const simple = x => /^[\w.,-]+$/.test(x);
    const wrap = x => (simple(x) ? x : '(' + x + ')');
    let prev;
    do { prev = s; s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b) => wrap(a) + '/' + wrap(b)); } while (s !== prev);
    s = s.replace(/\\sqrt\[3\]\{([^{}]*)\}/g, 'cbrt($1)').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\\pi\b/g, 'pi').replace(/\\(?:cdot|times)\b/g, '*')
      .replace(/\\le(?:q)?\b/g, '<=').replace(/\\ge(?:q)?\b/g, '>=').replace(/\\ne(?:q)?\b/g, '!=')
      .replace(/\^\{([^{}]*)\}/g, (m, x) => '^' + (/^-?\w+$/.test(x) ? x : '(' + x + ')'));
    return s.trim();
  }

  function parseTest(text) {
    const items = [], warns = [], skipped = [];
    const base = Date.now();
    blocksOf(text).forEach((b, bi) => {
      const n = bi + 1, f = b.f;
      const prompt = clean(f.prompt);
      if (!prompt) { skipped.push('№' + n + ' (немає умови)'); return; }
      const options = optionsOf(f.options);
      const type = typeOf(clean(f.type), options.length > 0);
      if (!type) { skipped.push('№' + n + ' (невідомий тип «' + clean(f.type) + '»)'); return; }

      let points = parseFloat(clean(f.points).replace(',', '.'));
      if (!isFinite(points) || points <= 0) points = 1;
      points = Math.min(points, 100);

      const ans = clean(f.answer);
      let correct = null, opts = null;
      if (type === 'single' || type === 'multiple') {
        opts = options;
        if (opts.length < 2) warns.push('№' + n + ': менше двох варіантів');
        if (type === 'single') {
          const toks = ans.split(/[,;\s]+/).filter(Boolean);
          const v = toks.length === 1 ? indexOfToken(toks[0]) : NaN;
          if (Number.isInteger(v) && v >= 1 && v <= opts.length) correct = v;
          else { correct = ans; warns.push('№' + n + ': перевірте номер правильного варіанта'); }
        } else {
          const toks = ans.split(/[,;\s]+/).filter(Boolean).map(indexOfToken);
          if (toks.length && toks.every(v => Number.isInteger(v) && v >= 1 && v <= opts.length)) correct = toks;
          else { correct = ans ? [ans] : []; warns.push('№' + n + ': перевірте номери правильних варіантів'); }
        }
      } else if (type === 'truefalse') {
        const v = ans.toLowerCase().replace(/[.!\s]+$/, '');
        if (['так', 'правда', 'true', 'yes', 'вірно', 'вірне', '+'].includes(v)) correct = true;
        else if (['ні', 'неправда', 'false', 'no', 'хибно', 'хибне', '-'].includes(v)) correct = false;
        else { skipped.push('№' + n + ' (відповідь має бути «так» або «ні»)'); return; }
      } else if (type === 'short') {
        correct = ans.split('|').map(x => texToPlain(x)).filter(Boolean);
        if (!correct.length) warns.push('№' + n + ': не вказано правильну відповідь');
      }

      items.push({
        id: base + '_t' + bi, type, prompt, options: opts, correct, points,
        explanation: clean(f.expl)
      });
    });
    return { items, warns, skipped };
  }
  window.__msParseTest = parseTest; // для перевірки

  /* ================= інтерфейс ================= */
  const card = (ctx, id) => `<div class="card"><h2>Вставити тест текстом</h2>
    <p class="muted small">Вставте текст тесту, який склав ШІ. Завдання з’являться в списку «Знайдено завдань» нижче: перегляньте їх і додайте всі одним натисканням.</p>
    <form data-form="textimport" data-ctx="${ctx}" data-id="${esc(id)}">
      <div class="field"><textarea name="txt" rows="10" required maxlength="60000" placeholder="ЗАВДАННЯ 1&#10;Тип: Один варіант&#10;Балів: 1&#10;Умова: Обчисліть $\\frac{1}{2}+\\frac{1}{3}$.&#10;Варіанти:&#10;$\\frac{5}{6}$&#10;$\\frac{2}{5}$&#10;Відповідь: 1"></textarea></div>
      <button class="btn">Розібрати текст</button>
    </form>
    <details style="margin-top:12px"><summary style="cursor:pointer">Формат тесту та готовий промпт для ШІ</summary>
      <pre style="white-space:pre-wrap;font-size:.88rem;line-height:1.5;background:#faf9fd;border-radius:12px;padding:12px;margin:10px 0;overflow:auto">${esc(PROMPT)}</pre>
      <button type="button" class="btn small secondary" data-act="copyprompt">Копіювати промпт</button>
    </details></div>`;

  function put(html, markers, add) {
    for (const m of markers) {
      const i = html.indexOf(m);
      if (i >= 0) return html.slice(0, i) + add + html.slice(i);
    }
    return html + add;
  }

  // урок
  const baseStaff = staffLesson;
  window.staffLesson = async function (sid, lid) {
    const html = await baseStaff.apply(this, arguments);
    if (typeof html !== 'string') return html;
    return put(html, ['<div class="card"><h2>Тест із фото (ШІ)</h2>', '<div class="card"><h2>Завдання тесту'], card('lesson', lid));
  };

  // бібліотека (лише сторінка конкретного тесту)
  const baseLib = TAB.library;
  TAB.library = async function () {
    const html = await baseLib.apply(this, arguments);
    const p = rt();
    if (typeof html !== 'string' || !p[3]) return html;
    return put(html, ['<div class="card"><h2>Завдання з фото (ШІ)</h2>'], card('lib', p[3]));
  };

  F.textimport = async function (f) {
    const txt = new FormData(f).get('txt');
    const r = parseTest(txt);
    if (!r.items.length) {
      throw new Error('Не вдалося знайти жодного завдання. Перевірте, що кожне починається з «ЗАВДАННЯ N» і містить «Умова:»'
        + (r.skipped.length ? '. Пропущено: ' + r.skipped.join('; ') : ''));
    }
    const id = f.dataset.id;
    if (f.dataset.ctx === 'lib') {
      const keep = S.libAi && S.libAi.tid === id ? S.libAi.items : [];
      S.libAi = { tid: id, items: keep.concat(r.items) };
    } else {
      const keep = S.ai && S.ai.lid === id ? S.ai.items : [];
      S.ai = { lid: id, items: keep.concat(r.items) };
    }
    const notes = [];
    if (r.skipped.length) notes.push('Пропущено: ' + r.skipped.join('; '));
    if (r.warns.length) notes.push('Перевірте: ' + r.warns.join('; '));
    toast('Знайдено завдань: ' + r.items.length + (notes.length ? '. ' + notes.join('. ') : ''), !!notes.length);
    renderApp();
  };

  A.copyprompt = async function () {
    try { await navigator.clipboard.writeText(PROMPT); toast('Промпт скопійовано'); }
    catch (e) { window.prompt('Скопіюйте промпт:', PROMPT); }
  };

  if (S.profile) renderApp();
})();
