/* MathSpace Stage 23 — текстовий імпорт згрупованого ДЗ. Після stage20.js і stage21.js. */
(function () {
  'use strict';
  if (window.__ms23TextHw) return;
  window.__ms23TextHw = true;
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prompt = String.raw`Ти — MathSpace AI, асистент із точного перенесення математичних вправ у домашнє завдання.

ЗАВДАННЯ: Перепиши всі завдання з наданого мною тексту або фото українською мовою, зберігаючи порядок, номери, умови та КОЖЕН підпункт. Нічого не розв’язуй, не вигадуй і не скорочуй.

ОБОВ'ЯЗКОВО:
1. Якщо одна вправа має декілька прикладів 1), 2), 3)... або а), б), в)... — це ОДНЕ завдання з усіма підпунктами, а не окремі завдання.
2. Різні номери вправ (№679, №680) — різні завдання.
3. Не розділяй підпункти заголовками «ЗАВДАННЯ». Зберігай їх усередині поля «Умова».
4. Усі формули подавай у KaTeX-сумісному LaTeX між ОДИНАРНИМИ $...$: $\frac{1}{2}$, $x^{2}$, $\sqrt{x}$. У JSON-рядках подвоюй \ як \\.
5. Якщо частину неможливо прочитати, напиши [НЕРОЗБІРЛИВО], а не здогадуйся.
6. НЕ додавай відповідей, пояснень, таблиць, Markdown, вступу чи висновку.

ВИВЕДИ ЛИШЕ текст у цьому форматі (з кількома завданнями, якщо їх декілька):

ЗАВДАННЯ 1
Умова: №679. Виконайте дії:
1) $4x+16x$
2) $12a-15a$
3) $7m+3m$

ЗАВДАННЯ 2
Умова: №680. Розв'яжіть рівняння $2x+3=11$.

Можеш працювати з фотографіями, які я додам до цього повідомлення. Поверни лише готовий текст для вставлення в MathSpace.`;
  const toolMarkup = `<section class="ms23-import" style="border-top:1px solid #e5e0ef;margin-top:18px;padding-top:15px">
    <h3>Сканувати ДЗ з тексту</h3>
    <p class="muted small">Вставте завдання від ChatGPT, Gemini або іншого ШІ. Підпункти однієї вправи залишаться разом. Жодних платних API-запитів.</p>
    <button class="btn small secondary" type="button" data-act="ms23prompt">Скопіювати промпт для іншого ШІ</button>
    <form data-form="ms23import"><div class="field"><label>Вставте текст домашнього завдання</label><textarea name="source" rows="9" required placeholder="ЗАВДАННЯ 1&#10;Умова: №679. Виконайте дії:&#10;1) $4x+16x$&#10;2) $12a-15a$&#10;&#10;ЗАВДАННЯ 2&#10;Умова: №680. Розв’яжіть рівняння..."></textarea></div>
      <div class="flex"><button class="btn secondary" type="button" data-act="ms23preview">Перевірити текст</button><button class="btn" type="submit">Додати завдання до ДЗ</button></div>
      <div class="ms23-preview" aria-live="polite"></div></form>
  </section>`;

  // Two accepted syntaxes: blocks "ЗАВДАННЯ N / Умова" and JSON {"exercises":[{"text":"..."}]}.
  // Also accepts textbook-style №N headings, preserving subitems 1), 2) ... inside each block.
  function parse(text) {
    const src=String(text||'').replace(/\r\n?/g,'\n').trim();
    if (!src) throw Error('Вставте текст із завданнями');
    if(src.length>100000) throw Error('Текст завеликий (понад 100 000 символів)');
    if(src[0]==='{' || src[0]==='[') {
      let obj;
      try { obj=JSON.parse(src); } catch { throw Error('Некоректний JSON. Скопіюйте текст у форматі ЗАВДАННЯ / Умова.'); }
      const arr=Array.isArray(obj)?obj:(obj.exercises||obj.questions);
      if(!Array.isArray(arr)) throw Error('У JSON очікується масив exercises');
      return validate(arr.map(x=>({text:typeof x==='string'?x:(x?.text||x?.prompt||'')})));
    }
    const lines=src.split('\n');
    const indices=[];
    const heading=/^\s*ЗАВДАННЯ\s*\d+\s*[:.\-–—]?\s*$/iu;
    for(let i=0;i<lines.length;i++)if(heading.test(lines[i]))indices.push(i);
    let blocks=[];
    if(indices.length){
      for(let i=0;i<indices.length;i++){
        let t=lines.slice(indices[i]+1, i+1<indices.length?indices[i+1]:lines.length).join('\n').trim();
        t=t.replace(/^Умова\s*:\s*/iu,'').trim();
        if(t)blocks.push(t);
      }
    } else {
      // Recognize separate top-level exercise numbers, not 1), 2) subexamples.
      const mark=/^\s*(?:№\s*\d+|Вправа\s+\d+)\b/iu;
      let buffer=[];
      for(const line of lines){
        if(mark.test(line) && buffer.join('\n').trim()){
          blocks.push(buffer.join('\n').trim());buffer=[];
        }
        buffer.push(line);
      }
      if(buffer.join('\n').trim())blocks.push(buffer.join('\n').trim());
      // If no recognizable headers, keep entire text as a single exercise to avoid false splitting.
    }
    return validate(blocks.map(text=>({text})));
  }
  function validate(blocks){
    const result=blocks.map(x=>({text:String(x.text||'').trim(),options:[]})).filter(x=>x.text);
    if(!result.length)throw Error('Не знайдено вправ. Перевірте формат тексту.');
    if(result.length>100)throw Error('Максимально 100 вправ за один імпорт');
    for(const x of result)if(x.text.length>4000)throw Error('Одна вправа довша за 4000 символів. Скоротіть її або розділіть.');
    return result;
  }
  window.__ms23ParseHomework=parse;
  const base=window.staffLesson;
  if(typeof base==='function'){
    window.staffLesson=async function(...args){
      const html=await base.apply(this,args);
      if(typeof html!=='string'||!args[1])return html;
      const root=document.createElement('div');root.innerHTML=html;
      const form=root.querySelector('form[data-form="hwai"]');
      const card=form?.closest('.card');
      if(!card)return html;
      const shell=document.createElement('div');shell.innerHTML=toolMarkup;
      const section=shell.firstElementChild;
      section.querySelector('form').dataset.lid=String(args[1]);
      card.appendChild(section);
      return root.innerHTML;
    };
  }
  function preview(form){
    const list=parse(form.elements.source.value);
    const area=form.querySelector('.ms23-preview');
    area.innerHTML=`<p class="muted small">Знайдено вправ: ${list.length}. Підпункти всередині кожної вправи не розділяються.</p>`+
      list.map((x,i)=>`<details><summary>Завдання ${i+1}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(x.text)}</pre></details>`).join('');
    return list;
  }
  document.addEventListener('click',async e=>{
    const btn=e.target.closest?.('[data-act="ms23prompt"]');
    if(btn){
      try { await navigator.clipboard.writeText(prompt); if(typeof toast==='function')toast('Промпт скопійовано. Вставте його в інший ШІ.'); }
      catch {window.prompt('Скопіюйте промпт:',prompt);}
    }
    const check=e.target.closest?.('[data-act="ms23preview"]');
    if(check){try{preview(check.closest('form'));}catch(err){if(typeof toast==='function')toast(err.message,true);}}
  });
  F.ms23import=async form=>{
    const added=preview(form);
    const lid=form.dataset.lid;
    const resp=await sb.from('lesson_homework').select('*').eq('lesson_id',lid).maybeSingle();
    if(resp.error)throw resp.error;
    const old=resp.data;
    const existing=Array.isArray(old?.exercises)?old.exercises:[];
    if(existing.length+added.length>100)throw Error('Ліміт — 100 вправ загалом');
    const next=[...existing,...added];
    if(typeof window.__msHwSave==='function')await window.__msHwSave(lid,{exercises:next},old||null);
    else{
      const saved=await sb.from('lesson_homework').upsert({...(old||{}),lesson_id:lid,exercises:next,updated_at:new Date().toISOString()},{onConflict:'lesson_id'});
      if(saved.error)throw saved.error;
    }
    toast(`Додано ${added.length} вправ до ДЗ. Перевірте перед публікацією.`);
    renderApp();
  };
})();
