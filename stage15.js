/* MathSpace · етап 15: (1) кнопка «Видалити» для презентації й конспекту уроку;
   (2) створення уроку лише після натискання «+» з вибором: створити новий або перенести існуючий від іншого учня.
   Підключається ПІСЛЯ stage14.js. SQL не потрібен. */
(function () {
  'use strict';
  const BUCKET = 'lessons';

  const css = document.createElement('style');
  css.textContent = `#lm-ov{position:fixed;inset:0;z-index:60;background:rgba(20,15,40,.5);display:flex;align-items:center;justify-content:center;padding:12px}
.lm-modal{background:#fff;border-radius:16px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:20px}
.lm-modal h3{margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}
.lm-x{border:0;background:none;font-size:26px;cursor:pointer;line-height:1}
.lm-choice{display:grid;gap:10px;margin-top:14px}`;
  document.head.appendChild(css);

  function closeModal() { const o = document.getElementById('lm-ov'); if (o) o.remove(); }
  function modal(html) {
    closeModal();
    const o = document.createElement('div');
    o.id = 'lm-ov';
    o.innerHTML = `<div class="lm-modal">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o || (e.target.closest && e.target.closest('[data-lm-close]'))) closeModal(); });
    document.body.appendChild(o);
    return o.firstChild;
  }

  /* =============== 1. Видалення презентації / конспекту =============== */
  const baseLesson = staffLesson;
  window.staffLesson = async function (sid, lid) {
    let html = await baseLesson.apply(this, arguments);
    if (typeof html !== 'string') return html;
    for (const [label, kind] of [['Презентація', 'presentation'], ['Конспект', 'notes']]) {
      const a = html.indexOf(`<span><b>${label}:</b>`);
      if (a < 0) continue;
      const e = html.indexOf('</a></div>', a);
      if (e < 0) continue;
      html = html.slice(0, e + 4)
        + `<button type="button" class="btn small danger" data-act="delmat" data-kind="${kind}" data-lid="${esc(lid)}">Видалити</button>`
        + html.slice(e + 4);
    }
    return html;
  };

  A.delmat = async function (el) {
    const notes = el.dataset.kind === 'notes', lid = el.dataset.lid;
    const cols = notes ? ['notes_path', 'notes_name'] : ['presentation_path', 'presentation_name'];
    if (!window.confirm('Видалити ' + (notes ? 'конспект' : 'презентацію') + ' з цього уроку?')) return;
    const r = await sb.from('lessons').select(cols[0]).eq('id', lid).single();
    must(r);
    const path = r.data[cols[0]];
    const { error } = await sb.from('lessons').update({ [cols[0]]: null, [cols[1]]: null }).eq('id', lid);
    if (error) throw error;
    if (path) await sb.storage.from(BUCKET).remove([path]);
    toast('Файл видалено');
    renderApp();
  };

  /* =============== 2. Кнопка «+» замість форми нового уроку =============== */
  const baseLessons = staffLessons;
  window.staffLessons = async function (sid) {
    const html = await baseLessons.apply(this, arguments);
    if (typeof html !== 'string') return html;
    const a = html.indexOf('<div class="card"><h2>Новий урок для:');
    if (a < 0) return html;
    const END = '</form></div>', e = html.indexOf(END, a);
    if (e < 0) return html;
    const plus = `<div class="card"><div class="flex"><button type="button" class="btn" data-act="lessonplus" data-sid="${esc(sid)}" aria-label="Додати урок" style="font-size:1.5rem;line-height:1;padding:8px 20px">+</button>
      <span class="muted">Додати урок: створити новий або перенести існуючий від іншого учня</span></div></div>`;
    return html.slice(0, a) + plus + html.slice(e + END.length);
  };

  A.lessonplus = async function (el) {
    const sid = el.dataset.sid;
    const ppl = await getPeople();
    const me = ppl.find(p => p.id === sid);
    stepChoose(sid, me ? fullName(me) : '', ppl);
  };

  function stepChoose(sid, name, ppl) {
    const m = modal(`<h3>Додати урок <button class="lm-x" data-lm-close aria-label="Закрити">×</button></h3>
      <p class="muted">Учень: <b>${esc(name)}</b></p>
      <div class="lm-choice"><button class="btn" data-lm-new>Створити новий урок</button>
      <button class="btn secondary" data-lm-move>Перенести існуючий від іншого учня</button></div>`);
    m.querySelector('[data-lm-new]').onclick = () => stepNew(sid, name, ppl);
    m.querySelector('[data-lm-move]').onclick = () => stepMove(sid, name, ppl);
  }

  function stepNew(sid, name, ppl) {
    const m = modal(`<h3>Новий урок <button class="lm-x" data-lm-close aria-label="Закрити">×</button></h3>
      <p class="muted">Учень: <b>${esc(name)}</b></p>
      <div class="field"><label>Назва</label><input id="lm-title" maxlength="200"></div>
      <div class="field"><label>Опис або тема</label><textarea id="lm-desc" rows="3" maxlength="5000"></textarea></div>
      <div class="flex"><button class="btn" data-lm-go>Створити чернетку</button><button class="btn secondary" data-lm-back>Назад</button></div>`);
    m.querySelector('[data-lm-back]').onclick = () => stepChoose(sid, name, ppl);
    m.querySelector('[data-lm-go]').onclick = async function () {
      const title = m.querySelector('#lm-title').value.trim();
      if (!title) return toast('Вкажіть назву', true);
      this.disabled = true;
      const { data, error } = await sb.from('lessons')
        .insert({ student_id: sid, title, description: m.querySelector('#lm-desc').value.trim() }).select('id').single();
      if (error) { this.disabled = false; return toast(error.message, true); }
      closeModal();
      location.hash = `#/t/lessons/${sid}/${data.id}`;
    };
  }

  function stepMove(sid, name, ppl) {
    const others = ppl.filter(p => p.role === 'student' && p.id !== sid);
    if (!others.length) {
      const m = modal(`<h3>Перенести урок <button class="lm-x" data-lm-close aria-label="Закрити">×</button></h3>
        <p>Інших учнів поки немає.</p><button class="btn secondary" data-lm-back>Назад</button>`);
      m.querySelector('[data-lm-back]').onclick = () => stepChoose(sid, name, ppl);
      return;
    }
    const m = modal(`<h3>Перенести урок <button class="lm-x" data-lm-close aria-label="Закрити">×</button></h3>
      <p class="muted">Для учня: <b>${esc(name)}</b></p>
      <div class="field"><label>Від якого учня</label><select id="lm-src"><option value="">— оберіть —</option>${others.map(s => `<option value="${esc(s.id)}">${esc(fullName(s))}</option>`).join('')}</select></div>
      <div class="field" id="lm-lw" hidden><label>Урок</label><select id="lm-les"></select></div>
      <p class="muted small">Переноситься назва, опис, презентація, конспект і всі завдання з правильними відповідями. Спроби й результати попереднього учня не переносяться. Новий урок буде чернеткою.</p>
      <div class="flex"><button class="btn" data-lm-copy disabled>Скопіювати (лишити в учня)</button>
      <button class="btn danger" data-lm-mv disabled>Перенести (прибрати в учня)</button>
      <button class="btn secondary" data-lm-back>Назад</button></div>`);
    const $ = s => m.querySelector(s), copy = $('[data-lm-copy]'), mv = $('[data-lm-mv]');
    $('[data-lm-back]').onclick = () => stepChoose(sid, name, ppl);
    let lessons = [];
    $('#lm-src').onchange = async function () {
      copy.disabled = mv.disabled = true; $('#lm-lw').hidden = true;
      if (!this.value) return;
      const r = await sb.from('lessons').select('id,title,status,lesson_no,created_at').eq('student_id', this.value).order('created_at', { ascending: false });
      if (r.error) return toast(r.error.message, true);
      lessons = r.data;
      if (!lessons.length) { toast('У цього учня ще немає уроків', true); return; }
      $('#lm-les').innerHTML = lessons.map(l => `<option value="${esc(l.id)}">${l.lesson_no ? '№' + l.lesson_no + '. ' : ''}${esc(l.title)}${l.status === 'published' ? '' : ' (чернетка)'}</option>`).join('');
      $('#lm-lw').hidden = false; copy.disabled = mv.disabled = false;
    };
    const run = async del => {
      const lid = $('#lm-les').value, l = lessons.find(x => x.id === lid);
      if (!lid || !l) return;
      if (del && !window.confirm('Урок «' + l.title + '» буде ВИДАЛЕНО в попереднього учня разом із його спробами й результатами. Продовжити?')) return;
      copy.disabled = mv.disabled = true; copy.textContent = 'Працюємо…';
      try {
        const res = await copyLesson(lid, sid);
        let extra = '';
        if (del) {
          const d = await sb.from('lessons').delete().eq('id', lid);
          if (d.error) extra = ' Оригінал видалити не вдалося (якщо урок опубліковано, спершу поверніть його в чернетку).';
          else if (res.srcFiles.length) await sb.storage.from(BUCKET).remove(res.srcFiles);
        }
        closeModal();
        toast((res.warns.length ? 'Урок скопійовано, але не вдалося скопіювати: ' + res.warns.join(', ') + '.' : (del && !extra ? 'Урок перенесено' : 'Урок скопійовано')) + extra, !!(res.warns.length || extra));
        location.hash = `#/t/lessons/${sid}/${res.id}`;
      } catch (e) {
        copy.disabled = mv.disabled = false; copy.textContent = 'Скопіювати (лишити в учня)';
        toast(e.message || String(e), true);
      }
    };
    copy.onclick = () => run(false);
    mv.onclick = () => run(true);
  }

  async function copyLesson(srcId, dstSid) {
    const l = await sb.from('lessons').select('*').eq('id', srcId).single(); must(l);
    const q = await sb.from('questions').select('*').eq('lesson_id', srcId).order('sort_order'); must(q);
    const ids = q.data.map(x => x.id);
    const k = ids.length ? await sb.from('question_keys').select('*').in('question_id', ids) : { data: [] }; must(k);
    const key = Object.fromEntries(k.data.map(x => [x.question_id, x.correct]));
    const ins = await sb.from('lessons').insert({ student_id: dstSid, title: l.data.title, description: l.data.description || '' }).select('id').single();
    must(ins);
    const nid = ins.data.id, warns = [], srcFiles = [];
    const ext = p => (String(p).match(/\.[a-z0-9]{1,5}$/i) || [''])[0];
    try {
      if (l.data.time_limit_minutes) {
        const u = await sb.from('lessons').update({ time_limit_minutes: l.data.time_limit_minutes }).eq('id', nid);
        if (u.error) warns.push('ліміт часу');
      }
      const upd = {};
      for (const [pk, nk, tag, label] of [['presentation_path', 'presentation_name', 'presentation', 'презентацію'], ['notes_path', 'notes_name', 'notes', 'конспект']]) {
        const src = l.data[pk]; if (!src) continue;
        const dst = `${dstSid}/${nid}/${tag}-${Date.now()}${ext(src)}`;
        const c = await sb.storage.from(BUCKET).copy(src, dst);
        if (c.error) { warns.push(label); continue; }
        upd[pk] = dst; upd[nk] = l.data[nk]; srcFiles.push(src);
      }
      if (Object.keys(upd).length) { const u = await sb.from('lessons').update(upd).eq('id', nid); if (u.error) throw u.error; }

      for (const x of q.data) {
        const { error } = await sb.rpc('save_question', {
          p_lesson: nid, p_id: null, p_type: x.qtype, p_prompt: x.prompt, p_options: x.options,
          p_correct: key[x.id] === undefined ? null : key[x.id], p_points: Number(x.points), p_explanation: x.explanation || '' });
        if (error) throw error;
      }
      const withImg = q.data.map((x, i) => [x, i]).filter(([x]) => x.image_path);
      if (withImg.length) {
        const nq = await sb.from('questions').select('id').eq('lesson_id', nid).order('sort_order'); must(nq);
        for (const [x, i] of withImg) {
          const nqid = nq.data[i] && nq.data[i].id; if (!nqid) continue;
          const dst = `${dstSid}/${nid}/q-${Date.now()}-${i}${ext(x.image_path)}`;
          const c = await sb.storage.from(BUCKET).copy(x.image_path, dst);
          if (c.error) { warns.push('малюнок до завдання ' + (i + 1)); continue; }
          const r = await sb.rpc('set_question_image', { p_question: nqid, p_path: dst });
          if (r.error) { await sb.storage.from(BUCKET).remove([dst]); warns.push('малюнок до завдання ' + (i + 1)); }
          else srcFiles.push(x.image_path);
        }
      }
    } catch (e) {
      await sb.from('lessons').delete().eq('id', nid); // відкат, щоб не лишати наполовину створений урок
      throw e;
    }
    return { id: nid, warns, srcFiles };
  }

  if (S.profile) renderApp();
})();
