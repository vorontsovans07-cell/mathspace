/* MathSpace · етап 4: тести з фото (ШІ). Підключається ПІСЛЯ stage2.js, stage3.js, stage4.js:
   <script src="stage5.js"></script>  (потрібна функція generate-questions у Supabase) */
(function () {
  S.ai = null;

  const toB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Не вдалося прочитати фото'));
    r.readAsDataURL(blob);
  });

  // відповідь ШІ -> текстовий формат поля «Правильна відповідь»
  const cstr = q => {
    const c = q.correct;
    if (q.type === 'single') return String(c ?? '');
    if (q.type === 'multiple') return [].concat(c ?? []).join(',');
    if (q.type === 'truefalse') return c === true || c === 'true' ? 'так' : 'ні';
    if (q.type === 'short') return [].concat(c ?? []).join(' | ');
    return '';
  };

  // кожне знайдене завдання — це форма addq, яку викладач може виправити й додати в тест
  const item = (q, lid) => `<form data-form="addq" data-lid="${lid}" data-ai="${q.id}" style="border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px">
    <div class="two"><div class="field"><label>Тип</label><select name="type">${Object.entries(QT).map(([v, t]) => `<option value="${v}"${v === q.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label>Балів</label><input name="points" type="number" min="0.5" max="100" step="0.5" value="${Number(q.points) || 1}" required></div></div>
    <div class="field"><label>Умова</label><textarea name="prompt" rows="3" required maxlength="4000">${esc(q.prompt)}</textarea></div>
    <div class="field"><label>Варіанти (кожен з нового рядка)</label><textarea name="options" rows="3">${esc(Array.isArray(q.options) ? q.options.join('\n') : '')}</textarea></div>
    <div class="field"><label>Правильна відповідь</label><input name="correct" value="${esc(q.type === 'matching' ? '' : cstr(q))}"></div>
    <div class="field"><label>Пояснення</label><input name="expl" maxlength="2000" value="${esc(q.explanation || '')}"></div>
    <div class="flex"><button class="btn small">Додати в тест</button><button type="button" class="btn small secondary" data-act="aidrop" data-id="${q.id}">Відкинути</button></div></form>`;

  const baseStaff = staffLesson;
  window.staffLesson = async function (sid, lid) {
    const html = await baseStaff(sid, lid);
    const items = S.ai && S.ai.lid === lid ? S.ai.items : [];
    const card = `<div class="card"><h2>Тест із фото (ШІ)</h2>
      <form data-form="aigen" data-lid="${lid}"><div class="field"><label>Фото завдань (до 5 шт., JPG, PNG або WEBP)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required></div><button class="btn">Згенерувати завдання</button></form>
      <div class="notice warn small">Фото надсилаються до Google Gemini. Не завантажуйте роботи учнів чи фото з персональними даними. ШІ може помилитися, тому перевіряйте умови й відповіді перед додаванням.</div>
      ${items.length ? `<h2 style="margin-top:18px">Знайдено завдань: ${items.length}</h2>${items.map(q => item(q, lid)).join('')}` : ''}</div>`;
    const mark = '<div class="card"><h2>Завдання тесту';
    return html.includes(mark) ? html.replace(mark, card + mark) : html + card;
  };

  F.aigen = async function (f) {
    const files = [...f.querySelector('input[type=file]').files].slice(0, 5);
    if (!files.length) throw new Error('Оберіть фото');
    toast('ШІ читає фото, це може зайняти до хвилини…');
    const images = [];
    for (const file of files) images.push({ mime: 'image/jpeg', data: await toB64(await resizeToJpeg(file, 1600)) });
    const { data, error } = await sb.functions.invoke('generate-questions', { body: { images } });
    if (error) {
      let m = error.message;
      try { m = (await error.context.json()).error || m; } catch (_) {}
      throw new Error(m);
    }
    const items = ((data && data.questions) || []).map((q, i) => ({ ...q, id: Date.now() + '_' + i }));
    if (!items.length) throw new Error('ШІ не знайшов завдань на фото. Спробуйте чіткіше фото.');
    S.ai = { lid: f.dataset.lid, items };
    toast('Знайдено завдань: ' + items.length);
    renderApp();
  };

  A.aidrop = function (el) {
    if (S.ai) S.ai.items = S.ai.items.filter(q => q.id !== el.dataset.id);
    renderApp();
  };

  const baseAdd = F.addq;
  F.addq = async function (f) {
    await baseAdd(f);
    if (f.dataset.ai && S.ai) {
      S.ai.items = S.ai.items.filter(q => q.id !== f.dataset.ai);
      renderApp();
    }
  };

  if (S.profile) renderApp();
})();
