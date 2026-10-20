/* MathSpace · етап 11: (1) індивідуальний водяний знак унизу файлів, які завантажує учень;
   (2) фото прямо у формі створення завдання. Підключається ПІСЛЯ stage10.js. */
(function () {
  'use strict';
  const BUCKET = 'lessons';

  /* =============== 1. Фото при створенні завдання =============== */
  const photoField = () => `<div class="field"><label>Фото до завдання (необов’язково: JPG, PNG або WEBP)</label><input type="file" name="qphoto" accept="image/jpeg,image/png,image/webp"></div>`;

  const baseStaff = staffLesson;
  window.staffLesson = async function () {
    let html = await baseStaff.apply(this, arguments);
    if (typeof html !== 'string') return html;
    // ручна форма «Додати завдання»
    html = html.replace('<button class="btn">Додати завдання</button>', m => photoField() + m);
    // завдання, знайдені ШІ
    html = html.split('<div class="flex"><button class="btn small">Додати в тест</button>')
      .join(photoField() + '<div class="flex"><button class="btn small">Додати в тест</button>');
    return html;
  };

  async function questionIds(lid) {
    const r = await sb.from('questions').select('id').eq('lesson_id', lid);
    if (r.error) throw r.error;
    return r.data.map(x => x.id);
  }

  async function attachPhoto(file, sid, lid, qid) {
    const blob = await resizeToJpeg(file, 1600);
    const path = `${sid}/${lid}/q-${Date.now()}.jpg`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const { error } = await sb.rpc('set_question_image', { p_question: qid, p_path: path });
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
  }

  const baseAdd = F.addq;
  F.addq = async function (f) {
    const inp = f.querySelector('input[name="qphoto"]');
    const file = inp && inp.files && inp.files[0];
    if (!file) return baseAdd.apply(this, arguments);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Фото має бути JPG, PNG або WEBP');
    if (file.size > 15 * 1024 * 1024) throw new Error('Фото більше за 15 МБ');
    const lid = f.dataset.lid, sid = rt()[3];
    const before = await questionIds(lid);
    await baseAdd.apply(this, arguments);               // зберігає завдання й перемальовує сторінку
    const after = await questionIds(lid);
    const qid = after.find(id => !before.includes(id));
    if (!qid) { toast('Завдання додано, але фото не вдалося прикріпити. Додайте його кнопкою «Додати малюнок».', true); return; }
    try {
      await attachPhoto(file, sid, lid, qid);
      toast('Завдання додано разом із фото');
    } catch (e) {
      toast('Завдання додано, але фото не збережено: ' + (e.message || e), true);
    }
    renderApp();
  };

  /* =============== 2. Водяний знак при завантаженні файлів =============== */
  const loaded = {};
  const loadScript = src => loaded[src] || (loaded[src] = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Не вдалося завантажити бібліотеку для обробки файлу'));
    document.head.appendChild(s);
  }));
  const PDFLIB = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

  function stampText() {
    const p = S.profile;
    const name = typeof fullName === 'function' ? fullName(p) : (p.first_name + ' ' + (p.last_name || ''));
    const d = new Date().toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `${name.trim()} · ${p.email} · ${d} · ID ${String(p.id).slice(0, 8)}`;
  }
  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function fitText(ctx, text, maxW, size) {
    let s = size;
    ctx.font = `600 ${s}px "Noto Sans", Arial, sans-serif`;
    while (ctx.measureText(text).width > maxW && s > 8) { s -= 1; ctx.font = `600 ${s}px "Noto Sans", Arial, sans-serif`; }
  }
  function drawStamp(ctx, text, cx, cy, maxW, size) {
    fitText(ctx, text, maxW, size);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(text, cx, cy);
    ctx.fillStyle = 'rgba(70,60,95,0.85)'; ctx.fillText(text, cx, cy);
  }
  const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));

  async function stampPdf(buf, text) {
    await loadScript(PDFLIB);
    const pdf = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
    const W = 1800, H = 60, c = document.createElement('canvas');
    c.width = W; c.height = H;
    drawStamp(c.getContext('2d'), text, W / 2, H / 2, W - 40, 30);
    const png = await pdf.embedPng(await (await toBlob(c, 'image/png')).arrayBuffer());
    for (const page of pdf.getPages()) {
      const { width } = page.getSize();
      const w = width * 0.92, h = w * H / W;
      page.drawImage(png, { x: (width - w) / 2, y: 6, width: w, height: h });
    }
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }

  async function stampImage(buf, ext, text) {
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';
    const url = URL.createObjectURL(new Blob([buf]));
    try {
      const im = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('Не вдалося прочитати зображення')); i.src = url; });
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const band = Math.max(40, Math.round(c.height * 0.05));
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, c.height - band, c.width, band);
      drawStamp(ctx, text, c.width / 2, c.height - band / 2, c.width * 0.96, Math.round(band * 0.5));
      return await toBlob(c, type, 0.92);
    } finally { URL.revokeObjectURL(url); }
  }

  async function stampPptx(buf, text) {
    await loadScript(JSZIP);
    const zip = await JSZip.loadAsync(buf);
    const pres = zip.file('ppt/presentation.xml');
    const sz = pres ? (await pres.async('string')).match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/) : null;
    const cx = sz ? +sz[1] : 9144000, cy = sz ? +sz[2] : 6858000, h = 340000;
    const sp = `<p:sp><p:nvSpPr><p:cNvPr id="900001" name="Watermark"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="${cy - h - 20000}"/><a:ext cx="${cx}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="uk-UA" sz="1000" b="1"><a:solidFill><a:srgbClr val="5A5070"><a:alpha val="75000"/></a:srgbClr></a:solidFill></a:rPr><a:t>${xmlEsc(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
    const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    if (!slides.length) throw new Error('У презентації не знайдено слайдів');
    for (const n of slides) {
      const xml = await zip.file(n).async('string');
      if (xml.indexOf('</p:spTree>') < 0) throw new Error('Невідома структура слайда');
      zip.file(n, xml.replace('</p:spTree>', () => sp + '</p:spTree>'));
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  async function stampDocx(buf, text) {
    await loadScript(JSZIP);
    const zip = await JSZip.loadAsync(buf);
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('Невідома структура документа');
    const xml = await f.async('string');
    const par = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="5A5070"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
    let i = xml.lastIndexOf('<w:sectPr');
    if (i < 0) i = xml.lastIndexOf('</w:body>');
    if (i < 0) throw new Error('Невідома структура документа');
    zip.file('word/document.xml', xml.slice(0, i) + par + xml.slice(i));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  async function deliver(href, shownName) {
    const ext = ((new URL(href)).pathname.match(/\.([a-z0-9]{2,5})$/i) || [, ''])[1].toLowerCase();
    const text = stampText();
    const resp = await fetch(href);
    if (!resp.ok) throw new Error('Не вдалося отримати файл');
    const buf = await resp.arrayBuffer();
    let blob;
    if (ext === 'pdf') blob = await stampPdf(buf, text);
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) blob = await stampImage(buf, ext === 'png' ? 'png' : 'jpg', text);
    else if (ext === 'pptx') blob = await stampPptx(buf, text);
    else if (ext === 'docx') blob = await stampDocx(buf, text);
    else throw new Error('Цей формат не можна позначити водяним знаком. Попросіть викладача завантажити файл у PDF.');
    const outExt = ['jpg', 'jpeg', 'webp'].includes(ext) ? 'jpg' : ext;
    const base = (shownName || 'material').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    const p = S.profile, who = String(p.last_name || p.first_name || '').replace(/[\\/:*?"<>|\s]+/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${base}_${who}.${outExt}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  document.addEventListener('click', async ev => {
    const a = ev.target.closest && ev.target.closest('a[href*="/object/sign/lessons/"]');
    if (!a || !S.profile || S.profile.role !== 'student') return;
    ev.preventDefault(); ev.stopPropagation();
    if (a.dataset.busy) return;
    a.dataset.busy = '1';
    const old = a.textContent; a.textContent = 'Готуємо файл…';
    const row = a.closest('.row'), span = row && row.querySelector('span');
    const shown = span ? span.textContent.replace(/^[^:]*:\s*/, '').trim() : '';
    try { await deliver(a.href, shown); }
    catch (e) { toast(e.message || 'Не вдалося підготувати файл', true); }
    finally { a.textContent = old; delete a.dataset.busy; }
  }, true);

  if (S.profile) renderApp();
})();
