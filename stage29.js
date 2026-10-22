/* MathSpace Stage 29 — delete a library test directly from the library list.
   Lesson library deletion is already provided by stage18.js (A.ltdelete).
   Load after all other stage scripts.
*/
(function () {
  'use strict';
  if (typeof TAB === 'undefined' || typeof TAB.library !== 'function') {
    console.warn('MathSpace Stage 29: Бібліотеку тестів не знайдено.');
    return;
  }

  const original = TAB.library;
  TAB.library = async function () {
    const html = await original.apply(this, arguments);
    // No modifications to detail pages or student views.
    if (!S.profile || S.profile.role === 'student' || location.hash !== '#/t/library') return html;
    return html.replace(
      /(<a class="btn small" href="#\/t\/library\/([0-9a-fA-F-]{36})">Відкрити<\/a>)/g,
      '$1 <button type="button" class="btn small danger" data-act="libdel" data-id="$2" title="Видалити тест із бібліотеки">Видалити</button>'
    );
  };
  // Existing stage14.js A.libdel already asks for confirmation, performs deletion,
  // and returns to the library. No broad grants or new SQL policies are needed.
})();
