/* MathSpace Stage 18.1 — in-library lesson editor. Requires stage18.js + SQL 18_1 */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const role=()=>S.profile&&['teacher','owner','admin'].includes(S.profile.role);
let current=null;
// stage30 читає відкритий урок бібліотеки звідси
Object.defineProperty(window,'__MS_LessonLibraryCurrent',{get:()=>current,configurable:true});
const types={single:'Один варіант',multiple:'Кілька варіантів',truefalse:'Правда / неправда',short:'Коротка відповідь',long:'Розгорнута відповідь',matching:'Встановлення відповідності'};
function fail(r){if(r.error)throw r.error;return r.data;}
function deep(x){return JSON.parse(JSON.stringify(x));}
function valid(q){
 if(!q.prompt?.trim())throw new Error('Заповніть умову завдання');
 if(!Object.hasOwn(types,q.qtype))throw new Error('Невідомий тип завдання');
 if(!Number.isFinite(+q.points)||+q.points<=0||+q.points>100)throw new Error('Некоректні бали');
 if(q.qtype==='matching'){
  const l=q.options?.left,r=q.options?.right,c=q.correct;
  if(!Array.isArray(l)||!Array.isArray(r)||l.length<2||r.length<2||l.length>10||r.length>10||!Array.isArray(c)||c.length!==l.length||c.some(n=>!Number.isInteger(n)||n< -1||n>=r.length)||new Set(c.filter(n=>n>=0)).size!==c.filter(n=>n>=0).length)throw new Error('Неправильні колонки або відповідності: 0 означає відсутність пари');
 } else if(['single','multiple'].includes(q.qtype)){
  if(!Array.isArray(q.options)||q.options.length<2||q.options.length>10)throw new Error('Потрібно від 2 до 10 варіантів');
  const c=q.correct;
  if(q.qtype==='single'&&(!Number.isInteger(c)||c<0||c>=q.options.length))throw new Error('Некоректний номер відповіді');
  if(q.qtype==='multiple'&&(!Array.isArray(c)||!c.length||c.some(n=>!Number.isInteger(n)||n<0||n>=q.options.length)))throw new Error('Некоректні номери відповідей');
 }
}
const split=v=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const keyText=q=>q.qtype==='matching'?(q.correct||[]).map(n=>n<0?0:n+1).join(',') : q.qtype==='single'?String(q.correct+1):q.qtype==='multiple'?(q.correct||[]).map(x=>x+1).join(','):q.qtype==='truefalse'?(q.correct?'так':'ні'):q.qtype==='short'?(q.correct||[]).join(' | '):'';
function parseForm(f){
 const d=new FormData(f),qtype=String(d.get('qtype')),raw=String(d.get('correct')||'').trim();
 const q={qtype,prompt:String(d.get('prompt')||'').trim(),points:Number(d.get('points')),explanation:String(d.get('explanation')||'').trim(),options:null,correct:null};
 if(qtype==='matching'){
  const left=split(d.get('left')),right=split(d.get('right'));const seq=raw.split(/[,;\s]+/).filter(Boolean).map(Number);
  if(seq.length!==left.length||seq.some(n=>!Number.isInteger(n)||n<0||n>right.length))throw new Error('Уведіть номер правого рядка для кожного лівого; 0 = немає пари');
  q.options={left,right};q.correct=seq.map(n=>n===0?-1:n-1);
 }else if(qtype==='single'||qtype==='multiple'){
  q.options=split(d.get('options'));const n=raw.split(/[,;\s]+/).filter(Boolean).map(Number);
  if(!n.length||n.some(x=>!Number.isInteger(x)||x<1||x>q.options.length))throw new Error('Укажіть правильні номери варіантів');
  q.correct=qtype==='single'?n[0]-1:n.map(x=>x-1);
 }else if(qtype==='truefalse'){if(!['так','ні'].includes(raw.toLowerCase()))throw new Error('Відповідь: так або ні');q.correct=raw.toLowerCase()==='так';}
 else if(qtype==='short')q.correct=raw.split('|').map(x=>x.trim()).filter(Boolean);
 valid(q);return q;
}
function editorForm(q={},index=null){const t=q.qtype||'single';return `<form data-form="lt181question"><input type="hidden" name="qi" value="${index??''}"><div class="field"><label>Тип завдання</label><select name="qtype">${Object.entries(types).map(([k,v])=>`<option value="${k}"${t===k?' selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Умова</label><textarea name="prompt" maxlength="4000" rows="3" required>${esc(q.prompt)}</textarea></div><div class="two"><div class="field"><label>Балів</label><input type="number" name="points" min="0.5" max="100" step="0.5" value="${Number(q.points)||1}"></div><div class="field"><label>Правильна відповідь (номер із 1; для відповідностей 0 — немає пари)</label><input name="correct" value="${esc(keyText(q))}"></div></div><div class="field lt181-options"><label>Варіанти (по одному на рядок)</label><textarea name="options" rows="4">${esc(Array.isArray(q.options)?q.options.join('\n'):'')}</textarea></div><div class="lt181-match"><div class="field"><label>Ліва колонка</label><textarea name="left" rows="4">${esc(q.options?.left?.join('\n'))}</textarea></div><div class="field"><label>Права колонка</label><textarea name="right" rows="4">${esc(q.options?.right?.join('\n'))}</textarea></div></div><div class="field"><label>Пояснення</label><textarea name="explanation" rows="2">${esc(q.explanation)}</textarea></div><div class="flex"><button class="btn">${index===null?'Додати завдання':'Зберегти завдання'}</button><button type="button" class="btn secondary" data-act="lt181closequestion">Скасувати</button></div></form>`;}
const ctl=()=>document.querySelector('#lt181-editor');
const timeCard=t=>`<div class="card"><h2>Час на тест</h2><form data-form="lt181time" class="flex"><input name="min" type="number" min="1" max="600" value="${t.time_limit_minutes??''}" placeholder="хвилин (порожньо — без обмеження)" style="max-width:320px"><button class="btn secondary">Зберегти</button></form><p class="muted small">Переноситься в урок, коли ви додасте його учню. Відлік починається, коли учень натискає «Розпочати тест».</p></div>`;
const hwCard=t=>{const h=t.homework||{},ex=Array.isArray(h.exercises)?h.exercises:[];return `<div class="card"><h2>Домашнє завдання</h2><p class="muted small">Учень бачить усі вправи одразу й надсилає фото виконаної роботи. Коли ви додасте урок учню, ДЗ лишиться прихованим, доки ви його не опублікуєте.</p>
 <form data-form="lt181hwmeta"><div class="field"><label>Інструкція до ДЗ</label><textarea name="instructions" rows="3" maxlength="5000">${esc(h.instructions||'')}</textarea></div><button class="btn">Зберегти ДЗ</button></form>
 <h3>Вправи (${ex.length})</h3>${ex.map((x,i)=>`<div class="hw-exercise"><b>${i+1}.</b> ${esc(x.text||'')}<button class="btn small danger" data-act="lt181hwremove" data-index="${i}">Видалити</button></div>`).join('')||'<p class="muted small">Вправ ще немає.</p>'}
 <form data-form="lt181hwadd"><div class="field"><label>Нова вправа</label><textarea name="exercise" required maxlength="4000" rows="3"></textarea></div><button class="btn secondary">+ Додати вправу</button></form>
 <section style="border-top:1px solid #e5e0ef;margin-top:16px;padding-top:12px"><h3>Додати вправи з тексту</h3><p class="muted small">Вставте вправи від ChatGPT, Gemini чи іншого ШІ: підпункти однієї вправи лишаться разом.</p><button class="btn small secondary" type="button" data-act="ms23prompt">Скопіювати промпт для іншого ШІ</button>
 <form data-form="lt181hwtext"><div class="field"><label>Текст домашнього завдання</label><textarea name="source" rows="7" required placeholder="ЗАВДАННЯ 1&#10;Умова: №679. Виконайте дії:&#10;1) $4x+16x$&#10;2) $12a-15a$"></textarea></div><div class="flex"><button class="btn secondary" type="button" data-act="ms23preview">Перевірити текст</button><button class="btn" type="submit">Додати вправи</button></div><div class="ms23-preview" aria-live="polite"></div></form></section>
 <form data-form="lt181hwai" style="border-top:1px solid #e5e0ef;margin-top:16px;padding-top:12px"><div class="field"><label>Розпізнати вправи з фото за допомогою Gemini (до 5 фото)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required></div><button class="btn secondary">Розпізнати й додати вправи</button></form></div>`;};
function paint(){
 if(!current)return;
 const c=ctl();if(!c)return;
 const t=current;

 c.innerHTML=`<div class="card"><div class="flex" style="justify-content:space-between"><h2>${t.id?'Редагувати урок у бібліотеці':'Новий урок у бібліотеці'}</h2><button class="btn secondary" data-act="lt181back">Назад</button></div><form data-form="lt181meta"><div class="field"><label>Назва уроку</label><input name="title" required maxlength="200" value="${esc(t.title)}"></div><div class="field"><label>Опис / тема</label><textarea name="description" rows="3">${esc(t.description)}</textarea></div><button class="btn">Зберегти урок</button></form></div>
 <div class="card"><h2>Матеріали</h2>${['presentation','notes'].map(k=>`<div class="field"><label>${k==='presentation'?'Презентація':'Конспект'}</label><div>${esc(t[k+'_name']||'Немає файлу')}${t[k+'_path']?` <button class="btn small danger" data-act="lt181removefile" data-kind="${k}">Прибрати</button>`:''}</div><input type="file" data-lt181-file="${k}" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.webp"></div>`).join('')}</div>
 ${timeCard(t)}
 <div class="card"><h2>Завдання (${t.content.length})</h2>${t.content.map((q,i)=>`<div class="row"><div style="flex:1"><b>${i+1}. ${esc(types[q.qtype]||q.qtype)}</b><div class="small">${esc(String(q.prompt||'').slice(0,250))}</div></div><div class="flex"><button class="btn small secondary" data-act="lt181editq" data-qi="${i}">Редагувати</button><button class="btn small secondary" data-act="lt181upq" data-qi="${i}">↑</button><button class="btn small secondary" data-act="lt181downq" data-qi="${i}">↓</button><button class="btn small danger" data-act="lt181delq" data-qi="${i}">×</button></div></div>`).join('')}<div id="lt181-qform"></div><button class="btn secondary" data-act="lt181newq">+ Завдання</button></div>
 <div class="card"><h2>Імпорт тесту текстом</h2><p class="muted small">Вставте завдання у форматі MathSpace. Підтримуються всі шість типів, включно з відповідностями та 0.</p><form data-form="lt181import"><textarea name="test" rows="8" required placeholder="ЗАВДАННЯ 1&#10;Тип: Один варіант&#10;..."></textarea><button class="btn">Розібрати та додати</button></form></div>
 <div class="card"><h2>Тест із фото (Gemini)</h2><form data-form="lt181ai"><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required><button class="btn">Розпізнати і додати</button></form><p class="muted small">До 5 фото. Обов'язково перевіряйте формули та відповіді перед використанням.</p></div>${hwCard(t)}`;
}
const MISSING=/column|schema cache/i;
async function persist(){
 if(!current)throw new Error('Спочатку відкрийте урок');
 const t=current;
 if(!t.title.trim())throw new Error('Укажіть назву');
 t.content.forEach(valid);
 const base={title:t.title.trim(),description:t.description||'',content:t.content};
 const extra={time_limit_minutes:t.time_limit_minutes??null,homework:t.homework??null};
 const write=p=>t.id?sb.from('lesson_templates').update(p).eq('id',t.id).select('id').single():sb.from('lesson_templates').insert(p).select('id').single();
 let r=await write({...base,...extra});
 if(r.error&&MISSING.test(r.error.message||'')){
  // база ще без полів «час» і «ДЗ»: зберігаємо як раніше, а якщо ці поля заповнені, просимо виконати SQL
  if(extra.time_limit_minutes!==null||extra.homework)throw new Error('У базі немає полів для часу й домашнього завдання. Виконайте 28_library_parity.sql.');
  r=await write(base);
 }
 const row=fail(r);
 if(!t.id)t.id=row.id;
 return t.id;
}
const orig=TAB.lessonlibrary;
TAB.lessonlibrary=async function(){
 if(current)return '<div id="lt181-editor"></div>';
 const html=await orig.apply(this,arguments);
 return html.replace('<h2>Моя бібліотека уроків</h2>','<h2>Моя бібліотека уроків</h2><button class="btn" data-act="lt181new">+ Створити урок</button>')
  .replace(/(<button class="btn small danger" data-act="ltdelete" data-id="([^"]+)")/g,
    (_whole,button,id)=>`<button class="btn small secondary" data-act="lt181edit" data-id="${id}">Редагувати</button>${button}`);
};
// The original library HTML is assembled by a closure; the previous string patch carries its template expression literally.
A.lt181new=()=>{current={id:null,title:'',description:'',content:[],presentation_path:null,notes_path:null,time_limit_minutes:null,homework:null};renderApp();};
A.lt181edit=async el=>{const r=await sb.from('lesson_templates').select('*').eq('id',el.dataset.id).single();current=deep(fail(r));renderApp();};
A.lt181back=()=>{current=null;renderApp();};
A.lt181newq=()=>{document.querySelector('#lt181-qform').innerHTML=editorForm();};
A.lt181editq=el=>{const i=Number(el.dataset.qi);document.querySelector('#lt181-qform').innerHTML=editorForm(current.content[i],i);};
A.lt181closequestion=()=>{document.querySelector('#lt181-qform').innerHTML='';};
A.lt181delq=el=>{if(confirm('Видалити завдання?')){current.content.splice(Number(el.dataset.qi),1);persist().then(()=>renderApp()).catch(e=>alert(e.message));}};
function move(el,step){const i=+el.dataset.qi,j=i+step;if(j<0||j>=current.content.length)return;[current.content[i],current.content[j]]=[current.content[j],current.content[i]];persist().then(()=>renderApp()).catch(e=>alert(e.message));}
A.lt181upq=el=>move(el,-1);A.lt181downq=el=>move(el,1);
A.lt181removefile=async el=>{const k=el.dataset.kind;if(!confirm('Прибрати файл із шаблону?'))return;current[k+'_path']=null;current[k+'_name']=null;if(current.id){fail(await sb.from('lesson_templates').update({[k+'_path']:null,[k+'_name']:null}).eq('id',current.id));}renderApp();};
F.lt181meta=async f=>{current.title=f.elements.namedItem('title').value;current.description=f.elements.namedItem('description').value;await persist();toast('Урок збережено');renderApp();};
F.lt181question=async f=>{const q=parseForm(f),idx=f.elements.namedItem('qi').value;if(idx!=='')current.content[Number(idx)]={...current.content[Number(idx)],...q};else current.content.push(q);await persist();toast('Завдання збережено');renderApp();};
F.lt181import=async f=>{if(typeof window.__msParseTest!=='function')throw new Error('Не завантажено stage16.js');const result=window.__msParseTest(f.elements.namedItem('test').value);if(!result.items.length)throw new Error('Не знайдено завдань: '+result.skipped.join('; '));const qs=result.items.map(x=>({qtype:x.type,prompt:x.prompt,options:x.options,correct:x.type==='matching'?x.correct.map(n=>n===0?-1:n-1):x.type==='single'?x.correct-1:x.type==='multiple'?x.correct.map(n=>n-1):x.correct,points:x.points,explanation:x.explanation}));qs.forEach(valid);current.content.push(...qs);await persist();toast('Імпортовано: '+qs.length+(result.skipped.length?'; пропущено: '+result.skipped.length:''));renderApp();};
const hwOf=()=>{const h=current.homework||{};return {instructions:String(h.instructions||''),exercises:Array.isArray(h.exercises)?h.exercises:[]};};
const setHw=async patch=>{const prev=current.homework;current.homework={...hwOf(),...patch};try{await persist();}catch(e){current.homework=prev;throw e;}};
F.lt181time=async f=>{const v=String(new FormData(f).get('min')||'').trim();const n=v?Number(v):null;if(n!==null&&(!Number.isInteger(n)||n<1||n>600))throw new Error('Час: ціле число хвилин від 1 до 600');const prev=current.time_limit_minutes;current.time_limit_minutes=n;try{await persist();}catch(e){current.time_limit_minutes=prev;throw e;}toast('Збережено');renderApp();};
F.lt181hwmeta=async f=>{await setHw({instructions:String(new FormData(f).get('instructions')||'').slice(0,5000)});toast('ДЗ збережено');renderApp();};
F.lt181hwadd=async f=>{const text=String(new FormData(f).get('exercise')||'').trim();if(!text||text.length>4000)throw new Error('Уведіть умову до 4000 символів');const ex=[...hwOf().exercises,{text,options:[]}];if(ex.length>100)throw new Error('Максимум 100 вправ');await setHw({exercises:ex});toast('Вправу додано');renderApp();};
A.lt181hwremove=async el=>{if(!confirm('Видалити вправу?'))return;const ex=hwOf().exercises.slice();ex.splice(+el.dataset.index,1);await setHw({exercises:ex});renderApp();};
F.lt181hwtext=async f=>{if(typeof window.__ms23ParseHomework!=='function')throw new Error('Не завантажено stage23.js');const added=window.__ms23ParseHomework(f.elements.namedItem('source').value);const ex=[...hwOf().exercises,...added];if(ex.length>100)throw new Error('Ліміт — 100 вправ загалом');await setHw({exercises:ex});toast('Додано '+added.length+' вправ. Перевірте текст.');renderApp();};
F.lt181hwai=async f=>{const files=[...f.querySelector('input[type=file]').files];if(!files.length||files.length>5)throw new Error('Оберіть 1–5 фото');const images=[];for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('Фото має бути JPG, PNG або WEBP до 15 МБ');const blob=typeof resizeToJpeg==='function'?await resizeToJpeg(file,1600):file;images.push({mime:blob.type||'image/jpeg',data:await b64(blob)});}toast('ШІ розпізнає вправи…');const r=await sb.functions.invoke('generate-questions',{body:{images,mode:'homework'}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);const added=(r.data?.questions||[]).map(q=>({text:String(q.prompt||'').trim(),options:Array.isArray(q.options)?q.options:[]})).filter(q=>q.text);if(!added.length)throw new Error('ШІ не знайшов вправ');const ex=[...hwOf().exercises,...added];if(ex.length>100)throw new Error('Усього може бути не більше 100 вправ');await setHw({exercises:ex});toast('Додано '+added.length+' вправ. Перевірте текст та формули.');renderApp();};
const b64=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=()=>no(new Error('Не вдалося прочитати фото'));r.readAsDataURL(blob)});
F.lt181ai=async f=>{const files=[...f.querySelector('input[type=file]').files];if(!files.length||files.length>5)throw new Error('Додайте від 1 до 5 фото');const images=[];for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4500000)throw new Error('Некоректне або надто велике фото');images.push({mime:file.type,data:await b64(file)});}const r=await sb.functions.invoke('generate-questions',{body:{images}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);const qs=(r.data?.questions||[]).map(q=>({qtype:q.type,prompt:q.prompt,options:q.options,correct:q.type==='matching'?q.correct.map(n=>n===0?-1:n-1):q.type==='single'?q.correct-1:q.type==='multiple'?q.correct.map(n=>n-1):q.correct,points:q.points,explanation:q.explanation}));qs.forEach(valid);if(!qs.length)throw new Error('Не отримано коректних завдань');current.content.push(...qs);await persist();toast('Розпізнано '+qs.length+' завдань. Перевірте їх.');renderApp();};
document.addEventListener('change',async e=>{const k=e.target?.dataset?.lt181File;if(!k)return;try{const f=e.target.files?.[0];if(!f)return;if(f.size>25*1024*1024)throw new Error('Файл понад 25 МБ');await persist();const path=`${S.profile.id}/${current.id}/${k}_${crypto.randomUUID()}_${f.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;fail(await sb.storage.from('lesson-library').upload(path,f,{contentType:f.type||'application/octet-stream'}));fail(await sb.from('lesson_templates').update({[k+'_path']:path,[k+'_name']:f.name}).eq('id',current.id));current[k+'_path']=path;current[k+'_name']=f.name;toast('Файл збережено');renderApp();}catch(err){alert(err.message);}});
// renderApp is asynchronous: paint when the library editor appears.
let busy=false;new MutationObserver(()=>{if(busy||!current||!ctl()||ctl().children.length)return;busy=true;try{paint();}finally{busy=false;}}).observe(document.body,{childList:true,subtree:true});
})();
