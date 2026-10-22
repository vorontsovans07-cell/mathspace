/* MathSpace Stage 25: private in-app notification bell. Load after stage24-compatible stage19.js. */
(function(){
'use strict';
const escapeHTML = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const state={open:false,items:[],ready:false,loading:false,lastUser:null};
const css=document.createElement('style');
css.textContent=`.ms-bell{position:relative;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e3dff1;border-radius:12px;background:#fff;color:#5941b0;padding:9px 12px;font-size:19px;cursor:pointer}.ms-bell-count{position:absolute;top:-8px;right:-8px;min-width:18px;border-radius:20px;background:#a33e55;color:#fff;font-size:11px;padding:2px 4px}.ms-notice-panel{position:fixed;z-index:9999;right:14px;top:78px;width:min(430px,calc(100vw - 28px));max-height:min(75vh,650px);overflow:auto;border-radius:17px;background:#fff;box-shadow:0 12px 55px #28203c38;border:1px solid #e6e0ef;padding:14px;color:#29223a}.ms-notice-head{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:10px}.ms-notice-card{display:block;text-align:left;width:100%;border:1px solid #e9e5f2;border-radius:11px;background:#fff;padding:10px;margin:7px 0;color:inherit;cursor:pointer}.ms-notice-card.unread{background:#f6f2ff;border-color:#d8caf7}.ms-notice-card small{display:block;margin-top:5px;color:#777}.ms-notice-card span{display:block;margin-top:4px;white-space:normal;overflow-wrap:anywhere}.ms-notice-action{border:0;background:transparent;color:#5941b0;cursor:pointer;padding:7px}`;
document.head.appendChild(css);
function shell(){
 if(!S.session || !S.profile || !document.querySelector('.top'))return;
 const user=S.session.user.id;
 if(state.lastUser!==user){state.items=[];state.ready=false;state.lastUser=user;}
 const top=document.querySelector('.top');
 if(!top.querySelector('[data-ms-bell]')){
  const btn=document.createElement('button');btn.type='button';btn.className='ms-bell';btn.dataset.msBell='1';btn.setAttribute('aria-label','Сповіщення');btn.textContent='🔔';
  top.appendChild(btn);
 }
 paintBadge();
}
function paintBadge(){
 const n=state.items.filter(x=>!x.read_at).length;
 const bell=document.querySelector('[data-ms-bell]');if(!bell)return;
 let b=bell.querySelector('.ms-bell-count');
 if(n){if(!b){b=document.createElement('span');b.className='ms-bell-count';bell.appendChild(b);}b.textContent=n>99?'99+':String(n);}
 else if(b)b.remove();
}
async function fetchNotices(){
 if(!S.session || !S.profile || state.loading)return;
 state.loading=true;
 try{
  const {data,error}=await sb.from('ms_notifications').select('id,kind,title,body,created_at,read_at,lesson_id').order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  state.items=data||[];state.ready=true;paintBadge();if(state.open)paintPanel();
 }catch(err){if(state.open){const host=document.querySelector('.ms-notice-panel');if(host)host.innerHTML='<p>Не вдалося завантажити сповіщення. Перевірте SQL Stage 25.</p>';}}
 finally{state.loading=false;}
}
function paintPanel(){
 let panel=document.querySelector('.ms-notice-panel');if(!state.open){if(panel)panel.remove();return;}
 if(!panel){panel=document.createElement('section');panel.className='ms-notice-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Сповіщення');document.body.appendChild(panel);}
 panel.innerHTML=`<div class="ms-notice-head"><strong>🔔 Сповіщення</strong><div><button type="button" class="ms-notice-action" data-ms-all>Прочитати все</button><button type="button" class="ms-notice-action" data-ms-close aria-label="Закрити">✕</button></div></div>`+
 (state.items.length?state.items.map(n=>`<button type="button" class="ms-notice-card ${n.read_at?'':'unread'}" data-ms-item="${n.id}"><b>${escapeHTML(n.title)}</b><span>${escapeHTML(n.body)}</span><small>${new Date(n.created_at).toLocaleString('uk-UA')}</small></button>`).join(''):'<p style="padding:12px">Нових сповіщень поки немає.</p>');
 document.dispatchEvent(new Event('ms:panel'));
}
async function read(ids){
 if(!ids.length)return;
 const {error}=await sb.from('ms_notifications').update({read_at:new Date().toISOString()}).in('id',ids);
 if(error){toast('Не вдалося позначити повідомлення прочитаним: '+error.message,true);return;}
 const hit=new Set(ids.map(Number));state.items.forEach(n=>{if(hit.has(Number(n.id)))n.read_at=new Date().toISOString();});paintBadge();paintPanel();
}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-ms-bell],[data-ms-close],[data-ms-all],[data-ms-item]');
 if(!t)return;
 if(t.hasAttribute('data-ms-bell')){state.open=!state.open;paintPanel();if(state.open)fetchNotices();}
 else if(t.hasAttribute('data-ms-close')){state.open=false;paintPanel();}
 else if(t.hasAttribute('data-ms-all'))read(state.items.filter(n=>!n.read_at).map(n=>n.id));
 else if(t.hasAttribute('data-ms-item')){
  const n=state.items.find(x=>String(x.id)===t.dataset.msItem);if(!n)return;
  if(!n.read_at)read([n.id]);
  state.open=false;paintPanel();
  // Existing lesson routing differs by role/stage; opening 'Уроки' is safe for all accounts.
  location.hash='#/t/lessons';
 }
});
document.addEventListener('ms:rendered',()=>{if(document.querySelector('.top')&&!document.querySelector('[data-ms-bell]'))shell();});
setInterval(()=>{if(S.session&&S.profile){shell();fetchNotices();}else if(state.lastUser){state.lastUser=null;state.items=[];state.open=false;paintPanel();}},45000);
setTimeout(()=>{shell();fetchNotices();},1200);
window.MathSpaceNotifications={refresh:fetchNotices};
})();
