/* MathSpace Stage 35 — formulas sized to match the surrounding text; fractions a bit larger. CSS only, no SQL.
   Load LAST (after stage34.js). To change the size, edit the two numbers marked SIZE below. */
(function () {
  'use strict';
  if (window.__ms35) return;
  window.__ms35 = true;
  const css = document.createElement('style');
  css.id = 'ms35-style';
  css.textContent = `
  :root { --ms-math: 1.12em; --ms-math-small: 1.06em; --ms-text: 1.4rem; --ms-text-small: 1.25rem; }  /* SIZE: text of tasks, options, homework */            /* SIZE: formulas (computer / phone) */
  .katex { font-size: var(--ms-math) !important; }
  .katex .mfrac { font-size: 1.22em; }                          /* SIZE: extra boost for fractions only */
  .katex-display > .katex { font-size: calc(var(--ms-math) * 1.1) !important; }
  .katex-display { margin: .6em 0; overflow-x: auto; overflow-y: hidden; }
  /* space for taller lines so fractions do not touch neighbouring lines */
  .hw-tex, .hw-sol-text, .hw-sol-q, .hw-options, [data-q] p, [data-q] .opt, .opt, .notice, .ms34-ans, .small {
    line-height: 2; }
  .hw-tex, .hw-sol-text { overflow-wrap: anywhere; }
  /* text of tasks, answer options, homework and test results (formulas follow it, they are in em) */
  [data-q] p, [data-q] .opt, .opt, .hw-tex, .hw-sol-q, .hw-sol-text, .hw-options,
  .lib-q, .lib-q .notice, .ms36-opt, .ms34-ans, .card > p[style*="font-size:1.1rem"] {
    font-size: var(--ms-text) !important; line-height: 1.9 !important; }
  .lib-q .muted.small, .ms36-tag { font-size: calc(var(--ms-text) * .75) !important; }
  @media (max-width: 560px) { :root { --ms-math: var(--ms-math-small); --ms-text: var(--ms-text-small); } }
  `;
  document.head.appendChild(css);
})();
