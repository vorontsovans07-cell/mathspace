/* MathSpace Stage 18.1 — in-library lesson editor. Requires stage18.js + SQL 18_1 */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const role=()=>S.profile&&['teacher','owner','admin'].includes(S.profile.role);
let current=null;
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
function paint(){
 if(!current)return;
 const c=ctl();if(!c)return;
 const t=current;

 c.innerHTML=`<div class="card"><div class="flex" style="justify-content:space-between"><h2>${t.id?'Редагувати урок у бібліотеці':'Новий урок у бібліотеці'}</h2><button class="btn secondary" data-act="lt181back">Назад</button></div><form data-form="lt181meta"><div class="field"><label>Назва уроку</label><input name="title" required maxlength="200" value="${esc(t.title)}"></div><div class="field"><label>Опис / тема</label><textarea name="description" rows="3">${esc(t.description)}</textarea></div><button class="btn">Зберегти урок</button></form></div>
 <div class="card"><h2>Матеріали</h2>${['presentation','notes'].map(k=>`<div class="field"><label>${k==='presentation'?'Презентація':'Конспект'}</label><div>${esc(t[k+'_name']||'Немає файлу')}${t[k+'_path']?` <button class="btn small danger" data-act="lt181removefile" data-kind="${k}">Прибрати</button>`:''}</div><input type="file" data-lt181-file="${k}" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.webp"></div>`).join('')}</div>
 <div class="card"><h2>Завдання (${t.content.length})</h2>${t.content.map((q,i)=>`<div class="row"><div style="flex:1"><b>${i+1}. ${esc(types[q.qtype]||q.qtype)}</b><div class="small">${esc(q.prompt).slice(0,250)}</div></div><div class="flex"><button class="btn small secondary" data-act="lt181editq" data-qi="${i}">Редагувати</button><button class="btn small secondary" data-act="lt181upq" data-qi="${i}">↑</button><button class="btn small secondary" data-act="lt181downq" data-qi="${i}">↓</button><button class="btn small danger" data-act="lt181delq" data-qi="${i}">×</button></div></div>`).join('')}<div id="lt181-qform"></div><button class="btn secondary" data-act="lt181newq">+ Завдання</button></div>
 <div class="card"><h2>Імпорт тесту текстом</h2><p class="muted small">Вставте завдання у форматі MathSpace. Підтримуються всі шість типів, включно з відповідностями та 0.</p><form data-form="lt181import"><textarea name="test" rows="8" required placeholder="ЗАВДАННЯ 1&#10;Тип: Один варіант&#10;..."></textarea><button class="btn">Розібрати та додати</button></form></div>
 <div class="card"><h2>Тест із фото (Gemini)</h2><form data-form="lt181ai"><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required><button class="btn">Розпізнати і додати</button></form><p class="muted small">До 5 фото. Обов'язково перевіряйте формули та відповіді перед використанням.</p></div>`;
}
async function persist(){if(!current)throw new Error('Спочатку відкрийте урок');const t=current;if(!t.title.trim())throw new Error('Укажіть назву');t.content.forEach(valid);const payload={title:t.title.trim(),description:t.description||'',content:t.content};if(t.id){const r=await sb.from('lesson_templates').update(payload).eq('id',t.id).select('id').single();fail(r);}else{const r=await sb.from('lesson_templates').insert(payload).select('id').single();t.id=fail(r).id;}return t.id;}
const orig=TAB.lessonlibrary;
TAB.lessonlibrary=async function(){
 if(current)return '<div id="lt181-editor"></div>';
 const html=await orig.apply(this,arguments);
 return html.replace('<h2>Моя бібліотека уроків</h2>','<h2>Моя бібліотека уроків</h2><button class="btn" data-act="lt181new">+ Створити урок</button>')
  .replace(/(<button class="btn small danger" data-act="ltdelete" data-id="([^"]+)")/g,
    (_whole,button,id)=>`<button class="btn small secondary" data-act="lt181edit" data-id="${id}">Редагувати</button>${button}`);
};
// The original library HTML is assembled by a closure; the previous string patch carries its template expression literally.
A.lt181new=()=>{current={id:null,title:'',description:'',content:[],presentation_path:null,notes_path:null};renderApp();};
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
const b64=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=()=>no(new Error('Не вдалося прочитати фото'));r.readAsDataURL(blob)});
F.lt181ai=async f=>{const files=[...f.querySelector('input[type=file]').files];if(!files.length||files.length>5)throw new Error('Додайте від 1 до 5 фото');const images=[];for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4500000)throw new Error('Некоректне або надто велике фото');images.push({mime:file.type,data:await b64(file)});}const r=await sb.functions.invoke('generate-questions',{body:{images}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);const qs=(r.data?.questions||[]).map(q=>({qtype:q.type,prompt:q.prompt,options:q.options,correct:q.type==='matching'?q.correct.map(n=>n===0?-1:n-1):q.type==='single'?q.correct-1:q.type==='multiple'?q.correct.map(n=>n-1):q.correct,points:q.points,explanation:q.explanation}));qs.forEach(valid);if(!qs.length)throw new Error('Не отримано коректних завдань');current.content.push(...qs);await persist();toast('Розпізнано '+qs.length+' завдань. Перевірте їх.');renderApp();};
document.addEventListener('change',async e=>{const k=e.target?.dataset?.lt181File;if(!k)return;try{const f=e.target.files?.[0];if(!f)return;if(f.size>25*1024*1024)throw new Error('Файл понад 25 МБ');await persist();const path=`${S.profile.id}/${current.id}/${k}_${crypto.randomUUID()}_${f.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;fail(await sb.storage.from('lesson-library').upload(path,f,{contentType:f.type||'application/octet-stream'}));fail(await sb.from('lesson_templates').update({[k+'_path']:path,[k+'_name']:f.name}).eq('id',current.id));current[k+'_path']=path;current[k+'_name']=f.name;toast('Файл збережено');renderApp();}catch(err){alert(err.message);}});
// renderApp is asynchronous: paint when the library editor appears.
let busy=false;new MutationObserver(()=>{if(busy||!current||!ctl()||ctl().children.length)return;busy=true;try{paint();}finally{busy=false;}}).observe(document.body,{childList:true,subtree:true});
})();
