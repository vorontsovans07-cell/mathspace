/* MathSpace Stage 28 — remove read notifications; delete draft lessons from student lesson list.
   Load AFTER stage27.js and stage25.js. No modification to existing files required. */
(() => {
  'use strict';
  const css = document.createElement('style');
  css.textContent = '.ms28-delete-read{color:#a33e55!important;font-weight:650}.ms28-delete-lesson{margin-left:6px}.ms28-delete-read[disabled],.ms28-delete-lesson[disabled]{opacity:.55;cursor:wait}';
  document.head.appendChild(css);
  let busy = false;
  function decorate(){
    // Stage25 recreates the panel after every refresh; inject only into its header.
    const panel=document.querySelector('.ms-notice-panel');
    const header=panel?.querySelector('.ms-notice-head > div');
    if(header && !header.querySelector('[data-ms28-clear-read]')){
      const b=document.createElement('button');
      b.type='button';b.className='ms-notice-action ms28-delete-read';
      b.dataset.ms28ClearRead='1';b.textContent='Видалити прочитані';
      const close=header.querySelector('[data-ms-close]');
      header.insertBefore(b,close||null);
    }
    // Staff lesson listing: links route to /lessons/<student-uuid>/<lesson-uuid>.
    if(!S?.profile || S.profile.role==='student')return;
    document.querySelectorAll('a[href^="#/t/lessons/"]').forEach(link=>{
      const match=(link.getAttribute('href')||'').match(/^#\/t\/lessons\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i);
      if(!match || link.dataset.ms28Processed)return;
      const row=link.closest('.row');
      const status=row?.querySelector('.pill');
      // Only drafts may be deleted by the existing secure lessons_delete policy.
      if(!row || !status || !/чернетка/i.test(status.textContent||''))return;
      link.dataset.ms28Processed='1';
      const b=document.createElement('button');b.type='button';
      b.className='btn small danger ms28-delete-lesson';
      b.textContent='Видалити';b.dataset.ms28DeleteLesson=match[2];b.dataset.ms28Student=match[1];
      link.insertAdjacentElement('afterend',b);
    });
  }
  async function clearRead(button){
    if(busy)return;
    if(!confirm('Видалити всі прочитані сповіщення? Це не можна скасувати. Непрочитані залишаться.'))return;
    busy=true;button.disabled=true;
    try{
      const {data,error}=await sb.from('ms_notifications')
        .delete().not('read_at','is',null).select('id');
      if(error)throw error;
      if(window.MathSpaceNotifications?.refresh)await window.MathSpaceNotifications.refresh();
      if(typeof toast==='function')toast(`Видалено прочитаних сповіщень: ${(data||[]).length}`);
      else alert(`Видалено: ${(data||[]).length}`);
    }catch(e){
      if(typeof toast==='function')toast('Не вдалося видалити сповіщення: '+e.message,true);
      else alert(e.message);
    }finally{busy=false;if(button.isConnected)button.disabled=false;}
  }
  async function deleteLesson(button){
    if(button.disabled)return;
    const lid=button.dataset.ms28DeleteLesson;
    if(!lid)return;
    if(!confirm('Назавжди видалити цю ЧЕРНЕТКУ уроку? Пов’язані завдання, результати та матеріали можуть бути втрачені. Дію неможливо скасувати.'))return;
    button.disabled=true;
    try{
      const files=typeof collectLessonFiles==='function'?await collectLessonFiles(lid):null; // збираємо ДО видалення
      const {data,error}=await sb.from('lessons').delete().eq('id',lid).eq('status','draft').select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Урок не видалено. Перевірте, чи це чернетка і чи маєте право керувати учнем.');
      if(files&&typeof removeLessonFiles==='function')await removeLessonFiles(files);
      if(typeof toast==='function')toast('Чернетку уроку видалено');
      if(typeof renderApp==='function')await renderApp();else location.reload();
    }catch(e){
      if(typeof toast==='function')toast('Не вдалося видалити урок: '+e.message,true);
      else alert(e.message);
    }finally{if(button.isConnected)button.disabled=false;}
  }
  document.addEventListener('click', e=>{
    const clear=e.target.closest('[data-ms28-clear-read]');
    if(clear){e.preventDefault();clearRead(clear);return;}
    const lesson=e.target.closest('[data-ms28-delete-lesson]');
    if(lesson){e.preventDefault();deleteLesson(lesson);}
  });
  // замість спостерігача за всім DOM: подія після малювання сторінки й після малювання панелі сповіщень (stage25)
  document.addEventListener('ms:rendered',decorate);
  document.addEventListener('ms:panel',decorate);
  decorate();
})();

/* MathSpace Stage 30 — library editor parity helpers.
 * Load AFTER stage18_1.js. No SQL changes.
 * Adds per-question image support and a review-before-adding step for text/photo imports.
 */
(function () {
  'use strict';
  if (typeof F === 'undefined' || typeof A === 'undefined' || typeof sb === 'undefined') {
    console.error('MathSpace Stage 30: application globals not ready. Check script order.');
    return;
  }
  const BUCKET = 'lesson-library';
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fail = r => { if (r?.error) throw r.error; return r?.data; };
  const state = () => window.__MS_LessonLibraryCurrent || null;
  const b64 = blob => new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=()=>no(new Error('Не вдалося прочитати файл'));r.readAsDataURL(blob);});
  const css=document.createElement('style');
  css.textContent=`
  .ms30-image{border:1px solid var(--line,#ebe8f2);padding:10px;border-radius:12px;margin-top:12px}
  .ms30-image img{display:block;max-width:100%;max-height:280px;object-fit:contain;margin:8px 0}
  .ms30-preview{border:1px solid var(--line,#ebe8f2);border-radius:12px;padding:14px;margin:12px 0}
  .ms30-preview-item{border-top:1px solid var(--line,#ebe8f2);padding:10px 0}
  .ms30-preview textarea{width:100%;min-height:70px}
  `;
  document.head.appendChild(css);

  let pending = null;
  function previewHTML() {
    if (!pending) return '';
    return `<section class="card ms30-preview"><h2>Перевірка імпорту (${pending.items.length} завдань)</h2>
      <p class="muted small">Переглянь умови, виправ помилки розпізнавання та лише потім додай завдання до уроку.</p>
      ${pending.items.map((q,i)=>`<div class="ms30-preview-item"><b>${i+1}. ${esc(q.qtype)}</b>
      <label class="field">Умова<textarea data-ms30-prompt="${i}">${esc(q.prompt)}</textarea></label>
      <label class="field">Балів<input type="number" min="0.5" max="100" step="0.5" data-ms30-points="${i}" value="${Number(q.points)||1}"></label>
      <div class="small muted">Правильна відповідь і варіанти збережені з результату розпізнавання. Для їх зміни відкрий завдання після додавання.</div></div>`).join('')}
      <div class="flex"><button class="btn" type="button" data-ms30-accept>Додати перевірені завдання</button><button class="btn secondary" type="button" data-ms30-cancel>Скасувати імпорт</button></div></section>`;
  }
  function showPreview(items, skipped=[]) {
    if (!items.length) throw new Error('Не знайдено коректних завдань.');
    pending = {items,skipped};
    const host=document.querySelector('#lt181-editor');
    if (!host) throw new Error('Не знайдено редактор бібліотеки. Відкрий урок і повтори імпорт.');
    host.querySelector('[data-ms30-preview]')?.remove();
    const wrap=document.createElement('div'); wrap.dataset.ms30Preview='1'; wrap.innerHTML=previewHTML();
    host.appendChild(wrap);
    wrap.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function fromParsed(x) {
    return {qtype:x.type,prompt:String(x.prompt||''),options:x.options??null,
      correct:x.type==='matching'?(x.correct||[]).map(n=>n===0?-1:n-1):x.type==='single'?Number(x.correct)-1:x.type==='multiple'?(x.correct||[]).map(n=>Number(n)-1):x.correct,
      points:Number(x.points)||1,explanation:String(x.explanation||'')};
  }
  const originalText=F.lt181import;
  F.lt181import=async function(form) {
    const source=String(form.elements.namedItem('test')?.value||'');
    if(typeof window.__msParseTest!=='function') throw new Error('Не завантажено парсер stage16.js.');
    const result=window.__msParseTest(source);
    const items=(result.items||[]).map(fromParsed);
    if(!items.length) throw new Error('Не знайдено завдань: '+(result.skipped||[]).join('; '));
    showPreview(items,result.skipped||[]);
  };
  const originalAI=F.lt181ai;
  F.lt181ai=async function(form) {
    const files=[...(form.querySelector('input[type=file]')?.files||[])];
    if(!files.length||files.length>5) throw new Error('Додайте від 1 до 5 фото.');
    const images=[];
    for(const file of files){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024) throw new Error('Фото має бути JPG, PNG або WEBP, до 15 МБ кожне.');
      const small=typeof resizeToJpeg==='function'?await resizeToJpeg(file,1600):file;
      images.push({mime:small.type||'image/jpeg',data:await b64(small)});
    }
    if(typeof toast==='function') toast('Розпізнаємо фото…');
    const r=await sb.functions.invoke('generate-questions',{body:{images}});
    if(r.error) throw r.error;
    if(r.data?.error) throw new Error(r.data.error);
    const items=(r.data?.questions||[]).map(fromParsed);
    if(!items.length) throw new Error('Gemini не повернув завдань.');
    showPreview(items);
  };

  function renderImageControls() {
    const host=document.querySelector('#lt181-editor');
    const s=state();
    if(!host||!s) return;
    const forms=[...host.querySelectorAll('form[data-form="lt181question"]')];
    for(const form of forms){
      if(form.querySelector('.ms30-image')) continue;
      const raw=form.querySelector('[name="qi"]')?.value ?? '';
      const idx=raw===''?null:Number(raw);
      const q=idx===null?null:s.content?.[idx];
      const block=document.createElement('div');block.className='ms30-image';
      let image='';
      if(q?.image_path){
        image=`<img alt="Фото до завдання" data-ms30-path="${esc(q.image_path)}"><button type="button" class="btn small danger" data-ms30-remove-image>Видалити фото</button>`;
      }
      block.innerHTML=`<b>Фото до завдання (необов'язково)</b><p class="small muted">JPG, PNG або WEBP, до 10 МБ. Після збереження уроку фото залишиться прикріпленим до цього завдання.</p>${image}<input type="file" accept="image/jpeg,image/png,image/webp" data-ms30-image>`;
      form.appendChild(block);
      // бакет приватний: показуємо через підписане посилання
      block.querySelectorAll('img[data-ms30-path]').forEach(img=>{
        sb.storage.from(BUCKET).createSignedUrl(img.dataset.ms30Path,3600).then(({data})=>{ if(data&&data.signedUrl)img.src=data.signedUrl; });
      });
      block.querySelector('[data-ms30-remove-image]')?.addEventListener('click',async()=>{
        if(!s?.id||idx===null||!s.content[idx]?.image_path) return alert('Спочатку збережи урок і завдання.');
        if(!confirm('Видалити фото цього завдання?'))return;
        const path=s.content[idx].image_path;
        const next={...s.content[idx]};delete next.image_path;s.content[idx]=next;
        fail(await sb.from('lesson_templates').update({content:s.content}).eq('id',s.id));
        await sb.storage.from(BUCKET).remove([path]);
        if(typeof toast==='function')toast('Фото видалено');
        if(typeof renderApp==='function')renderApp();
      });
    }
  }

  const originalQuestion=F.lt181question;
  F.lt181question=async function(form){
    const file=form.querySelector('[data-ms30-image]')?.files?.[0]||null;
    if(!file) return originalQuestion.apply(this,arguments);
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024) throw new Error('Фото має бути JPG/PNG/WEBP до 10 МБ.');
    // Save question through the existing, validated handler first.
    const before=state();
    const raw=form.querySelector('[name="qi"]')?.value??'';
    const idx=raw===''?null:Number(raw);
    await originalQuestion.apply(this,arguments);
    const s=state()||before;
    if(!s?.id) throw new Error('Спочатку збережи назву уроку, потім додай фото до завдання.');
    const target=idx===null?s.content.length-1:idx;
    if(!s.content[target]) throw new Error('Не вдалося знайти завдання після збереження.');
    const old=s.content[target].image_path;
    const path=`${S.profile.id}/${s.id}/question-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(-80)}`;
    fail(await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false}));
    s.content[target].image_path=path;
    try { fail(await sb.from('lesson_templates').update({content:s.content}).eq('id',s.id)); }
    catch(e){ delete s.content[target].image_path; await sb.storage.from(BUCKET).remove([path]); throw e; }
    if(old) await sb.storage.from(BUCKET).remove([old]);
    if(typeof toast==='function')toast('Завдання та фото збережено');
    if(typeof renderApp==='function')renderApp();
  };

  document.addEventListener('click',async e=>{
    const accept=e.target.closest('[data-ms30-accept]');
    const cancel=e.target.closest('[data-ms30-cancel]');
    if(cancel){pending=null;document.querySelector('[data-ms30-preview]')?.remove();return;}
    if(accept){
      try{
        const s=state();if(!s)throw new Error('Урок більше не відкритий.');
        const wrap=accept.closest('[data-ms30-preview]');
        pending.items.forEach((q,i)=>{
          q.prompt=wrap.querySelector(`[data-ms30-prompt="${i}"]`).value.trim();
          q.points=Number(wrap.querySelector(`[data-ms30-points="${i}"]`).value);
          if(!q.prompt)throw new Error(`Заповни умову завдання ${i+1}.`);
          if(!Number.isFinite(q.points)||q.points<=0||q.points>100)throw new Error(`Перевір бали завдання ${i+1}.`);
        });
        const qs=pending.items.length;
        if(!s.title?.trim())throw new Error('Спочатку вкажи назву уроку та збережи її.');
        const start=s.content.length;
        s.content.push(...pending.items);
        try{ fail(await sb.from('lesson_templates').update({content:s.content}).eq('id',s.id)); }
        catch(e){ s.content.length=start; throw e; } // не лишаємо дублікатів при помилці
        pending=null;
        if(typeof toast==='function')toast(`Додано ${qs} завдань`);
        if(typeof renderApp==='function')renderApp();
      }catch(err){alert(err.message||String(err));}
    }
  });
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderImageControls();});}).observe(document.body,{childList:true,subtree:true});
  renderImageControls();
})();
