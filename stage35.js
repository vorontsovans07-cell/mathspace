/* MathSpace Stage 35 — formulas sized to match the surrounding text; fractions a bit larger. CSS only, no SQL.
   Load LAST (after stage34.js). To change the size, edit the two numbers marked SIZE below. */
(function () {
  'use strict';
  if (window.__ms35) return;
  window.__ms35 = true;
  const css = document.createElement('style');
  css.id = 'ms35-style';
  css.textContent = `
  :root { --ms-math: 1.12em; --ms-math-small: 1.06em; }            /* SIZE: formulas (computer / phone) */
  .katex { font-size: var(--ms-math) !important; }
  .katex .mfrac { font-size: 1.22em; }                          /* SIZE: extra boost for fractions only */
  .katex-display > .katex { font-size: calc(var(--ms-math) * 1.1) !important; }
  .katex-display { margin: .6em 0; overflow-x: auto; overflow-y: hidden; }
  /* space for taller lines so fractions do not touch neighbouring lines */
  .hw-tex, .hw-sol-text, .hw-sol-q, .hw-options, [data-q] p, [data-q] .opt, .opt, .notice, .ms34-ans, .small {
    line-height: 2; }
  .hw-tex, .hw-sol-text { overflow-wrap: anywhere; }
  @media (max-width: 560px) { :root { --ms-math: var(--ms-math-small); } }
  `;
  document.head.appendChild(css);
})();
