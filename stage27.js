
/* MathSpace Stage 27 — teacher homework review queue + mobile bottom-nav fix.
   Add <script src="stage27.js"></script> after stage26.js in index.html. */
(function () {
'use strict';

if (typeof tabs !== 'function' || typeof TAB === 'undefined') {
  console.error('MathSpace Stage 27: tabs/TAB not available. Load this file after the main app scripts.');
  return;
}

/* Add a separate review queue to teacher/staff navigation. Use letters only because curTab()
   currently parses route names with /([a-z]+)/. */
const msOriginalTabs = tabs;
tabs = function () {
  const items = msOriginalTabs.apply(this, arguments);
  if (S.profile && ['teacher', 'admin', 'owner'].includes(S.profile.role)
      && !items.some(item => item[0] === 'homeworkreview')) {
    items.push(['homeworkreview', 'ДЗ на перевірку', '📝']);
  }
  return items;
};

/* On phones, the bottom navigation remains fixed at the bottom but scrolls horizontally.
   Each item has a minimum width, so labels do not collapse or disappear. */
const navCss = document.createElement('style');
navCss.textContent = `
@media (max-width: 860px) {
  .bottom {
    display: flex !important;
    justify-content: flex-start !important;
    gap: 4px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    scrollbar-width: none;
    padding-left: 8px !important;
    padding-right: 8px !important;
  }
  .bottom::-webkit-scrollbar { display: none; }
  .bottom .nav {
    flex: 0 0 76px !important;
    width: 76px;
    min-width: 76px;
    max-width: 90px;
    white-space: normal;
    overflow: visible;
    justify-content: center;
  }
  .bottom .nav > span:last-child {
    display: block;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: center;
    line-height: 1.15;
  }
}
`;
document.head.appendChild(navCss);

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));

const queueState = { byKey: new Map() };
const queueKey = (lessonId, studentId) => `${lessonId}:${studentId}`;

async function getSubmissions() {
  let result = await sb.from('homework_submissions')
    .select('lesson_id,student_id,image_path,image_paths,submitted_at,teacher_feedback,reviewed_at')
    .is('reviewed_at', null)
    .order('submitted_at', { ascending: false });

  // Support projects where the multi-photo SQL migration has not been applied yet.
  if (result.error && /image_paths|column .* does not exist/i.test(result.error.message || '')) {
    result = await sb.from('homework_submissions')
      .select('lesson_id,student_id,image_path,submitted_at,teacher_feedback,reviewed_at')
      .is('reviewed_at', null)
      .order('submitted_at', { ascending: false });
  }
  if (result.error) throw result.error;
  return result.data || [];
}

