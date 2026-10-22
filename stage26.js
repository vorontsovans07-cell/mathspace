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
// Прив'язує підписку цього браузера до поточного користувача (переприв'язує, якщо раніше була чужа). Потрібен 27_push_register.sql
async function registerOnServer(s){
 const {error}=await sb.rpc('ms_register_push',{p_endpoint:s.endpoint,p_p256dh:s.keys.p256dh,p_auth:s.keys.auth});
 if(error)throw error;
}
// Якщо дозвіл уже є, тихо відновлюємо прив'язку після входу (без запитів дозволу)
let syncedFor='';
async function syncSilently(){
 const uid=S?.session?.user?.id;
 if(!uid||syncedFor===uid||!available()||Notification.permission!=='granted'||!VAPID_PUBLIC_KEY)return;
 syncedFor=uid;
 try{
  const reg=await navigator.serviceWorker.getRegistration('./');
  const sub=await reg?.pushManager.getSubscription();
  const s=sub&&sub.toJSON();
  if(s?.keys?.p256dh&&s.keys.auth)await registerOnServer(s);
 }catch(_){syncedFor='';}
}
// Перед виходом відв'язуємо цей пристрій від акаунта, щоб чужі сповіщення сюди не надходили
async function unbindBeforeLogout(){
 try{
  const reg=await navigator.serviceWorker.getRegistration('./');
  const sub=await reg?.pushManager.getSubscription();
  if(sub)await sb.from('ms_push_subscriptions').delete().eq('endpoint',sub.endpoint);
 }catch(_){}
 syncedFor='';
}
if(typeof A!=='undefined'&&A.logout){const baseLogout=A.logout;A.logout=async function(){await unbindBeforeLogout();return baseLogout.apply(this,arguments);};}
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
  await registerOnServer(s);
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
document.addEventListener('ms:rendered',()=>{
 if(S?.session?.user?.id){mount();syncSilently();}
 else{lastUser='';syncedFor='';document.querySelector('.ms-push-control')?.remove();}
});
setTimeout(()=>{mount();syncSilently();},1400);
})();
