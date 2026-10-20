/* MathSpace · етап 12: розумна перевірка + статистика + розклад.
   Підключається ПІСЛЯ усіх інших stage-файлів. */
(function () {
  /* ===== НАЛАШТУВАННЯ (перевірте ці рядки) ===== */
  const CFG = {
    // як у вашому коді називається клієнт Supabase
    client: () => window.sb || window.supabaseClient || window.supabaseClient2 ||
      (window.supabase && window.supabase.from ? window.supabase : null),
    attemptsTable: 'attempts',   // колонки: student_id, score, max_score, topic, created_at
    lessonsTable: 'lessons',     // створюється SQL нижче
    studentId: () => window.currentStudentId || (window.currentUser && window.currentUser.id) || null,
    isTeacher: () => true        // замініть на вашу перевірку ролі
  };

  /* ===== 1. РОЗУМНЕ ПОРІВНЯННЯ ВІДПОВІДЕЙ ===== */
  function norm(s) {
    s = String(s).toLowerCase().trim()
      .replace(/\$/g, '').replace(/[−–—]/g, '-')
      .replace(/×|·|\\cdot|\\times/g, '*').replace(/÷/g, '/')
      .replace(/π|\\pi/g, 'pi').replace(/√|\\sqrt/g, 'sqrt')
      .replace(/\\left|\\right/g, '').replace(/\s+/g, '')
      .replace(/(\d),(\d)/g, '$1.$2');
    let prev;
    do {
      prev = s;
      s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
    } while (s !== prev);
    return s.replace(/\{/g, '(').replace(/\}/g, ')');
  }
  function evaluate(s) {
    let i = 0;
    const startsFactor = () => /[\d(.ps]/.test(s[i] || '');
    function expr() {
      let v = term();
      while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const t = term(); v = o === '+' ? v + t : v - t; }
      return v;
    }
    function term() {
      let v = unary();
      while (i < s.length && (s[i] === '*' || s[i] === '/' || startsFactor())) {
        if (s[i] === '*') { i++; v *= unary(); }
        else if (s[i] === '/') { i++; v /= unary(); }
        else v *= power();
      }
      return v;
    }
    function unary() {
      if (s[i] === '-') { i++; return -unary(); }
      if (s[i] === '+') { i++; return unary(); }
      return power();
    }
    function power() { const b = atom(); if (s[i] === '^') { i++; return Math.pow(b, unary()); } return b; }
    function atom() {
      if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw 0; return v; }
      if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
      if (s.startsWith('sqrt', i)) { i += 4; return Math.sqrt(atom()); }
      const m = /^\d*\.?\d+/.exec(s.slice(i));
      if (!m) throw 0;
      i += m[0].length; return parseFloat(m[0]);
    }
    const r = expr(); if (i !== s.length) throw 0; return r;
  }
  function single(A, B) {
    if (A === B) return true;
    try {
      const x = evaluate(A), y = evaluate(B);
      return isFinite(x) && isFinite(y) && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
    } catch (e) { return false; }
  }
  window.mathAnswerEqual = function (student, correct) {
    const sa = String(student).split(';').map(norm).filter(Boolean).sort();
    const ca = String(correct).split(';').map(norm).filter(Boolean).sort();
    return sa.length === ca.length && sa.every((x, k) => single(x, ca[k]));
  };

  /* ===== 2. ІНТЕРФЕЙС: кнопка + вікно ===== */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
#ms12-btn{position:fixed;right:16px;bottom:16px;z-index:9998;padding:10px 16px;border:0;border-radius:24px;
 background:#4f46e5;color:#fff;font:600 15px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}
#ms12-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:12px}
#ms12-box{background:#fff;color:#111;width:min(640px,100%);max-height:90vh;overflow:auto;border-radius:14px;padding:18px;font:16px/1.5 system-ui,sans-serif}
#ms12-box h3{margin:.4em 0}
.ms12-tabs{display:flex;gap:8px;margin-bottom:12px}
.ms12-tabs button{flex:1;padding:8px;border:1px solid #c7c7d1;border-radius:8px;background:#f4f4f8;cursor:pointer;font:inherit}
.ms12-tabs button.on{background:#4f46e5;color:#fff;border-color:#4f46e5}
.ms12-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee}
.ms12-bar{height:8px;border-radius:4px;background:#e5e7eb;overflow:hidden;min-width:90px;flex:1}
.ms12-bar i{display:block;height:100%;background:#ef4444}
.ms12-box input,.ms12-box button.act{font:inherit;padding:7px 9px;border:1px solid #c7c7d1;border-radius:8px}
.ms12-close{float:right;border:0;background:none;font-size:24px;cursor:pointer}
.ms12-muted{color:#6b7280;font-size:14px}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.id = 'ms12-btn'; btn.textContent = '📊 Прогрес і розклад';
  const ov = document.createElement('div');
  ov.id = 'ms12-ov';
  ov.innerHTML = '<div id="ms12-box" class="ms12-box"></div>';
  document.body.append(btn, ov);
  const box = ov.firstChild;
  let tab = 'stats';

  btn.onclick = () => { ov.style.display = 'flex'; render(); };
  ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };

  function shell(inner) {
    box.innerHTML = `<button class="ms12-close" aria-label="Закрити">×</button>
      <div class="ms12-tabs">
        <button data-t="stats" class="${tab === 'stats' ? 'on' : ''}">📊 Прогрес</button>
        <button data-t="plan" class="${tab === 'plan' ? 'on' : ''}">📅 Розклад</button>
      </div><div id="ms12-body">${inner}</div>`;
    box.querySelector('.ms12-close').onclick = () => ov.style.display = 'none';
    box.querySelectorAll('.ms12-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  }
  function render() {
    shell('<p class="ms12-muted">Завантаження…</p>');
    (tab === 'stats' ? renderStats() : renderPlan()).catch(e => {
      console.warn(e);
      box.querySelector('#ms12-body').innerHTML =
        '<p>Не вдалося завантажити дані. Перевірте, що виконано SQL для етапу 12 і що назви таблиць у блоці НАЛАШТУВАННЯ збігаються з вашими.</p>';
    });
  }

  /* ===== 3. СТАТИСТИКА ===== */
  async function renderStats() {
    const db = CFG.client(); if (!db) throw new Error('no client');
    let q = db.from(CFG.attemptsTable).select('*').order('created_at', { ascending: true }).limit(500);
    const sid = CFG.studentId();
    if (!CFG.isTeacher() && sid) q = q.eq('student_id', sid);
    const { data, error } = await q; if (error) throw error;
    const rows = (data || []).filter(r => +r.max_score > 0);
    if (!rows.length) { box.querySelector('#ms12-body').innerHTML = '<p>Поки немає результатів.</p>'; return; }

    const pct = rows.map(r => Math.round(100 * r.score / r.max_score));
    const avg = Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
    const W = 560, H = 160, n = pct.length;
    const pts = pct.map((p, i) => `${n === 1 ? W / 2 : 10 + i * (W - 20) / (n - 1)},${H - 10 - p * (H - 20) / 100}`).join(' ');

    const topics = {};
    rows.forEach(r => {
      const t = r.topic || 'Без теми';
      (topics[t] = topics[t] || { s: 0, m: 0 });
      topics[t].s += +r.score; topics[t].m += +r.max_score;
    });
    const tl = Object.entries(topics).map(([t, v]) => [t, Math.round(100 * v.s / v.m)]).sort((a, b) => a[1] - b[1]);

    box.querySelector('#ms12-body').innerHTML = `
      <p>Робіт: <b>${n}</b> · середній бал: <b>${avg}%</b> · остання: <b>${pct[n - 1]}%</b></p>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#f8f8fc;border-radius:10px">
        <polyline fill="none" stroke="#4f46e5" stroke-width="3" points="${pts}"/></svg>
      <h3>Слабкі теми</h3>
      ${tl.map(([t, p]) => `<div class="ms12-row"><span style="flex:1.2">${esc(t)}</span>
        <div class="ms12-bar"><i style="width:${100 - p}%"></i></div><b>${p}%</b></div>`).join('')}
      <p class="ms12-muted">Червона смужка показує, скільки балів втрачено.</p>`;
  }

  /* ===== 4. РОЗКЛАД ===== */
  async function renderPlan() {
    const db = CFG.client(); if (!db) throw new Error('no client');
    const from = new Date(Date.now() - 3600e3).toISOString();
    const { data, error } = await db.from(CFG.lessonsTable).select('*')
      .gte('starts_at', from).order('starts_at', { ascending: true }).limit(100);
    if (error) throw error;
    const fmt = d => new Date(d).toLocaleString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const teacher = CFG.isTeacher();
    box.querySelector('#ms12-body').innerHTML = `
      ${(data || []).map(l => `<div class="ms12-row"><div><b>${fmt(l.starts_at)}</b><br>${esc(l.title)}
        ${l.note ? `<br><span class="ms12-muted">${esc(l.note)}</span>` : ''}</div>
        ${teacher ? `<button class="act" data-del="${l.id}">🗑</button>` : ''}</div>`).join('') || '<p>Найближчих уроків немає.</p>'}
      ${teacher ? `<h3>Додати урок</h3>
        <div style="display:grid;gap:8px">
          <input id="ms12-dt" type="datetime-local">
          <input id="ms12-ti" placeholder="Тема / назва уроку">
          <input id="ms12-no" placeholder="Нотатка (необов'язково)">
          <button class="act" id="ms12-add" style="background:#4f46e5;color:#fff;border:0">Додати</button>
        </div>` : ''}`;
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      await db.from(CFG.lessonsTable).delete().eq('id', b.dataset.del); render();
    });
    const add = box.querySelector('#ms12-add');
    if (add) add.onclick = async () => {
      const dt = box.querySelector('#ms12-dt').value, ti = box.querySelector('#ms12-ti').value.trim();
      if (!dt || !ti) return alert('Вкажіть дату, час і тему');
      const row = { starts_at: new Date(dt).toISOString(), title: ti, note: box.querySelector('#ms12-no').value.trim() || null };
      const { error: e } = await db.from(CFG.lessonsTable).insert(row);
      if (e) return alert('Помилка: ' + e.message);
      render();
    };
  }
})();
