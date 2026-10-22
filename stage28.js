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
    if(!window.S?.profile || window.S.profile.role==='student')return;
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
      const {data,error}=await sb.from('lessons').delete().eq('id',lid).eq('status','draft').select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Урок не видалено. Перевірте, чи це чернетка і чи маєте право керувати учнем.');
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
  const observer=new MutationObserver(decorate);
  observer.observe(document.body,{subtree:true,childList:true});
  decorate();
})();
