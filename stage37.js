/* MathSpace Stage 37 — a different motivational phrase when a teacher or a student opens the site.
   No SQL. Load LAST (after stage36.js).
   Shown once per visit (not again for 20 minutes), never the same phrase twice in a row. */
(function () {
  'use strict';
  if (window.__ms37) return;
  window.__ms37 = true;
  if (typeof S === 'undefined') { console.error('MathSpace Stage 37: S not available.'); return; }

  const GAP_MS = 20 * 60 * 1000;      // як часто показувати (хвилин * 60 * 1000)
  const SHOW_MS = 12000;              // скільки секунд висить фраза

  const STUDENT = [
    'Кожна розв’язана задача робить тебе трохи сильнішим.',
    'Помилка — це не провал, а підказка, куди дивитися далі.',
    'Малі кроки щодня дають великий результат за місяць.',
    'Сьогодні ти знаєш більше, ніж учора. Це вже перемога.',
    'Не знаєш — ще не вивчив. Саме для цього ми й тут.',
    'Математика любить терплячих. Ти вже на правильному шляху.',
    'Важка задача — це тренажер для мозку. Дай йому попрацювати.',
    'Навіть найскладніший приклад складається з простих кроків.',
    'Не порівнюй себе з іншими. Порівнюй із собою вчорашнім.',
    'Одна задача сьогодні краще, ніж десять «колись».',
    'Ти не мусиш усе розуміти одразу. Достатньо не здаватися.',
    'Правильна відповідь приходить після кількох неправильних спроб.',
    'Гарний настрій і одна розв’язана вправа — чудовий початок дня.',
    'Те, що здається складним сьогодні, завтра стане звичним.',
    'Ти здатен більше, ніж думаєш. Перевір це на наступній задачі.',
    'Кожен, хто добре рахує, колись починав із простих дробів.',
    'Зроби перший крок, а далі розв’язання підкаже саме себе.',
    'Не соромся питати. Питання — ознака розумного учня.',
    'Старанність перемагає талант, коли талант не старається.',
    'Фініш ближче, ніж здається. Ще одна вправа!',
    'Мозок, як і м’яз, росте від навантаження. Тренуймося!',
    'Сьогодні чудовий день, щоб розібратися з тим, що не виходило.',
    'Твоя наполегливість — це твоя суперсила.',
    'Не поспішай. Точність важливіша за швидкість.',
    'Кожне «я зрозумів» починалося з «я не розумію».',
    'Перевір себе: чи можеш пояснити задачу простими словами? Тоді ти її знаєш.',
    'Маленька перемога сьогодні — велика впевненість на контрольній.',
    'Ти молодець, що знову тут. Це вже половина успіху.',
    'Відпочивай, але не забувай про щоденну практику.',
    'Думай, пробуй, помиляйся, виправляй. Так працює математика.',
    'Складна задача — це просто кілька простих, що чекають, поки їх розділять.',
    'Вір у себе: ти вже розв’язав багато такого, що колись здавалося неможливим.',
    'Цифри слухняні, коли їх добре знаєш. Подружись із ними.',
    'Кожна виправлена помилка — це крок до відмінної оцінки.',
    'Нехай сьогодні буде день, коли ти вперше скажеш: «Та це ж просто!»'
  ];
  const TEACHER = [
    'Ваша праця змінює майбутнє. Дякуємо, що робите це щодня.',
    'Кожне «зрозумів!» учня — результат вашого терпіння.',
    'Гарний урок починається з гарного настрою. Успішного дня!',
    'Ви не просто пояснюєте математику, ви навчаєте думати.',
    'Маленькі кроки учнів — це великі перемоги вчителя.',
    'Навіть найскладніша тема стає зрозумілою завдяки вашим поясненням.',
    'Вчити — значить запалювати, а не наповнювати. Ви запалюєте.',
    'Сьогодні хтось із ваших учнів уперше полюбить математику.',
    'Ваша терплячість — це найкраща підтримка для учня, який сумнівається.',
    'Дякуємо за кожну перевірену роботу й кожне добре слово учню.',
    'Найкращий вчитель — той, хто вірить в учня, коли той сам не вірить.',
    'Нехай сьогоднішні уроки пройдуть легко, а учні будуть уважними.',
    'Кожен учень має свій темп. Ви допомагаєте знайти його.',
    'Вчитель сіє зерно, а результат проявляється згодом. Продовжуйте!',
    'Ваші пояснення залишаються в пам’яті довше, ніж ви думаєте.',
    'Відпочинок теж частина роботи. Не забудьте про себе сьогодні.',
    'Хороший день для вдалих пояснень і приємних «ага!» від учнів.',
    'Дякуємо, що робите математику зрозумілою та неодмінно цікавою.',
    'Кожна ваша порада — це цеглинка в фундаменті знань учня.',
    'Сьогодні ви допоможете комусь побачити логіку там, де була плутанина.',
    'Робота вчителя непомітна щодня, але видна в житті учнів назавжди.',
    'Нехай кожен урок принесе радість вам і користь вашим учням.',
    'Ви тримаєте планку, до якої тягнуться учні. Це цінно.',
    'Навіть коли день складний, ваші учні вдячні вам більше, ніж кажуть.',
    'Гарного дня! Нехай усі домашні роботи будуть охайними, а відповіді правильними.',
    'Терпіння, доброта й математика: ваш чудовий рецепт.',
    'Вчитель, який вчиться разом з учнями, ніколи не старіє.',
    'Ваш внесок у знання дітей неможливо виміряти балами.',
    'Нехай сьогодні складне пояснення вийде з першого разу.',
    'Дякуємо, що ви поруч із учнями на їхньому шляху до знань.'
  ];

  const css = document.createElement('style');
  css.textContent = `
  .ms37-card{position:fixed;z-index:9998;top:16px;left:50%;transform:translateX(-50%) translateY(-12px);opacity:0;
    width:min(560px,calc(100vw - 24px));box-sizing:border-box;background:#fff;border:1px solid #ddd3f7;border-radius:18px;
    box-shadow:0 14px 48px rgba(60,40,140,.22);padding:16px 46px 16px 18px;color:#29223a;
    transition:opacity .45s ease,transform .45s ease;cursor:pointer}
  .ms37-card.ms37-in{opacity:1;transform:translateX(-50%) translateY(0)}
  .ms37-card b{display:block;color:#5941b0;font-size:15px;margin-bottom:4px}
  .ms37-card span{display:block;font-size:17px;line-height:1.55}
  .ms37-x{position:absolute;top:8px;right:10px;border:0;background:none;font-size:22px;line-height:1;color:#8a809d;cursor:pointer;padding:4px 8px}
  @media (prefers-reduced-motion:reduce){.ms37-card{transition:none}}`;
  document.head.appendChild(css);

  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Добрий день' : 'Добрий вечір';
  }
  function pick(list, key) {
    let recent = [];
    try { recent = JSON.parse(store.get(key) || '[]'); } catch (e) { recent = []; }
    const keep = Math.min(5, list.length - 1);
    const pool = list.map((_, i) => i).filter(i => !recent.slice(-keep).includes(i));
    const i = pool[Math.floor(Math.random() * pool.length)];
    recent.push(i);
    store.set(key, JSON.stringify(recent.slice(-10)));
    return list[i];
  }

  let busy = false;
  function show() {
    if (busy || !S.session || !S.profile || S.recovery) return;
    const uid = S.session.user.id, key = 'ms37_ts_' + uid;
    const last = Number(store.get(key) || 0);
    if (Date.now() - last < GAP_MS) return;
    busy = true;
    store.set(key, String(Date.now()));
    const student = S.profile.role === 'student';
    const phrase = pick(student ? STUDENT : TEACHER, 'ms37_recent_' + (student ? 's' : 't'));
    const name = String(S.profile.first_name || '').trim();
    const card = document.createElement('div');
    card.className = 'ms37-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    const head = document.createElement('b');
    head.textContent = '✨ ' + greeting() + (name ? ', ' + name : '') + '!';
    const text = document.createElement('span');
    text.textContent = phrase;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'ms37-x'; x.setAttribute('aria-label', 'Закрити'); x.textContent = '×';
    card.append(head, text, x);
    document.body.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('ms37-in')));
    const close = () => {
      card.classList.remove('ms37-in');
      setTimeout(() => { card.remove(); busy = false; }, 500);
    };
    card.addEventListener('click', close);
    setTimeout(close, SHOW_MS);
  }

  document.addEventListener('ms:rendered', () => setTimeout(show, 600));
  setTimeout(show, 2000);
})();