async function signedPhotoLinks(submission) {
  let paths = Array.isArray(submission.image_paths) ? submission.image_paths.filter(Boolean) : [];
  if (!paths.length && submission.image_path) paths = [submission.image_path];
  const links = [];
  if (paths.length) {
    const { data } = await sb.storage.from('homework-photos').createSignedUrls(paths, 1800); // один запит замість N
    const byPath = new Map((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
    paths.forEach((p, i) => {
      const u = byPath.get(p);
      if (u) links.push(`<a class="btn small secondary" href="${esc(u)}" target="_blank" rel="noopener">Фото ${i + 1}</a>`);
    });
  }
  return links.length
    ? `<div class="ms-review-photos" aria-label="Фото виконаної роботи">${links.join('')}</div>`
    : `<p class="muted small">Посилання на фото недоступні. Перевірте сховище homework-photos.</p>`;
}

TAB.homeworkreview = async function () {
  const hostRole = S.profile?.role;
  if (!['teacher', 'admin', 'owner'].includes(hostRole)) {
    return '<div class="card">Ця вкладка доступна викладачам та адміністрації.</div>';
  }

  const [peopleRes, lessonsRes, submissions] = await Promise.all([
    sb.from('profiles').select('id,first_name,last_name,role,teacher_id'),
    sb.from('lessons').select('id,title,student_id'),
    getSubmissions()
  ]);
  if (peopleRes.error) throw peopleRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const people = peopleRes.data || [];
  const lessons = lessonsRes.data || [];
  const myStudentIds = new Set(
    people.filter(p => p.role === 'student' &&
      (hostRole !== 'teacher' || p.teacher_id === S.profile.id)).map(p => String(p.id))
  );
  const lessonById = new Map(lessons.map(lesson => [String(lesson.id), lesson]));
  const personById = new Map(people.map(person => [String(person.id), person]));
  const visible = submissions.filter(sub => {
    const lesson = lessonById.get(String(sub.lesson_id));
    if (!lesson) return false;
    return hostRole !== 'teacher' || myStudentIds.has(String(sub.student_id));
  });

  queueState.byKey.clear();
  visible.forEach(sub => queueState.byKey.set(queueKey(sub.lesson_id, sub.student_id), sub));

  if (!visible.length) {
    return `<div class="card">
      <h2>ДЗ на перевірку</h2>
      <div class="empty">Усі домашні завдання перевірені. Нових робіт поки немає. 🎉</div>
    </div>`;
  }

  const cards = [];
  for (const sub of visible) {
    const lesson = lessonById.get(String(sub.lesson_id));
    const person = personById.get(String(sub.student_id));
    const studentName = person
      ? [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Учень'
      : 'Учень';
    const photos = await signedPhotoLinks(sub);
    cards.push(`<article class="card ms-review-card" data-queue-card="${esc(queueKey(sub.lesson_id, sub.student_id))}">
      <div class="eyebrow">Потрібна перевірка</div>
      <h2>${esc(lesson?.title || 'Домашнє завдання')}</h2>
      <p><b>Учень:</b> ${esc(studentName)}</p>
      <p class="muted small">Надіслано: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('uk-UA') : 'Дата невідома'}</p>
      <div><b>Фото виконаної роботи</b>${photos}</div>
      <div class="field">
        <label>Коментар учню (необов’язково)</label>
        <textarea name="ms-review-feedback" rows="2" maxlength="3000" placeholder="Наприклад, що потрібно виправити…">${esc(sub.teacher_feedback || '')}</textarea>
      </div>
      <button class="btn" type="button" data-act="msHomeworkMarkReviewed"
        data-lid="${esc(sub.lesson_id)}" data-student="${esc(sub.student_id)}">
        ✓ Позначити перевіреним
      </button>
    </article>`);
  }
  return `<div class="ms-review-list"><div class="card"><h2>ДЗ на перевірку</h2>
    <p class="muted">Неперевірених робіт: <b>${visible.length}</b>. Після натискання «Позначити перевіреним» робота зникне з цього списку.</p>
    </div>${cards.join('')}</div>`;
};

if (typeof A !== 'undefined') {
  A.msHomeworkMarkReviewed = async function (button) {
    const card = button.closest('[data-queue-card]');
    const lessonId = button.dataset.lid;
    const studentId = button.dataset.student;
    if (!lessonId || !studentId) throw new Error('Не вдалося визначити домашнє завдання.');
    const key = queueKey(lessonId, studentId);
    const sub = queueState.byKey.get(key);
    if (!sub) throw new Error('Роботу вже оновлено. Оновіть список.');

    const input = card?.querySelector('[name="ms-review-feedback"]');
    const typed = String(input?.value || '').trim();
    const oldFeedback = String(sub.teacher_feedback || '');
    // якщо поле є на сторінці, воно головне: порожнє значення очищає старий коментар
    const feedback = input ? typed : oldFeedback;

    button.disabled = true;
    try {
      const { error } = await sb.rpc('review_homework', {
        p_lesson: lessonId,
        p_student: studentId,
        p_feedback: feedback
      });
      if (error) throw error;
      toast('ДЗ позначено як перевірене');
      renderApp();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };
}

const reviewCss = document.createElement('style');
reviewCss.textContent = `
.ms-review-list { display:block; }
.ms-review-card h2 { margin-top:6px; }
.ms-review-photos { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 14px; }
.ms-review-card .field { margin-top:12px; }
.ms-review-card [data-act="msHomeworkMarkReviewed"] { margin-top:4px; }
`;
document.head.appendChild(reviewCss);
})();
