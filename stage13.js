/* MathSpace · етап 13: кнопка «Додати всі в тест» для завдань, знайдених ШІ.
   Підключається ПІСЛЯ stage12.js. SQL не потрібен. */
(function () {
  'use strict';

  // та сама розбірка форми, що й у «Додати завдання»
  function parse(f) {
    if (new FormData(f).get('type') === 'matching') { const z = MSMatch.readForm(f); return {p_lesson:f.dataset.lid,p_id:null,p_type:'matching',p_prompt:z.prompt,p_options:z.options,p_correct:z.correct,p_points:z.points,p_explanation:z.explanation}; }
    const fd = new FormData(f), t = fd.get('type'), c = (fd.get('correct') || '').trim();
    let options = null, correct = null;
    if (t === 'single' || t === 'multiple') options = (fd.get('options') || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (t === 'single') {
      correct = Number(c) - 1;
      if (!c || !Number.isInteger(correct)) throw new Error('вкажіть номер правильного варіанта');
    } else if (t === 'multiple') {
      correct = c.split(',').map(x => Number(x.trim()) - 1);
      if (!c || correct.some(x => !Number.isInteger(x))) throw new Error('вкажіть номери правильних варіантів через кому');
    } else if (t === 'truefalse') {
      const v = c.toLowerCase();
      if (['так', 'правда', 'true'].includes(v)) correct = true;
      else if (['ні', 'неправда', 'false'].includes(v)) correct = false;
      else throw new Error('вкажіть «так» або «ні»');
    } else if (t === 'short') {
      correct = c.split('|').map(x => x.trim()).filter(Boolean);
    }
    return {
      p_lesson: f.dataset.lid, p_id: null, p_type: t, p_prompt: String(fd.get('prompt')).trim(),
      p_options: options, p_correct: correct, p_points: Number(fd.get('points')),
      p_explanation: String(fd.get('expl') || '').trim()
    };
  }

  const baseStaff = staffLesson;
  window.staffLesson = async function () {
    let html = await baseStaff.apply(this, arguments);
    if (typeof html !== 'string' || !S.ai || !S.ai.items.length) return html;
    const n = S.ai.items.length;
    const h = `<h2 style="margin-top:18px">Знайдено завдань: ${n}</h2>`;
    const bar = `<div class="notice warn small">Відредагуйте потрібні завдання нижче, а потім додайте їх усі одним натисканням. Ті, де є помилка у формі, лишаться в списку.</div>
      <div class="flex" style="margin:10px 0 14px"><button type="button" class="btn" data-act="aiaddall">Додати всі в тест (${n})</button></div>`;
    return html.includes(h) ? html.replace(h, h + bar) : html;
  };

  A.aiaddall = async function (el) {
    if (el.dataset.busy) return;
    const forms = [...document.querySelectorAll('form[data-ai]')];
    if (!forms.length) return;
    if (!confirm('Додати в тест завдань: ' + forms.length + '? ШІ міг помилитися, тож перегляньте умови й відповіді.')) return;
    el.dataset.busy = '1'; el.disabled = true; el.textContent = 'Додаємо…';
    const added = [], failed = [], photoFailed = [];
    try {
      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        try {
          const payload = parse(f);
          const save = async () => { const { error } = await sb.rpc('save_question', payload); if (error) throw error; };
          const r = window.__msPhotoFlow ? await window.__msPhotoFlow.run(f, save) : (await save(), { photo: 'none' });
          added.push(f.dataset.ai);
          if (r.photo === 'fail') photoFailed.push('№' + (i + 1));
        } catch (e) {
          failed.push('№' + (i + 1) + ': ' + (e.message || e));
        }
      }
    } finally {
      if (S.ai) S.ai.items = S.ai.items.filter(q => !added.includes(q.id));
      const tail = photoFailed.length ? ` Фото не збережено для: ${photoFailed.join(', ')}.` : '';
      toast((failed.length
        ? `Додано: ${added.length}. Не додано: ${failed.length} (${failed.join('; ')})`
        : `Додано завдань: ${added.length}`) + tail, !!(failed.length || photoFailed.length));
      renderApp();
    }
  };

  if (S.profile) renderApp();
})();
