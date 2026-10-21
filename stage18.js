/* MathSpace stage18 · private lesson library. Requires 18_lesson_library.sql */
(function(){
'use strict';
const h=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const staff=()=>S.profile && ['teacher','admin','owner'].includes(S.profile.role);
const baseTabs=tabs;
window.tabs=function(){const a=baseTabs();if(staff()&&!a.some(x=>x[0]==='lessonlibrary'))a.splice(a.findIndex(x=>x[0]==='profile'),0,['lessonlibrary','Бібліотека уроків','📖']);return a;};
const styles=document.createElement('style');styles.textContent='.lt-search{width:100%;margin:12px 0}.lt-entry{border-top:1px solid #eee;padding:14px 0}.lt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}';document.head.appendChild(styles);
let search='',timer=null;
function must(r){if(r.error)throw r.error;return r.data;}
function ext(path){const s=String(path||'');const last=s.split('/').pop()||'file';return last.replace(/[^a-zA-Z0-9_.-]/g,'_');}
async function transfer(srcBucket,srcPath,destBucket,destPath){
 if(!srcPath)return null;
 const file=must(await sb.storage.from(srcBucket).download(srcPath));
 must(await sb.storage.from(destBucket).upload(destPath,file,{contentType:file.type||'application/octet-stream',upsert:false}));
 return destPath;
}
async function createTemplate(lid){
 const t=must(await sb.rpc('template_from_lesson',{p_lesson:lid}));
 const lesson=must(await sb.from('lessons').select('presentation_path,notes_path').eq('id',lid).single());
 const uid=S.profile.id;const changes={};const errors=[];
 for(const kind of ['presentation','notes']){
  const source=lesson[kind+'_path'];if(!source)continue;
  try{changes[kind+'_path']=await transfer('lessons',source,'lesson-library',`${uid}/${t}/${kind}_${ext(source)}`)}
  catch(e){errors.push(kind+': '+e.message)}
 }
 // Preserve question images; all paths stored inside question snapshots.
 const tmpl=must(await sb.from('lesson_templates').select('content').eq('id',t).single());
 const content=tmpl.content||[];
 for(let i=0;i<content.length;i++){
  const src=content[i].image_path;if(!src)continue;
  try{content[i].image_path=await transfer('lessons',src,'lesson-library',`${uid}/${t}/q${i}_${ext(src)}`)}
  catch(e){errors.push('зображення '+(i+1)+': '+e.message)}
 }
 changes.content=content;
 must(await sb.from('lesson_templates').update(changes).eq('id',t));
 if(errors.length)throw new Error('Шаблон створено, але частину файлів не скопійовано: '+errors.join('; '));
 toast('Урок збережено у приватній бібліотеці');return t;
}
async function assignTemplate(tid,sid){
 const res=must(await sb.rpc('lesson_from_template',{p_template:tid,p_student:sid}));
 const lid=res.lesson_id,changes={},fail=[];
 for(const k of ['presentation','notes']){
  const src=res[k+'_path'];if(!src)continue;
  try{changes[k+'_path']=await transfer('lesson-library',src,'lessons',`${sid}/${lid}/${k}_${ext(src)}`);changes[k+'_name']=res[k+'_name']||ext(src)}
  catch(e){fail.push(k+': '+e.message)}
 }
 if(Object.keys(changes).length)must(await sb.from('lessons').update(changes).eq('id',lid));
 for(const im of res.images||[]){
  try{const dst=await transfer('lesson-library',im.path,'lessons',`${sid}/${lid}/q_${crypto.randomUUID()}_${ext(im.path)}`);
   must(await sb.rpc('set_question_image',{p_question:im.question_id,p_path:dst}));}
  catch(e){fail.push('зображення завдання: '+e.message)}
 }
 if(fail.length)throw new Error('Урок створено як чернетку, але частина матеріалів не скопійована: '+fail.join('; '));
 toast('Копію уроку створено для учня');location.hash=`#/t/lessons/${sid}/${lid}`;renderApp();
}
TAB.lessonlibrary=async function(){
 if(!staff())return '<div class="card">Доступ лише для викладачів.</div>';
 const r=await sb.rpc('search_my_lesson_templates',{p_search:search.trim()});must(r);
 const list=r.data;
 const st=must(await sb.from('profiles').select('id,first_name,last_name,role,teacher_id').eq('role','student'));
 const students=st.filter(s=>s.teacher_id===S.profile.id || ['admin','owner'].includes(S.profile.role));
 return `<div class="card"><h2>Моя бібліотека уроків</h2><p class="muted small">Приватна бібліотека. Пошук за назвою, описом і текстом завдань.</p>
 <input class="lt-search" type="search" id="lt-search" value="${h(search)}" placeholder="Пошук по всьому тексту уроків...">
 ${list.map(x=>`<div class="lt-entry"><b>${h(x.title)}</b><p class="small muted">${h(x.description)} · Завдань: ${(x.content||[]).length}</p>
 <div class="lt-actions"><select data-lt-student="${h(x.id)}"><option value="">Обрати учня</option>${students.map(z=>`<option value="${h(z.id)}">${h((z.last_name||'')+' '+(z.first_name||''))}</option>`).join('')}</select>
 <button class="btn small" data-act="ltassign" data-id="${h(x.id)}">Додати учню</button><button class="btn small danger" data-act="ltdelete" data-id="${h(x.id)}">Видалити</button></div></div>`).join('')||'<p class="muted">Уроків не знайдено.</p>'}</div>`;
};
const oldLesson=staffLesson;
window.staffLesson=async function(sid,lid){const original=await oldLesson.apply(this,arguments);if(!staff())return original;
 return `<div class="card"><button class="btn secondary" data-act="ltarchive" data-lid="${h(lid)}">📖 Зберегти копію уроку в мою бібліотеку</button></div>`+original;};
A.ltarchive=async el=>{el.disabled=true;try{await createTemplate(el.dataset.lid);renderApp()}finally{el.disabled=false}};
A.ltassign=async el=>{const s=document.querySelector(`select[data-lt-student="${el.dataset.id}"]`);if(!s?.value)throw new Error('Оберіть учня');el.disabled=true;try{await assignTemplate(el.dataset.id,s.value)}finally{el.disabled=false}};
A.ltdelete=async el=>{if(!confirm('Видалити шаблон із бібліотеки?'))return;const t=el.dataset.id;must(await sb.from('lesson_templates').delete().eq('id',t));toast('Шаблон видалено');renderApp()};
document.addEventListener('input',e=>{if(e.target?.id!=='lt-search')return;search=e.target.value;clearTimeout(timer);timer=setTimeout(()=>{const pos=e.target.selectionStart;renderApp();setTimeout(()=>{const field=document.querySelector('#lt-search');if(field){field.focus();field.setSelectionRange(pos,pos)}},220)},350)});
})();
