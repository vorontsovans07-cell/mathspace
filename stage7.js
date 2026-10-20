/* MathSpace · етап 7: гарні формули (KaTeX) + автоперетворення звичайного запису.
   Підключається ПІСЛЯ stage6.js */
(function () {
  'use strict';
  const BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';

  const lk = document.createElement('link');
  lk.rel = 'stylesheet';
  lk.href = BASE + 'katex.min.css';
  document.head.appendChild(lk);

  const st = document.createElement('style');
  st.textContent = `.katex{font-size:1.12em}
.katex-display{margin:.7em 0;overflow-x:auto;overflow-y:hidden;padding:2px 0}`;
  document.head.appendChild(st);

  function fixSqrt(s) {
    const re = /(?:(\d+)(?:th|st|nd|rd)root|sqrt|cbrt)\(/;
    let m;
    while ((m = re.exec(s))) {
      const i = m.index, open = i + m[0].length - 1;
      let d = 0, j = open;
      for (; j < s.length; j++) {
        if (s[j] === '(') d++;
        else if (s[j] === ')') { d--; if (d === 0) break; }
      }
      if (j >= s.length) break;
      const tpl = m[1] ? '\\sqrt[' + m[1] + ']{' : (m[0].indexOf('cbrt') === 0 ? '\\sqrt[3]{' : '\\sqrt{');
      s = s.slice(0, i) + tpl + s.slice(open + 1, j) + '}' + s.slice(j + 1);
    }
    return s;
  }

  const ATOM_A = '(?:\\d+(?:\\.\\d+)?)?(?:\\\\pi|\\\\sqrt(?:\\[\\d+\\])?\\{[^{}]*\\}|[a-zA-Z])?(?:\\*[a-zA-Z])?';
  const ATOM_B = '(?:\\d+(?:\\.\\d+)?)?(?:\\\\pi|\\\\sqrt(?:\\[\\d+\\])?\\{[^{}]*\\}|[a-zA-Z])?';
  const FRAC = new RegExp('(' + ATOM_A + '|\\([^()]*\\))\\/(' + ATOM_B + '|\\([^()]*\\))', 'g');

  function toLatex(s) {
    s = fixSqrt(s);
    s = s.replace(/(^|[^A-Za-z\\])pi(?![A-Za-z])/g, '$1\\pi');
    s = s.replace(/(^|[^A-Za-z\\])(arcsin|arccos|arctan|sin|cos|tan|log|ln|lg)(?![A-Za-z])/g, '$1\\$2');
    s = s.replace(/(^|[^A-Za-z\\])(arcctg|arctg|ctg|tg)(?![A-Za-z])/g, '$1\\operatorname{$2}');
    s = s.replace(/(^|[^A-Za-z\\])in\s+([ZNQR])(?![A-Za-z])/g, '$1\\in \\mathbb{$2}');
    s = s.replace(/\^\(([^()]*)\)/g, '^{$1}');
    s = s.replace(/\^(-?\d+(?:\.\d+)?|[A-Za-z])/g, '^{$1}');
    s = s.replace(FRAC, function (m, a, b) {
      if (!a || !b) return m;
      const strip = function (x) { return x.replace(/^\((.*)\)$/, '$1'); };
      return '\\frac{' + strip(a) + '}{' + strip(b) + '}';
    });
    s = s.replace(/=>/g, '\\Rightarrow ').replace(/>=/g, '\\ge ')
         .replace(/<=/g, '\\le ').replace(/!=/g, '\\ne ').replace(/\*/g, '\\cdot ');
    return s;
  }

  const RUN = /[A-Za-z0-9\\(\[\-+*\/^=<>|][A-Za-z0-9_^\/*+\-=<>()\[\]|.,;:'\s]*/g;
  const SIGNAL = /[=^\/<>]|(sqrt|cbrt)\(|\d(th|st|nd|rd)root\(|(^|[^A-Za-z])pi([^A-Za-z]|$)|(^|[^A-Za-z])(sin|cos|tg|ctg|tan|log|ln|lg|arcsin|arccos|arctg|arcctg)([^A-Za-z]|$)|\d[A-Za-z]/;
  const SKIP = 'a,button,nav,textarea,input,select,option,script,style,noscript,code,pre,.katex,.no-math,[contenteditable]';

  function convertPlain(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      const el = node.parentElement;
      if (!el || el.closest(SKIP)) return;
      const text = node.nodeValue;
      if (!text || text.indexOf('$') >= 0) return;
      const out = text.replace(RUN, function (m) {
        const mm = m.match(/^(\s*)([\s\S]*?)([\s.,;:]*)$/);
        const core = mm[2];
        if (!core || !/[A-Za-z=^]/.test(core) || !SIGNAL.test(core)) return m;
        return mm[1] + '$' + toLatex(core) + '$' + mm[3];
      });
      if (out !== text) node.nodeValue = out;
    });
  }

  const delimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false }
  ];

  let timer = null;
  const obs = new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(run, 150); });
  const watch = function () { obs.observe(document.body, { childList: true, subtree: true }); };

  function run() {
    if (!window.renderMathInElement) return;
    obs.disconnect();
    try {
      convertPlain(document.body);
      renderMathInElement(document.body, {
        delimiters: delimiters,
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
        ignoredClasses: ['no-math']
      });
    } catch (e) { console.warn('KaTeX', e); }
    watch();
  }

  function loadScript(src) {
    return new Promise(function (ok, fail) {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }

  loadScript(BASE + 'katex.min.js')
    .then(function () { return loadScript(BASE + 'contrib/auto-render.min.js'); })
    .then(run)
    .catch(function () { console.warn('Не вдалося завантажити KaTeX'); });
})();
