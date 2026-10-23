/* MathSpace Stage 23 — текстовий імпорт згрупованого ДЗ. Після stage20.js і stage21.js. */
(function () {
  'use strict';
  if (window.__ms23TextHw) return;
  window.__ms23TextHw = true;
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prompt = String.raw`Ти — MathSpace AI, асистент для ДОМАШНІХ завдань з математики. Цей промпт призначений лише для домашніх завдань, а не для тестів.

ЗАВДАННЯ: Перепиши всі вправи з наданого мною тексту або фото українською мовою, зберігаючи порядок, номери, умови та КОЖЕН підпункт, а потім РОЗВ’ЯЖИ кожну вправу.

ОБОВ'ЯЗКОВО:
1. Якщо одна вправа має декілька прикладів 1), 2), 3)... або а), б), в)... — це ОДНЕ завдання з усіма підпунктами, а не окремі завдання. Різні номери вправ (№679, №680) — різні завдання.
2. Умову переписуй точно: нічого не скорочуй і не змінюй. Не розділяй підпункти заголовками «ЗАВДАННЯ», зберігай їх усередині поля «Умова».
3. Після умови кожної вправи напиши поле «Розв’язання:». У ньому розв’яжи ВСІ підпункти по порядку, кожен з нового рядка з тим самим номером (1), 2), ...). Показуй короткий хід розв’язання кроками, а наприкінці кожного підпункту пиши «Відповідь: ...».
4. Розв’язання має бути зрозумілим учню відповідного класу: без пропуску ключових кроків і без зайвих пояснень.
5. Усі формули подавай у KaTeX-сумісному LaTeX між ОДИНАРНИМИ $...$: $\frac{1}{2}$, $x^{2}$, $\sqrt{x}$. Заборонено \( ... \), \[ ... \] та подвійні долари. Систему рівнянь записуй одним фрагментом: $\begin{cases}x+y=5\\x-y=1\end{cases}$. У JSON-рядках подвоюй \ як \\.
6. Самостійно перевір обчислення й відповіді перед виведенням. Якщо не впевнений у розв’язанні, не вигадуй: напиши «Розв’язання: потрібна перевірка викладача».
7. Якщо частину умови неможливо прочитати, напиши [НЕРОЗБІРЛИВО] і не здогадуйся.
8. НЕ додавай вступу, висновку, таблиць, Markdown і жирного шрифту.

ВИВЕДИ ЛИШЕ текст у цьому форматі (з кількома завданнями, якщо їх декілька). Поле «Розв’язання:» став після умови, воно може займати кілька рядків:

ЗАВДАННЯ 1
Умова: №679. Виконайте дії:
1) $4x+16x$
2) $12a-15a$
Розв’язання:
1) $4x+16x=(4+16)x=20x$. Відповідь: $20x$.
2) $12a-15a=(12-15)a=-3a$. Відповідь: $-3a$.

ЗАВДАННЯ 2
Умова: №680. Розв'яжіть рівняння $2x+3=11$.
Розв’язання:
$2x=11-3$, $2x=8$, $x=4$. Відповідь: $4$.

Можеш працювати з фотографіями, які я додам до цього повідомлення. Поверни лише готовий текст для вставлення в MathSpace.`;
  const toolMarkup = `<section class="ms23-import" style="border-top:1px solid #e5e0ef;margin-top:18px;padding-top:15px">
    <h3>Сканувати ДЗ з тексту</h3>
    <p class="muted small">Вставте завдання від ChatGPT, Gemini або іншого ШІ. Промпт просить ШІ одразу розв’язати кожну вправу: розв’язання збережеться в полі «Розв’язання:» і буде видиме лише вам, у випадному списку біля вправи. Підпункти однієї вправи залишаться разом.</p>
    <button class="btn small secondary" type="button" data-act="ms23prompt">Скопіювати промпт для іншого ШІ</button>
    <form data-form="ms23import"><div class="field"><label>Вставте текст домашнього завдання</label><textarea name="source" rows="9" required placeholder="ЗАВДАННЯ 1&#10;Умова: №679. Виконайте дії:&#10;1) $4x+16x$&#10;2) $12a-15a$&#10;Розв’язання:&#10;1) $4x+16x=20x$. Відповідь: $20x$.&#10;2) $12a-15a=-3a$. Відповідь: $-3a$."></textarea></div>
      <div class="flex"><button class="btn secondary" type="button" data-act="ms23preview">Перевірити текст</button><button class="btn" type="submit">Додати завдання до ДЗ</button></div>
      <div class="ms23-preview" aria-live="polite"></div></form>
  </section>`;

  // Two accepted syntaxes: blocks "ЗАВДАННЯ N / Умова" and JSON {"exercises":[{"text":"..."}]}.
  // Also accepts textbook-style №N headings, preserving subitems 1), 2) ... inside each block.
  const SOL=/^\s*(?:\*\*|__)?\s*(?:розв['’ʼ`]?язання|розв['’ʼ`]?язок|рішення)\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/iu;
  // відокремлює «Розв’язання:» від умови (усе після мітки — розв’язання)
  function splitSolution(t){
    const lines=String(t||'').split('\n');
    const i=lines.findIndex(l=>SOL.test(l));
    if(i<0)return {text:String(t||'').trim(),solution:''};
    const m=SOL.exec(lines[i]);
    return {text:lines.slice(0,i).join('\n').trim(),solution:[m[1],...lines.slice(i+1)].join('\n').trim()};
  }
  function parse(text) {
    const src=String(text||'').replace(/\r\n?/g,'\n').trim();
    if (!src) throw Error('Вставте текст із завданнями');
    if(src.length>100000) throw Error('Текст завеликий (понад 100 000 символів)');
    if(src[0]==='{' || src[0]==='[') {
      let obj;
      try { obj=JSON.parse(src); } catch { throw Error('Некоректний JSON. Скопіюйте текст у форматі ЗАВДАННЯ / Умова.'); }
      const arr=Array.isArray(obj)?obj:(obj.exercises||obj.questions);
      if(!Array.isArray(arr)) throw Error('У JSON очікується масив exercises');
      return validate(arr.map(x=>({text:typeof x==='string'?x:(x?.text||x?.prompt||''),solution:typeof x==='string'?'':String(x?.solution||'')})));
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
    const result=blocks.map(x=>{const sp=splitSolution(String(x.text||''));return {text:sp.text,options:[],solution:String(x.solution||sp.solution||'').trim()};}).filter(x=>x.text);
    if(!result.length)throw Error('Не знайдено вправ. Перевірте формат тексту.');
    if(result.length>100)throw Error('Максимально 100 вправ за один імпорт');
    for(const x of result){
      if(x.text.length>4000)throw Error('Одна вправа довша за 4000 символів. Скоротіть її або розділіть.');
      if(x.solution.length>8000)throw Error('Розв’язання однієї вправи довше за 8000 символів.');
    }
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
    const withSol=list.filter(x=>x.solution).length;
    area.innerHTML=`<p class="muted small">Знайдено вправ: ${list.length}, з розв’язаннями: ${withSol}. Підпункти всередині кожної вправи не розділяються.</p>`+
      list.map((x,i)=>`<details><summary>Завдання ${i+1}${x.solution?'':' (без розв’язання)'}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(x.text)}</pre>${x.solution?`<div class="muted small"><b>Розв’язання:</b></div><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(x.solution)}</pre>`:''}</details>`).join('');
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
    const HW=window.__msHw;
    if(!HW)throw Error('Не завантажено stage19.js');
    const resp=await sb.from('lesson_homework').select('*').eq('lesson_id',lid).maybeSingle();
    if(resp.error)throw resp.error;
    const old=resp.data;
    const existing=HW.safeExercises(old?.exercises);
    if(existing.length+added.length>100)throw Error('Ліміт — 100 вправ загалом');
    const withIds=added.map(x=>({id:HW.newId(),text:x.text,options:[],solution:x.solution||''}));
    const wantSol=withIds.some(x=>x.solution);
    const map=wantSol?await HW.solutionsOf(lid,true):null;   // читаємо до збереження, щоб помилка не лишила половину
    await HW.save(lid,{exercises:[...existing,...withIds.map(({id,text,options})=>({id,text,options}))]},old||null);
    if(wantSol){
      withIds.forEach(x=>{if(x.solution)map[x.id]=x.solution;});
      try{await HW.saveSolutions(lid,map);}
      catch(e){toast('Вправи додано, але розв’язання не збережено: '+(e.message||e),true);renderApp();return;}
    }
    toast(`Додано ${added.length} вправ${wantSol?' з розв’язаннями':''}. Перевірте перед публікацією.`);
    renderApp();
  };
})();
