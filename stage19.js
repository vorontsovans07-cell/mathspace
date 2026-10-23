/* MathSpace Stage 19 — homework block with multi-photo submissions.
   Load after stage18_1.js. Requires homework_multiple_photos.sql to be applied. */
(function(){
'use strict';
const h=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const must=r=>{if(r.error)throw r.error;return r.data};
const staff=()=>S.profile&&['teacher','admin','owner'].includes(S.profile.role);
const asList=v=>Array.isArray(v)?v:[];
const safeExercises=v=>asList(v).map(x=>({id:String(x?.id||''),text:String(x?.text||x?.prompt||'').trim(),options:Array.isArray(x?.options)?x.options:[]})).filter(x=>x.text);
/* ---- розв'язання (лише для викладача): окрема таблиця lesson_homework_solutions, ключ — id вправи ---- */
const newId=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const ensureIds=list=>{const seen=new Set(list.map(x=>x.id).filter(Boolean));return list.map(x=>{if(x.id)return x;let id;do{id=newId();}while(seen.has(id));seen.add(id);return {...x,id};});};
const solErr=e=>/relation|schema cache|does not exist|find the table/i.test(e?.message||'')?new Error('Виконайте 29_homework_solutions.sql у Supabase.'):e;
async function solutionsOf(lid,strict){
 const r=await sb.from('lesson_homework_solutions').select('solutions').eq('lesson_id',lid).maybeSingle();
 if(r.error){if(strict)throw solErr(r.error);return {};}
 return (r.data&&r.data.solutions)||{};
}
async function saveSolutions(lid,map){
 const r=await sb.from('lesson_homework_solutions').upsert({lesson_id:lid,solutions:map,updated_at:new Date().toISOString()},{onConflict:'lesson_id'});
 if(r.error)throw solErr(r.error);
}
function solDetails(lid,x,i,ver,sols){
 const sol=x.id?String(sols[x.id]||''):'';
 return `<details class="hw-sol"><summary><b>${i+1}.</b> <span class="hw-sol-q">${h(x.text)}</span></summary><div class="hw-sol-body">
  <div class="muted small">Розв’язання бачите лише ви, учню воно не показується.</div>
  <div class="hw-sol-text" data-empty="Розв’язання ще не додано.">${h(sol)}</div>
  ${x.id?`<form data-form="hwsol" data-lid="${h(lid)}" data-id="${h(x.id)}"><label>Розв’язання</label><textarea name="solution" rows="5" maxlength="8000">${h(sol)}</textarea><button class="btn small secondary">Зберегти розв’язання</button></form>`:'<div class="muted small">Оновіть сторінку, щоб додати розв’язання.</div>'}
  <button type="button" class="btn small danger" data-act="hwremove" data-lid="${h(lid)}" data-index="${i}" data-ver="${h(ver)}">Видалити вправу</button></div></details>`;
}
function printExercises(items){return items.map((x,i)=>`<div class="hw-exercise"><b>Вправа ${i+1}</b><div class="hw-tex">${h(x.text)}</div>${asList(x.options).length?`<div class="hw-options">${x.options.map((y,j)=>`<div>${j+1}. ${h(y)}</div>`).join('')}</div>`:''}</div>`).join('');}
const css=document.createElement('style');css.textContent='.hw-exercise{border-top:1px solid #e4e0ef;padding:14px 0}.hw-tex{white-space:pre-wrap;margin-top:6px;overflow-wrap:anywhere}.hw-options{padding:8px 0 0 16px}.hw-exercise textarea{width:100%}.hw-sol{border-top:1px solid #e4e0ef;padding:10px 0}.hw-sol>summary{cursor:pointer}.hw-sol-q{white-space:pre-wrap;overflow-wrap:anywhere}.hw-sol-body{margin:10px 0 0 14px;padding:10px 12px;border-left:3px solid #cfc4fb;background:#faf8ff;border-radius:0 10px 10px 0}.hw-sol-body textarea{width:100%;margin:4px 0 8px}.hw-sol-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.hw-sol-text:empty::before{content:attr(data-empty);color:#776e89}.hw-tex .katex{font-size:1.04em}.hw-photo-links{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.hw-photo-links a{display:inline-block}.hw-file-note{font-size:13px;color:#776e89;margin:7px 0 12px}';document.head.appendChild(css);
async function homework(lid){const r=await sb.from('lesson_homework').select('*').eq('lesson_id',lid).maybeSingle();return must(r)}
async function submission(lid){const r=await sb.from('homework_submissions').select('*').eq('lesson_id',lid).maybeSingle();return must(r)}
function submissionPaths(sub){
  if(Array.isArray(sub?.image_paths)&&sub.image_paths.length)return sub.image_paths;
  return sub?.image_path?[sub.image_path]:[];
}
async function photoLinks(paths,label='Фото'){
  const links=[];
  for(let i=0;i<paths.length;i++){
    const r=await sb.storage.from('homework-photos').createSignedUrl(paths[i],1800);
    if(!r.error&&r.data?.signedUrl)links.push(`<a class="btn small secondary" href="${h(r.data.signedUrl)}" target="_blank" rel="noopener">${h(label)} ${i+1}</a>`);
  }
  return links.length?`<div class="hw-photo-links">${links.join('')}</div>`:'';
}
const origStaff=staffLesson;
window.staffLesson=async function(sid,lid){
 const page=await origStaff.apply(this,arguments);if(!staff())return page;
 let hw=await homework(lid);
 if(hw&&asList(hw.exercises).some(x=>!x?.id)){try{await save(lid,{exercises:safeExercises(hw.exercises)},hw);hw=await homework(lid);}catch(e){/* не критично */}}
 const exercises=safeExercises(hw?.exercises);const sols=await solutionsOf(lid);
 const allHw=must(await sb.from('lesson_homework').select('lesson_id'));
 const srcIds=allHw.map(x=>x.lesson_id).filter(id=>id!==lid);
 const srcLessons=srcIds.length?must(await sb.from('lessons').select('id,title,student_id').in('id',srcIds)):[];
 const sources=srcLessons.filter(x=>x.student_id!==sid);
 const sourcePicker=sources.length ? `<form data-form="hwcopy" data-lid="${h(lid)}" class="field"><label>Копіювати ДЗ з уроку іншого учня</label><select name="source" required><option value="">Оберіть урок з готовим ДЗ</option>${sources.map(x=>`<option value="${h(x.id)}">${h(x.title)}</option>`).join('')}</select><div class="muted small">Копіюються інструкція, вправи та розв’язання. Після копіювання ДЗ залишається прихованим, доки ти його не опублікуєш.</div><button class="btn secondary">Копіювати ДЗ в цей урок</button></form>` : '<p class="muted small">У доступних уроках інших учнів ще немає ДЗ для копіювання.</p>';
 const r=await sb.from('homework_submissions').select('student_id,image_path,image_paths,submitted_at,teacher_feedback,reviewed_at').eq('lesson_id',lid).maybeSingle();const sub=must(r);
 const att=sub?await photoLinks(submissionPaths(sub),'Переглянути фото'): '';
 return page+`<div class="card"><h2>Домашнє завдання</h2><p class="muted small">Учень бачить усі вправи одразу та може надіслати до 10 фото виконаної роботи. Оцінювання вручну.</p>
 <form data-form="hwsettings" data-lid="${h(lid)}"><div class="field"><label>Інструкція до ДЗ</label><textarea name="instructions" rows="3" maxlength="5000">${h(hw?.instructions||'')}</textarea></div>
 <label><input type="checkbox" name="published" ${hw?.published?'checked':''}> Показувати ДЗ учню</label><div class="flex"><button class="btn">Зберегти ДЗ</button></div></form>
 ${sourcePicker}<h3>Вправи (${exercises.length})</h3><p class="muted small">Натисніть на вправу, щоб побачити розв’язання (воно видиме лише викладачам).</p>${exercises.map((x,i)=>solDetails(lid,x,i,hw?.updated_at||'',sols)).join('')}
 <form data-form="hwadd" data-lid="${h(lid)}"><div class="field"><label>Нова вправа</label><textarea name="exercise" required maxlength="4000" rows="3"></textarea></div><div class="field"><label>Розв’язання (необов’язково, бачите лише ви)</label><textarea name="solution" maxlength="8000" rows="3"></textarea></div><button class="btn secondary">+ Додати вправу</button></form>
 <form data-form="hwai" data-lid="${h(lid)}"><div class="field"><label>Розпізнати вправи з фото за допомогою Gemini (до 5 фото)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required></div><button class="btn secondary">Розпізнати й додати вправи</button></form>
 ${sub?`<div class="notice"><b>Виконана робота:</b> ${new Date(sub.submitted_at).toLocaleString('uk-UA')} ${att}<form data-form="hwreview" data-lid="${h(lid)}" data-student="${h(sub.student_id)}"><label>Коментар учню</label><textarea name="feedback" maxlength="3000" rows="2">${h(sub.teacher_feedback)}</textarea><button class="btn">Зберегти коментар</button></form></div>`:'<p class="muted">Учень ще не надіслав роботу.</p>'}</div>`;
};
const origStudent=studentLesson;
window.studentLesson=async function(lid){
 const page=await origStudent.apply(this,arguments);const hw=await homework(lid);if(!hw?.published)return page;
 const exercises=safeExercises(hw.exercises);const sub=await submission(lid);
 const links=sub?await photoLinks(submissionPaths(sub),'Переглянути фото'):'';
 return page+`<div class="card"><h2>Домашнє завдання</h2><div class="hw-tex">${h(hw.instructions)}</div>${printExercises(exercises)}
 <form data-form="hwsubmit" data-lid="${h(lid)}"><div class="field"><label>Фото виконаного домашнього завдання (JPG, PNG, WEBP; до 10 фото, кожне до 15 МБ)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required><div class="hw-file-note">Можна вибрати кілька фото за один раз. Загальний розмір усіх фото — до 50 МБ.</div></div><button class="btn">${sub?'Замінити фото роботи':'Надіслати виконане ДЗ'}</button></form>
 ${sub?`<p class="muted">Надіслано: ${new Date(sub.submitted_at).toLocaleString('uk-UA')}.</p>${links}`:''}
 ${sub?.teacher_feedback?`<div class="notice"><b>Коментар викладача:</b> ${h(sub.teacher_feedback)}</div>`:''}</div>`;
};
const CONFLICT='ДЗ було змінено в іншому вікні чи пристрої. Оновіть сторінку й повторіть дію.';
/* old: рядок, на основі якого зроблено зміну (null — рядка ще не було; undefined — прочитати зараз).
   Запис проходить лише якщо updated_at не змінився, тож паралельні правки не затирають одна одну. */
async function save(lid,patch,old){
 if(patch.exercises)patch={...patch,exercises:ensureIds(patch.exercises)};
 if(old===undefined)old=await homework(lid);
 const upd=new Date().toISOString();
 if(!old){
  const r=await sb.from('lesson_homework').insert({lesson_id:lid,...patch,updated_at:upd});
  if(r.error){if(r.error.code==='23505')throw Error(CONFLICT);throw r.error;}
  return;
 }
 let q=sb.from('lesson_homework').update({...patch,updated_at:upd}).eq('lesson_id',lid);
 q=old.updated_at==null?q.is('updated_at',null):q.eq('updated_at',old.updated_at);
 const r=await q.select('lesson_id');
 if(r.error)throw r.error;
 if(!r.data||!r.data.length)throw Error(CONFLICT);
}
window.__msHwSave=save;
window.__msHw={save,newId,ensureIds,solutionsOf,saveSolutions,safeExercises};
F.hwsettings=async form=>{const d=new FormData(form);await save(form.dataset.lid,{instructions:String(d.get('instructions')||''),published:d.has('published')});toast('Домашнє завдання збережено');renderApp()};
F.hwcopy=async form=>{
 const lid=form.dataset.lid,source=String(new FormData(form).get('source')||'');
 if(!source)throw Error('Оберіть урок-джерело');
 const current=await homework(lid);const replace=!!current;
 if(replace&&!confirm('Поточні умови й вправи ДЗ буде замінено копією з іншого уроку. Фото та коментарі учня залишаться без змін. Продовжити?'))return;
 const r=await sb.rpc('copy_lesson_homework',{p_source:source,p_target:lid,p_replace:replace});
 must(r);
 try{ // синхронізуємо id вправ і переносимо розв'язання
  const [srcHw,dstHw,srcSol]=await Promise.all([homework(source),homework(lid),solutionsOf(source,true)]);
  const srcEx=safeExercises(srcHw?.exercises);
  if(srcEx.length&&srcEx.every(x=>x.id)){
   await save(lid,{exercises:srcEx},dstHw);
   const keep={};srcEx.forEach(x=>{if(srcSol[x.id])keep[x.id]=srcSol[x.id];});
   await saveSolutions(lid,keep);
  }
 }catch(e){toast('ДЗ скопійовано, але розв’язання не перенесено: '+(e.message||e),true);renderApp();return;}
 toast('ДЗ скопійовано. Перевірте та опублікуйте його для учня.');renderApp();
};
F.hwadd=async form=>{const lid=form.dataset.lid,old=await homework(lid);const fd=new FormData(form),text=String(fd.get('exercise')||'').trim(),sol=String(fd.get('solution')||'').trim();if(!text||text.length>4000)throw Error('Уведіть умову до 4000 символів');if(sol.length>8000)throw Error('Розв’язання довше за 8000 символів');const id=newId();const exercises=[...safeExercises(old?.exercises),{id,text,options:[]}];if(exercises.length>100)throw Error('Максимум 100 вправ');const map=sol?await solutionsOf(lid,true):null;await save(lid,{exercises},old);if(sol){map[id]=sol;try{await saveSolutions(lid,map);}catch(e){toast('Вправу додано, але розв’язання не збережено: '+(e.message||e),true);renderApp();return;}}toast('Вправу додано');renderApp()};
F.hwsol=async form=>{const lid=form.dataset.lid,id=form.dataset.id,text=String(new FormData(form).get('solution')||'').trim();if(text.length>8000)throw Error('Розв’язання довше за 8000 символів');const map=await solutionsOf(lid,true);if(text)map[id]=text;else delete map[id];await saveSolutions(lid,map);const box=form.parentElement.querySelector('.hw-sol-text');if(box)box.textContent=text;toast('Розв’язання збережено')};
A.hwremove=async el=>{if(!confirm('Видалити вправу?'))return;const old=await homework(el.dataset.lid);if(!old||(old.updated_at||'')!==(el.dataset.ver||''))throw Error(CONFLICT);const exercises=safeExercises(old.exercises);const removed=exercises.splice(+el.dataset.index,1)[0];await save(el.dataset.lid,{exercises},old);try{if(removed&&removed.id){const map=await solutionsOf(el.dataset.lid,true);if(removed.id in map){delete map[removed.id];await saveSolutions(el.dataset.lid,map);}}}catch(e){/* розв'язання лишилось сиротою, не критично */}renderApp()};
function b64(blob){return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(String(f.result).split(',')[1]);f.onerror=reject;f.readAsDataURL(blob)})}
F.hwai=async form=>{const files=[...form.querySelector('input[type=file]').files];if(!files.length||files.length>5)throw Error('Оберіть 1–5 фото');const images=[];for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>4_500_000)throw Error('Фото має бути JPG/PNG/WEBP до 4,5 МБ');images.push({mime:f.type,data:await b64(f)})}toast('ШІ розпізнає вправи…');const {data,error}=await sb.functions.invoke('generate-questions',{body:{images,mode:'homework'}});if(error)throw error;if(data?.error)throw Error(data.error);const added=asList(data?.questions).map(q=>({id:newId(),text:String(q.prompt||'').trim(),options:Array.isArray(q.options)?q.options:[],solution:String(q.solution||q.explanation||'').trim().slice(0,8000)})).filter(q=>q.text);if(!added.length)throw Error('ШІ не знайшов вправ');const lid=form.dataset.lid,old=await homework(lid);const exercises=[...safeExercises(old?.exercises),...added.map(({id,text,options})=>({id,text,options}))];if(exercises.length>100)throw Error('Усього може бути не більше 100 вправ');const wantSol=added.some(x=>x.solution);const map=wantSol?await solutionsOf(lid,true):null;await save(lid,{exercises},old);if(wantSol){added.forEach(x=>{if(x.solution)map[x.id]=x.solution;});try{await saveSolutions(lid,map);}catch(e){toast('Вправи додано, але розв’язання не збережено: '+(e.message||e),true);renderApp();return;}}toast('Додано '+added.length+' вправ. Перевірте текст та формули.');renderApp()};
F.hwsubmit=async form=>{
 const input=form.querySelector('input[type=file]');
 const files=[...(input?.files||[])];
 if(!files.length||files.length>10)throw Error('Оберіть від 1 до 10 фото');
 let total=0;
 for(const f of files){
   if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw Error('Усі фото мають бути JPG, PNG або WEBP');
   if(f.size>15*1024*1024)throw Error('Кожне фото має бути не більше 15 МБ');
   total+=f.size;
 }
 if(total>50*1024*1024)throw Error('Загальний розмір усіх фото має бути не більше 50 МБ');
 const lid=form.dataset.lid,uid=S.profile.id,paths=[];
 for(let i=0;i<files.length;i++){
   let f=files[i],ctype=f.type;
   if(typeof resizeToJpeg==='function'&&f.size>2*1024*1024){f=await resizeToJpeg(f,2200);ctype='image/jpeg';}
   const ext=ctype==='image/png'?'png':ctype==='image/webp'?'webp':'jpg';
   const path=`${uid}/${lid}/${crypto.randomUUID()}.${ext}`;
   const uploaded=await sb.storage.from('homework-photos').upload(path,f,{contentType:ctype});
   if(uploaded.error)throw Error('Не вдалося завантажити фото '+(i+1)+': '+uploaded.error.message);
   paths.push(path);
 }
 const r=await sb.rpc('submit_homework_photos',{p_lesson:lid,p_image_paths:paths});
 if(r.error)throw Error('Фото завантажено, але запис спроби не вдався: '+r.error.message);
 toast('Домашню роботу надіслано ('+files.length+' фото)');
 renderApp();
};
F.hwreview=async form=>{must(await sb.rpc('review_homework',{p_lesson:form.dataset.lid,p_student:form.dataset.student,p_feedback:String(new FormData(form).get('feedback')||'')}));toast('Коментар збережено');renderApp()};
})();
