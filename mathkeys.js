/* MathSpace · формульна клавіатура (версія 2)
   Підключення: <script src="mathkeys.js"></script> ПІСЛЯ останнього stage-файлу, перед </body>.
   Кнопка «∑» з'являється поруч із полем, у яке поставили курсор:
     · учень у тесті (уроку чи бібліотеки)  → запис, який розуміє сайт: 1/2, sqrt(4), x^2, pi
     · викладач, поле «Правильна відповідь» → такий самий запис + знак «|» для інших варіантів
     · викладач, поля «Умова», «Варіанти», «Пояснення» → формули KaTeX: $\frac{1}{2}$, $\sqrt{x}$
   Скрипт не залежить від решти коду сайту й нічого в ньому не змінює. */
(function () {
  if (window.__mathKeypad) return;
  window.__mathKeypad = true;

  /* ===== Де вмикати ===== */
  var TEST_FIELDS = 'form[data-form="attempt"] [data-q], [data-pq]';        // тести учнів
  var EDIT_FORMS = 'form[data-form*="addq"], form[data-form*="editq"]';     // редактор завдань викладача
  var LATEX_NAMES = { prompt: 1, options: 1, expl: 1 };                      // поля з формулами KaTeX
  var ANSWER_NAMES = { correct: 1 };                                         // поле правильної відповіді
  // Щоб вимкнути для якогось поля чи блоку, додайте йому атрибут data-no-math

  function modeOf(el) {
    if (el.closest(TEST_FIELDS)) return 'plain';
    if (el.closest(EDIT_FORMS)) {
      if (ANSWER_NAMES[el.name]) return 'answer';
      if (LATEX_NAMES[el.name]) return 'latex';
    }
    return null;
  }

  /* ===== Набори клавіш =====
     l — напис; t — що вставити; c — де поставити курсор усередині вставленого.
     Якщо в полі виділено текст, він іде в перші порожні дужки () або фігурні {}. */
  var K = {
    frac: { l: 'a/b', t: '/', frac: true, tip: 'Дріб: поставте «/» між чисельником і знаменником', cls: ' msk-main' },
    sqrt: { l: '√', t: 'sqrt()', c: 5, tip: 'Квадратний корінь: sqrt(…)', cls: ' msk-main' },
    cbrt: { l: '∛', t: 'cbrt()', c: 5, tip: 'Кубічний корінь: cbrt(…)', cls: ' msk-main' },
    sq:   { l: 'x²', t: '^2', tip: 'Квадрат', cls: ' msk-main' },
    pow:  { l: 'xⁿ', t: '^()', c: 2, tip: 'Степінь', cls: ' msk-main' },
    pi:   { l: 'π', t: 'pi', tip: 'Число пі', cls: ' msk-main' },
    par:  { l: '( )', t: '()', c: 1, tip: 'Дужки' },
    mul:  { l: '·', t: '*', tip: 'Множення' },
    pm:   { l: '±', t: '±', tip: 'Плюс-мінус' },
    deg:  { l: '°', t: '°', tip: 'Градус' },
    inf:  { l: '∞', t: '∞', tip: 'Нескінченність' },
    semi: { l: ';', t: '; ', tip: 'Розділювач кількох значень в одній відповіді' },
    lt:   { l: '<', t: '<' }, gt: { l: '>', t: '>' },
    le:   { l: '≤', t: '<=' }, ge: { l: '≥', t: '>=' }, ne: { l: '≠', t: '!=' },
    eq:   { l: '=', t: '=' },
    x:    { l: 'x', t: 'x' }, y: { l: 'y', t: 'y' }, n: { l: 'n', t: 'n' },
    bar:  { l: '|', t: ' | ', tip: 'Інший допустимий варіант відповіді' },
    del:  { l: '⌫', del: true, tip: 'Стерти', cls: ' msk-del' }
  };
  var PLAIN = [K.frac, K.sqrt, K.cbrt, K.sq, K.pow, K.pi,
               K.par, K.mul, K.pm, K.deg, K.inf, K.semi,
               K.lt, K.gt, K.le, K.ge, K.ne, K.eq,
               K.x, K.y, K.n, K.del];
  var ANSWER = [K.frac, K.sqrt, K.cbrt, K.sq, K.pow, K.pi,
                K.par, K.mul, K.pm, K.deg, K.inf, K.semi,
                K.lt, K.gt, K.le, K.ge, K.ne, K.eq,
                K.x, K.y, K.n, K.bar, K.del];

  var LATEX = [
    { l: 'a/b', t: '\\frac{}{}', c: 6, tip: 'Дріб', cls: ' msk-main' },
    { l: '√', t: '\\sqrt{}', c: 6, tip: 'Квадратний корінь', cls: ' msk-main' },
    { l: '∛', t: '\\sqrt[3]{}', c: 9, tip: 'Кубічний корінь', cls: ' msk-main' },
    { l: 'x²', t: '^{2}', tip: 'Квадрат', cls: ' msk-main' },
    { l: 'xⁿ', t: '^{}', c: 2, tip: 'Степінь', cls: ' msk-main' },
    { l: 'xₙ', t: '_{}', c: 2, tip: 'Індекс', cls: ' msk-main' },
    { l: 'π', t: '\\pi ' }, { l: '( )', t: '()', c: 1 },
    { l: '·', t: '\\cdot ' }, { l: '÷', t: '\\div ' },
    { l: '±', t: '\\pm ' }, { l: '°', t: '^{\\circ}' },
    { l: '∞', t: '\\infty ' }, { l: '<', t: '<' }, { l: '>', t: '>' },
    { l: '≤', t: '\\le ' }, { l: '≥', t: '\\ge ' }, { l: '≠', t: '\\ne ' },
    { l: '≈', t: '\\approx ' }, { l: '=', t: '=' },
    { l: 'x', t: 'x' }, { l: 'y', t: 'y' },
    { l: 'α', t: '\\alpha ' }, { l: 'β', t: '\\beta ' },
    { l: 'ℝ', t: '\\mathbb{R}', tip: 'Дійсні числа' }, { l: '∈', t: '\\in ' },
    { l: '∪', t: '\\cup ' }, { l: '∩', t: '\\cap ' },
    { l: 'n', t: 'n' }, K.del
  ];
  var SETS = { plain: PLAIN, answer: ANSWER, latex: LATEX };
  var HINTS = {
    plain: 'Дріб: 1/2 · корінь: sqrt(4) · число π: pi · кілька значень: через «;»',
    answer: 'Інший допустимий варіант — через «|», кілька значень в одній відповіді — через «;»',
    latex: 'Формули автоматично беруться в $…$. Щоб вийти з формули, перейдіть курсором за знак $.'
  };

  var CSS =
    '.msk-btn{position:fixed;z-index:2147483000;width:38px;height:38px;border:0;border-radius:12px;background:#7660dd;color:#fff;font:700 19px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(80,60,170,.35);display:grid;place-items:center;padding:0}' +
    '.msk-btn:hover{background:#5e49c7}' +
    '.msk-btn[hidden],.msk-panel[hidden]{display:none}' +
    '.msk-panel{position:fixed;z-index:2147483001;width:min(330px,calc(100vw - 16px));background:#fff;border:1px solid #e6e1f5;border-radius:18px;padding:10px;box-shadow:0 14px 44px rgba(50,35,120,.25);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.msk-panel.msk-dock{left:0;right:0;width:auto;border-radius:18px 18px 0 0;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}' +
    '.msk-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}' +
    '.msk-key{height:42px;border:0;border-radius:11px;background:#f0ebff;color:#4a3aa8;font:600 17px/1 system-ui,sans-serif;cursor:pointer;padding:0}' +
    '.msk-key:active{background:#d9ceff}' +
    '.msk-key.msk-main{background:#e6f0ff;color:#2f5fb3}' +
    '.msk-key.msk-del{background:#fff0f0;color:#a33f4e}' +
    '.msk-hint{margin:8px 2px 0;font-size:12px;color:#8a809d}';

  var SKIP_AUTOCOMPLETE = /email|username|password|tel|name|address|postal|cc-/i;
  var SKIP_NAME = /e-?mail|login|password|парол/i;

  var btn = null, panel = null, grid = null, hint = null;
  var field = null, curMode = '', curKeys = [], hideT = null, raf = 0;

  function eligible(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'INPUT') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t !== 'text') return false;
    } else if (tag !== 'TEXTAREA') return false;
    if (el.readOnly || el.disabled) return false;
    if (el.closest('[data-no-math]')) return false;
    if (SKIP_AUTOCOMPLETE.test(el.getAttribute('autocomplete') || '')) return false;
    if (SKIP_NAME.test((el.name || '') + ' ' + (el.id || ''))) return false;
    return modeOf(el) !== null;
  }

  function inUi(el) {
    return !!(el && el.nodeType === 1 && el.closest && el.closest('.msk-btn,.msk-panel'));
  }

  function setMode(mode) {
    if (curMode === mode) return;
    curMode = mode;
    curKeys = SETS[mode];
    grid.textContent = '';
    curKeys.forEach(function (k, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'msk-key' + (k.cls || '');
      b.dataset.i = String(i);
      b.textContent = k.l;
      if (k.tip) b.title = k.tip;
      grid.appendChild(b);
    });
    hint.textContent = HINTS[mode];
  }

  function build() {
    if (btn) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msk-btn';
    btn.textContent = '∑';
    btn.title = 'Математичні символи';
    btn.setAttribute('aria-label', 'Відкрити клавіатуру формул');
    btn.hidden = true;

    panel = document.createElement('div');
    panel.className = 'msk-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Клавіатура формул');
    grid = document.createElement('div');
    grid.className = 'msk-grid';
    hint = document.createElement('div');
    hint.className = 'msk-hint';
    panel.appendChild(grid);
    panel.appendChild(hint);

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // не забираємо фокус із поля при натисканні на нашу кнопку чи панель
    [btn, panel].forEach(function (n) {
      n.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      n.addEventListener('mousedown', function (e) { e.preventDefault(); });
    });

    btn.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      place();
      if (!panel.hidden && field && innerWidth <= 640) {
        try { field.scrollIntoView({ block: 'center' }); } catch (e) {}
      }
    });

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.msk-key');
      if (!b) return;
      var k = curKeys[Number(b.dataset.i)];
      if (!k) return;
      if (k.del) backspace(); else insert(k);
    });
  }

  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); }

  // місце для вставки виділеного тексту: перші порожні {} або ()
  function findPh(text, from) {
    var a = text.indexOf('{}', from);
    return a >= 0 ? a : text.indexOf('()', from);
  }

  function insert(def) {
    var el = field;
    if (!el || !el.isConnected) return;
    el.focus({ preventScroll: true });
    var s = el.selectionStart == null ? el.value.length : el.selectionStart;
    var e = el.selectionEnd == null ? s : el.selectionEnd;
    var sel = el.value.slice(s, e);
    var text = def.t, caret = def.c == null ? def.t.length : def.c;

    var ph = findPh(text, 0);
    if (def.frac && curMode !== 'latex') {
      if (!sel) { text = '/'; caret = 1; }
      else if (/^[\w.,]+$/.test(sel)) { text = sel + '/'; caret = text.length; }   // 1 → 1/
      else { text = '(' + sel + ')/()'; caret = text.length - 1; }                  // x+1 → (x+1)/()
    } else if (sel && ph >= 0) {
      text = text.slice(0, ph) + text.charAt(ph) + sel + text.charAt(ph + 1) + text.slice(ph + 2);
      var nx = findPh(text, ph + sel.length + 2);
      caret = nx >= 0 ? nx + 1 : text.length;
    }

    // у режимі формул KaTeX: якщо курсор не всередині $…$, обгортаємо вставку в $…$
    if (curMode === 'latex') {
      var before = el.value.slice(0, s);
      var dollars = (before.match(/(^|[^\\])\$/g) || []).length;
      if (dollars % 2 === 0) { text = '$' + text + '$'; caret += 1; }
    }

    if (el.maxLength > 0 && el.value.length - (e - s) + text.length > el.maxLength) return;
    el.setRangeText(text, s, e, 'end');
    var pos = s + caret;
    el.setSelectionRange(pos, pos);
    fire(el);
  }

  function backspace() {
    var el = field;
    if (!el || !el.isConnected) return;
    el.focus({ preventScroll: true });
    var s = el.selectionStart == null ? el.value.length : el.selectionStart;
    var e = el.selectionEnd == null ? s : el.selectionEnd;
    if (s === e) { if (s === 0) return; s -= 1; }
    el.setRangeText('', s, e, 'end');
    el.setSelectionRange(s, s);
    fire(el);
  }

  function hide() {
    if (!btn) return;
    btn.hidden = true;
    panel.hidden = true;
  }

  function place() {
    if (!btn || btn.hidden) return;
    if (!field || !field.isConnected) { hide(); return; }
    var r = field.getBoundingClientRect();
    var vv = window.visualViewport;
    var vw = innerWidth, vh = vv ? vv.height : innerHeight;

    var top = r.bottom + 6;
    var left = Math.min(Math.max(8, r.right - 40), vw - 48);
    if (top > vh - 48) top = Math.max(8, r.top - 44);
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';

    if (!panel.hidden) {
      if (vw <= 640) {
        panel.classList.add('msk-dock');
        panel.style.left = ''; panel.style.top = '';
        panel.style.bottom = (vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0) + 'px';
      } else {
        panel.classList.remove('msk-dock');
        panel.style.bottom = '';
        var w = panel.offsetWidth || 330, h = panel.offsetHeight || 200;
        var pl = Math.min(Math.max(8, r.right - w), vw - w - 8);
        var pt = top + 44;
        if (pt + h > vh - 8) pt = Math.max(8, top - h - 6);
        panel.style.left = pl + 'px';
        panel.style.top = pt + 'px';
      }
    }
  }

  function schedulePlace() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; place(); });
  }

  function scheduleHide() {
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      if (!btn) return;
      var a = document.activeElement;
      if (eligible(a) || inUi(a)) return;
      hide();
    }, 200);
  }

  document.addEventListener('focusin', function (e) {
    if (eligible(e.target)) {
      build();
      field = e.target;
      setMode(modeOf(field));
      clearTimeout(hideT);
      btn.hidden = false;
      place();
    } else if (!inUi(e.target)) {
      scheduleHide();
    }
  });
  document.addEventListener('focusout', scheduleHide);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) { panel.hidden = true; }
  });
  window.addEventListener('resize', schedulePlace);
  window.addEventListener('scroll', schedulePlace, true);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', schedulePlace);
    visualViewport.addEventListener('scroll', schedulePlace);
  }
})();
