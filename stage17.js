/* MathSpace · Stage 17. Load AFTER stage16.js and mathkeys.js.
   Requires matching variants of stage2, stage5, stage10, stage13, stage14 and 17_matching.sql. */
(function () {
  'use strict';
  const html = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const letters = 'АБВГДЕЄЖЗИ';
  function safeOptions(o) { return o && Array.isArray(o.left) && Array.isArray(o.right) ? o : {left:[],right:[]}; }
  const mapping = c => Array.isArray(c) ? c.map((v,i) => `${i + 1}–${v == null ? '—' : v === -1 ? 'Немає відповідності' : letters[v] || (v+1)}`).join('; ') : '—';
  function columns(o) {
    o=safeOptions(o);
    return `<div class="msmatch-cols"><div><b>Ліва колонка</b>${o.left.map((t,i)=>`<div>${i+1}. ${html(t)}</div>`).join('')}</div><div><b>Права колонка</b>${o.right.map((t,i)=>`<div>${letters[i]||i+1}. ${html(t)}</div>`).join('')}</div></div>`;
  }
  function input(o) {
    o=safeOptions(o);
    return `${columns(o)}<div class="msmatch-answers">${o.left.map((t,i)=>`<label class="msmatch-row"><span>${i+1}.</span><select data-match-row="${i}" aria-label="Відповідність для пункту ${i+1}"><option value="">— Оберіть —</option><option value="-1">Немає відповідності</option>${o.right.map((x,j)=>`<option value="${j}">${letters[j]||j+1}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  function collect(node) { return [...node.querySelectorAll('select[data-match-row]')].map(s=>s.value === ''? null:Number(s.value)); }
  function restore(node, arr) {
    if (!Array.isArray(arr)) return;
    node.querySelectorAll('select[data-match-row]').forEach((el,i)=>{el.value = Number.isInteger(arr[i])?String(arr[i]):'';});
    enforce(node);
  }
  function enforce(node) {
    const sels=[...node.querySelectorAll('select[data-match-row]')];
    const chosen=sels.map(s=>s.value).filter(v=>v!=='');
    sels.forEach(s=>[...s.options].forEach(op=> {op.disabled=op.value!=='' && op.value!=='-1' && op.value!==s.value && chosen.includes(op.value); }));
  }
  function sourceFor(form) {
    if (!form.dataset.ai) return null;
    const ai= form.dataset.form === 'libaddq' ? S.libAi : S.ai;
    return ai?.items?.find(q=>String(q.id)===String(form.dataset.ai)) || null;
  }
  function decorate(form) {
    if (form.dataset.matchReady === '1') return;
    const sel=form.querySelector('select[name="type"]');
    if (!sel) return;
    form.dataset.matchReady='1';
    const q=sourceFor(form);
    const match=q?.type==='matching' && q.options ? q : null;
    const mk=(v)=>html((v||[]).join('\n'));
    const fields=document.createElement('div');
    fields.className='msmatch-fields';
    fields.innerHTML=`<div class="field"><label>Ліва колонка — кожен елемент з нового рядка</label><textarea name="match_left" rows="4">${mk(match?.options?.left)}</textarea></div>
      <div class="field"><label>Права колонка — кожен елемент з нового рядка</label><textarea name="match_right" rows="4">${mk(match?.options?.right)}</textarea></div>
      <div class="field"><label>Правильні пари: для кожного рядка ліворуч номер праворуч; 0 = немає відповідності (наприклад 2,0,1)</label>
      <input name="match_correct" value="${html(match && Array.isArray(match.correct) ? match.correct.join(',') : '')}"></div>
      <p class="muted small">2–10 елементів у кожній колонці. Кількість може відрізнятися. 0 означає відсутність пари; інші номери від 1. Повтори номерів, крім 0, заборонені.</p>`;
    const origOptions=form.querySelector('[name="options"]')?.closest('.field');
    const origCorrect=form.querySelector('[name="correct"]')?.closest('.field');
    (origOptions || sel.closest('.field')).before(fields);
    function refresh() {
      const yes=sel.value==='matching';
      fields.hidden=!yes;
      if (origOptions) origOptions.hidden=yes;
      if (origCorrect) origCorrect.hidden=yes;
    }
    sel.addEventListener('change',refresh); refresh();
  }
  function readForm(form) {
    const fd=new FormData(form);
    const line=k=>String(fd.get(k)||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const left=line('match_left'),right=line('match_right');
    const raw=String(fd.get('match_correct')||'').trim();
    const vals=raw.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (left.length<2 || left.length>10 || right.length<2 || right.length>10) throw new Error('Кожна колонка повинна містити від 2 до 10 елементів');
    if ([...left,...right].some(s=>s.length>500)) throw new Error('Елемент колонки задовгий (максимум 500 символів)');
    if (vals.length!==left.length || vals.some(n=>!Number.isInteger(n) || n<0 || n>right.length) || new Set(vals.filter(n=>n!==0)).size!==vals.filter(n=>n!==0).length)
      throw new Error('Заповніть усі рядки: 0 — без пари, інші номери від 1; повтори заборонені');
    const prompt=String(fd.get('prompt')||'').trim();
    if (!prompt || prompt.length>4000) throw new Error('Умова завдання повинна містити 1–4000 символів');
    const points=Number(fd.get('points'));
    if (!Number.isFinite(points) || points<=0 || points>100) throw new Error('Некоректна кількість балів');
    return {prompt,options:{left,right},correct:vals.map(n=>n===0?-1:n-1),points,explanation:String(fd.get('expl')||'').trim()};
  }
  window.MSMatch={input,collect,restore,enforce,readForm,columns,mapping,describe:(o,c)=>columns(o)+`<div class="small"><b>Правильно:</b> ${mapping(c)}</div>`};
  const style=document.createElement('style');
  style.textContent='.msmatch-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:10px 0}.msmatch-cols>div{background:#f7f4ff;border-radius:12px;padding:12px;min-width:0}.msmatch-cols>div>div{padding:6px 0;overflow-wrap:anywhere}.msmatch-answers{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}.msmatch-row{display:flex;gap:8px;align-items:center}.msmatch-row select{min-width:110px;width:auto}.msmatch-fields[hidden]{display:none}@media(max-width:560px){.msmatch-cols{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  // Manual creation of lesson questions + Gemini single imports.
  const oldAdd=F.addq;
  F.addq=async function(form) {
    if (new FormData(form).get('type') !== 'matching') return oldAdd.apply(this,arguments);
    const m=readForm(form);
    const save=async()=>{
      const {error}=await sb.rpc('save_question',{
        p_lesson:form.dataset.lid,p_id:null,p_type:'matching',p_prompt:m.prompt,
        p_options:m.options,p_correct:m.correct,p_points:m.points,p_explanation:m.explanation
      });
      if(error) throw error;
    };
    const r=window.__msPhotoFlow?await window.__msPhotoFlow.run(form,save):(await save(),{photo:'none'});
    if(form.dataset.ai && S.ai) S.ai.items=S.ai.items.filter(q=>String(q.id)!==form.dataset.ai);
    if(r.photo==='fail')toast('Завдання додано, але фото не збережено: '+(r.error.message||r.error),true);
    else toast(r.photo==='ok'?'Завдання на відповідність додано разом із фото':'Завдання на відповідність додано');
    renderApp();
  };
  document.addEventListener('change',ev=>{
    const target=ev.target;
    if(target.matches?.('select[data-match-row]')){
      const container=target.closest('[data-q],[data-pq]');
      if(container) enforce(container);
    }
  });
  let pending=false;
  const observer=new MutationObserver(()=>{
    if(pending)return; pending=true;
    queueMicrotask(()=>{pending=false;document.querySelectorAll('form[data-form="addq"],form[data-form="libaddq"]').forEach(decorate);});
  });
  observer.observe(document.body,{subtree:true,childList:true});
  document.querySelectorAll('form[data-form="addq"],form[data-form="libaddq"]').forEach(decorate);
})();
