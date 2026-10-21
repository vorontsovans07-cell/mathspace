/* MathSpace Stage 26: Web Push opt-in. Requires Stage 25 database notifications. */
(function(){
'use strict';
// PASTE YOUR PUBLIC VAPID KEY BETWEEN QUOTES. It is safe to publish this one.
const VAPID_PUBLIC_KEY = 'BF7-5EmYkEYekoXmjzSw-ti22ajw_l3_PSCoq3MyvQycMkqBkZu8qHA034ktBxztkxtfFTTW1iFZRjd19ci_iow';
const css=document.createElement('style');css.textContent='.ms-push-control{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.ms-push-control button{border:1px solid #d7cced;border-radius:10px;padding:9px 12px;background:#eee8ff;color:#4d339d;cursor:pointer}.ms-push-status{font-size:12px;color:#5a5571}.ms-push-error{color:#a43451}';document.head.appendChild(css);
const b64urlToUint8=s=>{const padding='='.repeat((4-s.length%4)%4);const raw=atob((s+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
let pending=false,lastUser='';
function available(){return location.protocol==='https:'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
function notify(text,bad=false){const x=document.querySelector('[data-ms-push-status]');if(x){x.textContent=text;x.classList.toggle('ms-push-error',bad);}else if(typeof toast==='function')toast(text,bad);}
async function getRegistration(){return navigator.serviceWorker.register('ms-push-sw.js',{scope:'./'});}
async function setup(){
 if(pending)return;
 pending=true;
 try{
  if(!S?.session?.user?.id)throw Error('Увійдіть до свого акаунта MathSpace.');
  if(!available())throw Error('Цей браузер не підтримує Web Push. На iPhone додайте MathSpace на початковий екран і відкрийте його з іконки.');
  if(!VAPID_PUBLIC_KEY||VAPID_PUBLIC_KEY.startsWith('REPLACE_'))throw Error('Адміністратор ще не налаштував публічний VAPID-ключ.');
  // Crucially: browser permission is requested ONLY in the direct button click, not automatically.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Потрібно дозволити сповіщення в налаштуваннях браузера.');
  const reg=await getRegistration();
  let sub=await reg.pushManager.getSubscription();
  if(sub && sub.options?.applicationServerKey){
    const old=new Uint8Array(sub.options.applicationServerKey);
    const wanted=b64urlToUint8(VAPID_PUBLIC_KEY);
    if(old.length!==wanted.length||old.some((v,i)=>v!==wanted[i])){await sub.unsubscribe();sub=null;}
  }
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64urlToUint8(VAPID_PUBLIC_KEY)});
  const s=sub.toJSON();if(!s.keys?.p256dh||!s.keys?.auth)throw Error('Браузер не повернув ключі підписки.');
  const {error:lookupError,data:prior}=await sb.from('ms_push_subscriptions').select('id,user_id').eq('endpoint',s.endpoint).maybeSingle();
  if(lookupError)throw lookupError;
  if(prior){if(prior.user_id!==S.session.user.id)throw Error('Цей браузер прив’язаний до іншого користувача. Спочатку вимкніть push в іншому акаунті.');}
  else{
   const {error}=await sb.from('ms_push_subscriptions').insert({user_id:S.session.user.id,endpoint:s.endpoint,p256dh:s.keys.p256dh,auth_key:s.keys.auth});
   if(error)throw error;
  }
  notify('Сповіщення на цьому пристрої увімкнено.');
 }catch(err){notify('Не вдалося підключити push: '+(err.message||String(err)),true);}finally{pending=false;}
}
async function disable(){
 try{
  const reg=await navigator.serviceWorker.getRegistration('./');
  const sub=await reg?.pushManager.getSubscription();
  if(sub){const {error}=await sb.from('ms_push_subscriptions').delete().eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe();}
  notify('Push вимкнено на цьому пристрої.');
 }catch(err){notify('Помилка вимкнення: '+(err.message||String(err)),true);}
}
function mount(){
 if(!S?.session?.user?.id||!S?.profile)return;
 const user=S.session.user.id;
 if(lastUser!==user){document.querySelector('.ms-push-control')?.remove();lastUser=user;}
 if(document.querySelector('.ms-push-control'))return;
 const host=document.querySelector('.top');if(!host)return;
 const el=document.createElement('div');el.className='ms-push-control';
 el.innerHTML='<button type="button" data-ms-push-on>🔔 Увімкнути push</button><button type="button" data-ms-push-off>Вимкнути</button><span class="ms-push-status" data-ms-push-status></span>';
 host.appendChild(el);
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-ms-push-on]'))setup();
 if(event.target.closest('[data-ms-push-off]'))disable();
});
const ob=new MutationObserver(()=>{if(S?.session?.user?.id&&!document.querySelector('.ms-push-control'))mount();});
ob.observe(document.body,{subtree:true,childList:true});
setInterval(()=>{if(S?.session?.user?.id)mount();else{lastUser='';document.querySelector('.ms-push-control')?.remove();}},12000);
setTimeout(mount,1400);
})();
