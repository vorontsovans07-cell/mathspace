/* MathSpace · етап 9: власниця працює як викладач — вкладка «Запрошення» і перенесення учнів до неї.
   Підключається ПІСЛЯ stage8.js. Спершу виконайте 06_owner_as_teacher.sql */
(function () {
  'use strict';

  // 1. вкладка «Запрошення» для власниці
  const baseTabs = tabs;
  window.tabs = function () {
    const t = baseTabs();
    if (S.profile && S.profile.role === 'owner' && !t.some(x => x[0] === 'invite')) {
      const i = t.findIndex(x => x[0] === 'profile');
      t.splice(i < 0 ? t.length : i, 0, ['invite', 'Запрошення', '🔗']);
    }
    return t;
  };

  // 2. у списку «Усі учні» додаємо власницю до вибору викладача
  const baseStudents = TAB.students;
  TAB.students = async function () {
    const html = await baseStudents.apply(this, arguments);
    const me = S.profile;
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) return html;
    const ppl = await getPeople();
    const owner = ppl.find(p => p.role === 'owner');
    if (!owner) return html;
    const students = ppl.filter(p => p.role === 'student');
    const parts = html.split('<select>');
    if (parts.length - 1 !== students.length) return html; // розмітка інша, ніж очікували
    const label = esc(fullName(owner)) + ' (власниця)';
    return parts.map((p, i) => i === 0 ? p :
      `<option value="${esc(owner.id)}"${students[i - 1].teacher_id === owner.id ? ' selected' : ''}>${label}</option>` + p
    ).join('<select>').replace(/<select>(<option[^>]*>[^<]*<\/option>)/g, '<select>$1');
  };

  if (S.profile) renderApp();
})();
