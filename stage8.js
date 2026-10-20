/* MathSpace · етап 8: учень переглядає свої спроби (відповіді, бали, коментар викладача).
   Підключається ПІСЛЯ stage7.js. Спершу виконайте 05_attempts.sql */
(function () {
  'use strict';
  S.viewAtt = null;

  const baseStudent = studentLesson;

  function parse(v) {
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { /* звичайний текст */ } }
    return v;
  }

  function fmt(snap, raw) {
    const t = snap.type, a = parse(raw);
    if (a === null || a === undefined || a === '' || (Array.isArray(a) && !a.length)) return '— (без відповіді)';
    const opts = snap.options || [];
    if (t === 'single') return opts[a] !== undefined ? (a + 1) + '. ' + opts[a] : String(a);
    if (t === 'multiple') return [].concat(a).map(i => opts[i] !== undefined ? (i + 1) + '. ' + opts[i] : String(i)).join('; ');
    if (t === 'truefalse') return (a === true || a === 'true') ? 'Правда' : 'Неправда';
    return String(a);
  }

  function mark(a) {
    const s = a.snapshot || {};
    if (a.needs_review || (a.points_awarded === null || a.points_awarded === undefined) && ['long', 'photo'].includes(s.type)) return '⏳';
    if (a.is_correct === true) return '✅';
    if (a.is_correct === false) return '❌';
    const p = Number(a.points_awarded), max = Number(s.points);
    if (isNaN(p)) return '•';
    return p >= max ? '✅' : p > 0 ? '🟡' : '❌';
  }

  function detail(rows) {
    if (!rows.length) return '<div class="muted small" style="margin-top:10px">Для цієї спроби немає збережених відповідей.</div>';
    return rows.map((a, i) => {
      const s = a.snapshot || {};
      const pts = (a.points_awarded === null || a.points_awarded === undefined)
        ? 'на перевірці' : a.points_awarded + ' / ' + s.points + ' б.';
      return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e3dfed">
        <div class="flex"><b>${i + 1}. ${mark(a)}</b><span class="pill">${pts}</span></div>
        <div style="white-space:pre-wrap;margin:6px 0">${esc(s.prompt || '')}</div>
        <div class="notice" style="white-space:pre-wrap"><b>Моя відповідь:</b> ${esc(fmt(s, a.answer))}</div>
        ${a.teacher_comment ? `<div class="notice warn" style="white-space:pre-wrap"><b>Коментар викладача:</b> ${esc(a.teacher_comment)}</div>` : ''}
        ${s.explanation ? `<div class="muted small" style="white-space:pre-wrap">${esc(s.explanation)}</div>` : ''}
      </div>`;
    }).join('');
  }

  window.studentLesson = async function (lid) {
    const html = await baseStudent.apply(this, arguments);
    const marker = '<div class="card"><h2>Мої спроби</h2>';
    const i = html.indexOf(marker);
    if (i < 0) return html;

    const r = await sb.from('attempts').select('id,created_at,status,auto_score,manual_score,max_score')
      .eq('lesson_id', lid).order('created_at', { ascending: false });
    if (r.error || !r.data.length) return html;

    const testOn = !!(S.test && S.test.lid === lid); // під час тесту переглядати спроби не можна
    let rows = null, err = '';
    if (!testOn && S.viewAtt && r.data.some(t => t.id === S.viewAtt)) {
      const d = await sb.rpc('my_attempt_answers', { p_attempt: S.viewAtt });
      if (d.error) err = 'Не вдалося завантажити відповіді. Перевірте, що виконано 05_attempts.sql.';
      else rows = Array.isArray(d.data) ? d.data : [];
    }

    const list = r.data.map(t => {
      const open = !testOn && S.viewAtt === t.id;
      const graded = t.status === 'graded';
      return `<div class="row" style="display:block">
        <div class="row" style="border:0;padding:0"><span>${fmtDate(t.created_at)}</span>
          <div class="end"><span class="pill ${graded ? 'green' : 'amber'}">${+t.auto_score + +t.manual_score} / ${t.max_score}${graded ? '' : ' · на перевірці'}</span>
          ${testOn ? '' : `<button class="btn small secondary" data-act="viewatt" data-id="${t.id}">${open ? 'Сховати' : 'Переглянути'}</button>`}</div></div>
        ${open ? (err ? `<div class="notice warn" style="margin-top:10px">${esc(err)}</div>` : detail(rows || [])) : ''}
      </div>`;
    }).join('');

    return html.slice(0, i) + `${marker}${list}${testOn ? '<div class="muted small" style="margin-top:8px">Перегляд відповідей буде доступний після завершення тесту.</div>' : ''}</div>`;
  };

  A.viewatt = function (el) {
    S.viewAtt = S.viewAtt === el.dataset.id ? null : el.dataset.id;
    renderApp();
  };

  if (S.profile) renderApp();
})();
