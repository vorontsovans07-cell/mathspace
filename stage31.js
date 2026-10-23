/* MathSpace Stage 31 — online / last-seen status.
   Requires 31_presence.sql. Add <script src="stage31.js?v=2"></script> AFTER stage29.js.
   Teacher sees own students, student sees own teacher, admin/owner see everyone. */
(function () {
  'use strict';
  if (window.__ms31) return;
  window.__ms31 = true;
  if (typeof sb === 'undefined' || typeof S === 'undefined') {
    console.error('MathSpace Stage 31: sb/S not available. Check script order.');
    return;
  }
  const BEAT = 60000, FRESH = 20000;
  const st = { map: new Map(), own: null, at: 0, busy: false, off: false, uid: null,
               people: null, peopleBusy: false };

  const css = document.createElement('style');
  css.textContent = `
  .ms31-st{display:inline-block;margin-left:8px;font-size:12px;font-weight:600;color:#8a809d;white-space:nowrap}
  .ms31-st.on{color:#208a58}
  .ms31-st.on::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#2fb872;margin-right:5px}
  .ms31-toggle{display:flex;align-items:center;gap:7px;margin:10px 4px 0;font-size:13px;color:#625a78;cursor:pointer}
  .ms31-toggle input{width:auto;margin:0}`;
  document.head.appendChild(css);

  const missing = e => /function|schema cache|find the function|does not exist/i.test((e && e.message) || '');

  function when(iso) {
    const d = new Date(iso), n = new Date();
    const t = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(n) - day(d)) / 86400000);
    if (diff <= 0) return 'був(ла) о ' + t;
    if (diff === 1) return 'вчора о ' + t;
    return 'був(ла) ' + d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) + ' о ' + t;
  }
  function badge(uid) {
    if (!uid || (S.profile && uid === S.profile.id)) return '';
    const r = st.map.get(uid);
    if (!r) return st.at ? '<span class="ms31-st">ще не заходив(ла)</span>' : '';
    if (r.hidden || !r.last_seen) return '';
    return r.online ? '<span class="ms31-st on">онлайн</span>'
                    : `<span class="ms31-st">${when(r.last_seen)}</span>`;
  }

  async function loadPeople() {
    if (st.people || st.peopleBusy || typeof getPeople !== 'function') return;
    st.peopleBusy = true;
    try {
      const list = await getPeople();
      st.people = new Map(list.filter(p => p.email).map(p => [String(p.email).toLowerCase(), p.id]));
      paint();
    } catch (e) { /* без статусів, якщо не вдалося */ }
    finally { st.peopleBusy = false; }
  }

  function slot(parent, after) {
    let s = parent.querySelector(':scope > .ms31-slot');
    if (!s) {
      s = document.createElement('span');
      s.className = 'ms31-slot';
      (after || parent.lastElementChild || parent).insertAdjacentElement(after ? 'afterend' : 'beforeend', s);
    }
    return s;
  }

  function paint() {
    if (!S.session || !S.profile || st.off) return;
    // Списки людей (учні, викладачі): рядок знаходимо за email під іменем
    document.querySelectorAll('.who').forEach(w => {
      let uid = w.dataset.ms31;
      if (!uid) {
        if (!st.people) { loadPeople(); return; }
        const sub = w.querySelector('.muted.small');
        if (!sub) return;
        const email = sub.textContent.split('·')[0].trim().toLowerCase();
        uid = st.people.get(email);
        if (!uid) return;
        w.dataset.ms31 = uid;
      }
      const box = w.querySelector('b') && w.querySelector('b').parentElement;
      if (!box) return;
      slot(box, box.querySelector('b')).innerHTML = badge(uid);
    });
    // Головна учня: «Мій викладач»
    if (S.profile.role === 'student' && S.profile.teacher_id) {
      document.querySelectorAll('.card').forEach(c => {
        const lab = c.querySelector(':scope > .muted'), val = c.querySelector(':scope > .stat');
        if (lab && val && lab.textContent.trim() === 'Мій викладач') slot(c, val).innerHTML = badge(S.profile.teacher_id);
      });
    }
    // Перемикач приватності в боковій панелі
    const box = document.querySelector('.userbox');
    if (box && !document.querySelector('.ms31-toggle')) {
      const l = document.createElement('label');
      l.className = 'ms31-toggle';
      l.innerHTML = '<input type="checkbox"> <span>Показувати мій статус</span>';
      l.querySelector('input').checked = !(st.own && st.own.hidden);
      l.querySelector('input').addEventListener('change', async ev => {
        const show = ev.target.checked;
        ev.target.disabled = true;
        const { error } = await sb.rpc('ms_set_presence_hidden', { p_hidden: !show });
        ev.target.disabled = false;
        if (error) { ev.target.checked = !show; if (typeof toast === 'function') toast('Не вдалося змінити: ' + error.message, true); return; }
        refresh(true);
      });
      box.insertAdjacentElement('afterend', l);
    } else if (box) {
      const cb = document.querySelector('.ms31-toggle input');
      if (cb && st.own) cb.checked = !st.own.hidden;
    }
  }

  async function beat() {
    if (st.off || document.visibilityState !== 'visible' || !S.session || !S.profile) return;
    const { error } = await sb.rpc('ms_heartbeat');
    if (error && missing(error)) { st.off = true; console.warn('MathSpace Stage 31: виконайте 31_presence.sql'); }
  }

  async function refresh(force) {
    if (st.off || !S.session || !S.profile || st.busy) return;
    if (st.uid !== S.profile.id) { st.uid = S.profile.id; st.map = new Map(); st.own = null; st.at = 0; st.people = null; }
    if (!force && Date.now() - st.at < FRESH) { paint(); return; }
    st.busy = true;
    try {
      const { data, error } = await sb.rpc('ms_get_presence');
      if (error) { if (missing(error)) st.off = true; return; }
      st.map = new Map((data || []).map(r => [r.user_id, r]));
      st.own = st.map.get(S.profile.id) || null;
      st.at = Date.now();
    } catch (e) { return; }
    finally { st.busy = false; }
    paint();
  }

  document.addEventListener('ms:rendered', () => { paint(); refresh(false); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { beat().then(() => refresh(true)); }
  });
  setInterval(() => { beat().then(() => refresh(true)); }, BEAT);
  setTimeout(() => { beat().then(() => refresh(true)); }, 1500);
})();
