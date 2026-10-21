/* MathSpace Stage 19 — independent homework block. Load after stage18_1.js. */
(function(){
'use strict';
const h=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const must=r=>{if(r.error)throw r.error;return r.data};
const staff=()=>S.profile&&['teacher','admin','owner'].includes(S.profile.role);
const asList=v=>Array.isArray(v)?v:[];
const safeExercises=v=>asList(v).map(x=>({text:String(x?.text||x?.prompt||'').trim(),options:Array.isArray(x?.options)?x.options:[]})).filter(x=>x.text);
function printExercises(items){return items.map((x,i)=>`<div class="hw-exercise"><b>Вправа ${i+1}</b><div class="hw-tex">${h(x.text)}</div>${asList(x.options).length?`<div class="hw-options">${x.options.map((y,j)=>`<div>${j+1}. ${h(y)}</div>`).join('')}</div>`:''}</div>`).join('');}
const css=document.createElement('style');css.textContent='.hw-exercise{border-top:1px solid #e4e0ef;padding:14px 0}.hw-tex{white-space:pre-wrap;margin-top:6px;overflow-wrap:anywhere}.hw-options{padding:8px 0 0 16px}.hw-exercise textarea{width:100%}.hw-tex .katex{font-size:1.04em}';document.head.appendChild(css);
async function homework(lid){const r=await sb.from('lesson_homework').select('*').eq('lesson_id',lid).maybeSingle();return must(r)}
async function submission(lid){const r=await sb.from('homework_submissions').select('*').eq('lesson_id',lid).maybeSingle();return must(r)}
const origStaff=staffLesson;
window.staffLesson=async function(sid,lid){
 const page=await origStaff.apply(this,arguments);if(!staff())return page;
 const hw=await homework(lid);const exercises=safeExercises(hw?.exercises);
 // List homework from other students' lessons accessible to this teacher.
 const [allHw,allLessons]=await Promise.all([
   sb.from('lesson_homework').select('lesson_id'),
   sb.from('lessons').select('id,title,student_id')
 ]);
 must(allHw);must(allLessons);
 const targetLesson=allLessons.data.find(x=>x.id===lid);
 const hwIds=new Set(allHw.data.map(x=>x.lesson_id));
 const sources=allLessons.data.filter(x=>x.id!==lid && x.student_id!==targetLesson?.student_id && hwIds.has(x.id));
 const sourcePicker=sources.length ? `<form data-form="hwcopy" data-lid="${h(lid)}" class="field"><label>Копіювати ДЗ з уроку іншого учня</label><select name="source" required><option value="">Оберіть урок з готовим ДЗ</option>${sources.map(x=>`<option value="${h(x.id)}">${h(x.title)}</option>`).join('')}</select><div class="muted small">Копіюються лише інструкція та вправи. Після копіювання ДЗ залишається прихованим, доки ти його не опублікуєш.</div><button class="btn secondary">Копіювати ДЗ в цей урок</button></form>` : '<p class="muted small">У доступних уроках інших учнів ще немає ДЗ для копіювання.</p>';

 const r=await sb.from('homework_submissions').select('student_id,image_path,submitted_at,teacher_feedback,reviewed_at').eq('lesson_id',lid).maybeSingle();const sub=must(r);
 let att='';if(sub?.image_path){const url=await sb.storage.from('homework-photos').createSignedUrl(sub.image_path,1800);if(!url.error)att=`<a class="btn small secondary" href="${h(url.data.signedUrl)}" target="_blank" rel="noopener">Переглянути фото виконаної роботи</a>`;}
 return page+`<div class="card"><h2>Домашнє завдання</h2><p class="muted small">Учень бачить усі вправи одразу та наприкінці надсилає одне фото виконаної роботи. Оцінювання вручну.</p>
 <form data-form="hwsettings" data-lid="${h(lid)}"><div class="field"><label>Інструкція до ДЗ</label><textarea name="instructions" rows="3" maxlength="5000">${h(hw?.instructions||'')}</textarea></div>
 <label><input type="checkbox" name="published" ${hw?.published?'checked':''}> Показувати ДЗ учню</label><div class="flex"><button class="btn">Зберегти ДЗ</button></div></form>
 ${sourcePicker}<h3>Вправи (${exercises.length})</h3>${exercises.map((x,i)=>`<div class="hw-exercise"><b>${i+1}.</b> ${h(x.text)}<button class="btn small danger" data-act="hwremove" data-lid="${h(lid)}" data-index="${i}">Видалити</button></div>`).join('')}
 <form data-form="hwadd" data-lid="${h(lid)}"><div class="field"><label>Нова вправа</label><textarea name="exercise" required maxlength="4000" rows="3"></textarea></div><button class="btn secondary">+ Додати вправу</button></form>
 <form data-form="hwai" data-lid="${h(lid)}"><div class="field"><label>Розпізнати вправи з фото за допомогою Gemini (до 5 фото)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple required></div><button class="btn secondary">Розпізнати й додати вправи</button></form>
 ${sub?`<div class="notice"><b>Виконана робота:</b> ${new Date(sub.submitted_at).toLocaleString('uk-UA')} ${att}</div><form data-form="hwreview" data-lid="${h(lid)}" data-student="${h(sub.student_id)}"><label>Коментар учню</label><textarea name="feedback" maxlength="3000" rows="2">${h(sub.teacher_feedback)}</textarea><button class="btn">Зберегти коментар</button></form>`:'<p class="muted">Учень ще не надіслав роботу.</p>'}</div>`;
};
const origStudent=studentLesson;
window.studentLesson=async function(lid){
 const page=await origStudent.apply(this,arguments);const hw=await homework(lid);if(!hw?.published)return page;
 const exercises=safeExercises(hw.exercises);const sub=await submission(lid);let link='';
 if(sub?.image_path){const r=await sb.storage.from('homework-photos').createSignedUrl(sub.image_path,1800);if(!r.error)link=` <a href="${h(r.data.signedUrl)}" target="_blank" rel="noopener">Переглянути</a>`;}
 return page+`<div class="card"><h2>Домашнє завдання</h2><div class="hw-tex">${h(hw.instructions)}</div>${printExercises(exercises)}
 <form data-form="hwsubmit" data-lid="${h(lid)}"><label>Фото виконаного домашнього завдання (JPG, PNG, WEBP, до 15 МБ)</label><input type="file" accept="image/jpeg,image/png,image/webp" required><button class="btn">${sub?'Замінити фото роботи':'Надіслати виконане ДЗ'}</button></form>
 ${sub?`<p class="muted">Надіслано: ${new Date(sub.submitted_at).toLocaleString('uk-UA')}.${link}</p>`:''}
 ${sub?.teacher_feedback?`<div class="notice"><b>Коментар викладача:</b> ${h(sub.teacher_feedback)}</div>`:''}</div>`;
};
async function save(lid,patch){const old=await homework(lid);const payload={...old,...patch,lesson_id:lid,updated_at:new Date().toISOString()};must(await sb.from('lesson_homework').upsert(payload,{onConflict:'lesson_id'}));}
F.hwsettings=async form=>{const d=new FormData(form);await save(form.dataset.lid,{instructions:String(d.get('instructions')||''),published:d.has('published')});toast('Домашнє завдання збережено');renderApp()};
F.hwcopy=async form=>{
 const lid=form.dataset.lid,source=String(new FormData(form).get('source')||'');
 if(!source)throw Error('Оберіть урок-джерело');
 const current=await homework(lid);
 const replace=!!current;
 if(replace&&!confirm('Поточні умови й вправи ДЗ буде замінено копією з іншого уроку. Фото та коментарі учня залишаться без змін. Продовжити?'))return;
 const r=await sb.rpc('copy_lesson_homework',{p_source:source,p_target:lid,p_replace:replace});
 must(r);toast('ДЗ скопійовано. Перевірте та опублікуйте його для учня.');renderApp();
};
F.hwadd=async form=>{const lid=form.dataset.lid,old=await homework(lid);const text=String(new FormData(form).get('exercise')||'').trim();if(!text||text.length>4000)throw Error('Уведіть умову до 4000 символів');const exercises=[...safeExercises(old?.exercises),{text,options:[]}];if(exercises.length>100)throw Error('Максимум 100 вправ');await save(lid,{exercises});toast('Вправу додано');renderApp()};
A.hwremove=async el=>{if(!confirm('Видалити вправу?'))return;const old=await homework(el.dataset.lid);const exercises=safeExercises(old?.exercises);exercises.splice(+el.dataset.index,1);await save(el.dataset.lid,{exercises});renderApp()};
function b64(blob){return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(String(f.result).split(',')[1]);f.onerror=reject;f.readAsDataURL(blob)})}
F.hwai=async form=>{const files=[...form.querySelector('input[type=file]').files];if(!files.length||files.length>5)throw Error('Оберіть 1–5 фото');const images=[];for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>4_500_000)throw Error('Фото має бути JPG/PNG/WEBP до 4,5 МБ');images.push({mime:f.type,data:await b64(f)})}toast('ШІ розпізнає вправи…');const {data,error}=await sb.functions.invoke('generate-questions',{body:{images,mode:'homework'}});if(error)throw error;if(data?.error)throw Error(data.error);const added=asList(data?.questions).map(q=>({text:String(q.prompt||'').trim(),options:Array.isArray(q.options)?q.options:[]})).filter(q=>q.text);if(!added.length)throw Error('ШІ не знайшов вправ');const old=await homework(form.dataset.lid);const exercises=[...safeExercises(old?.exercises),...added];if(exercises.length>100)throw Error('Усього може бути не більше 100 вправ');await save(form.dataset.lid,{exercises});toast('Додано '+added.length+' вправ. Перевірте текст та формули.');renderApp()};
F.hwsubmit=async form=>{const f=form.querySelector('input[type=file]')?.files?.[0];if(!f||!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15*1024*1024)throw Error('Виберіть фото JPG/PNG/WEBP до 15 МБ');const lid=form.dataset.lid,uid=S.profile.id;const path=`${uid}/${lid}/${crypto.randomUUID()}.${f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg'}`;must(await sb.storage.from('homework-photos').upload(path,f,{contentType:f.type}));const r=await sb.from('homework_submissions').upsert({lesson_id:lid,student_id:uid,image_path:path,submitted_at:new Date().toISOString()},{onConflict:'lesson_id,student_id'});if(r.error)throw Error('Фото завантажено, але запис спроби не вдався: '+r.error.message);toast('Домашню роботу надіслано');renderApp()};
F.hwreview=async form=>{must(await sb.rpc('review_homework',{p_lesson:form.dataset.lid,p_student:form.dataset.student,p_feedback:String(new FormData(form).get('feedback')||'')}));toast('Коментар збережено');renderApp()};
})();
