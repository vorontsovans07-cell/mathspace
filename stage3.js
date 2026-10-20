/* MathSpace · етап 3: матеріали уроку. Підключається ПІСЛЯ stage2.js: <script src="stage3.js"></script> */
(function () {
  const KINDS = { presentation: ['presentation_path', 'presentation_name', 'Презентація'], notes: ['notes_path', 'notes_name', 'Конспект'] };
  const MIME = {
    '.pdf': 'application/pdf', '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'
  };
  const extOf = n => { const m = String(n).toLowerCase().match(/\.[a-z0-9]{1,5}$/); return m ? m[0] : ''; };
  const baseStaff = staffLesson, baseStudent = studentLesson;

  async function links(l) {
    let out = '';
    for (const [pk, nk, label] of Object.values(KINDS)) {
      if (!l[pk]) continue;
      const { data } = await sb.storage.from('lessons').createSignedUrl(l[pk], 3600);
      if (data && data.signedUrl)
        out += `<div class="row"><span><b>${label}:</b> ${esc(l[nk] || 'файл')}</span><a class="btn small secondary" href="${esc(data.signedUrl)}" target="_blank" rel="noopener">Відкрити</a></div>`;
    }
    return out;
  }

  window.staffLesson = async function (sid, lid) {
    const [html, r] = await Promise.all([baseStaff(sid, lid), sb.from('lessons').select('*').eq('id', lid).single()]);
    if (r.error) throw r.error;
    const card = `<div class="card"><h2>Матеріали уроку</h2>${(await links(r.data)) || '<div class="muted small" style="margin-bottom:10px">Файлів ще немає.</div>'}
      <form data-form="material" data-sid="${sid}" data-lid="${lid}" class="flex" style="margin-top:10px">
        <select name="kind" style="width:auto"><option value="presentation">Презентація</option><option value="notes">Конспект</option></select>
        <input type="file" required accept=".pdf,.ppt,.pptx,.docx,.jpg,.jpeg,.png,.webp" style="flex:1;min-width:200px">
        <button class="btn">Завантажити</button></form>
      <p class="muted small">PDF, PowerPoint, Word або зображення, до 25 МБ. Новий файл замінює попередній того ж виду.</p></div>`;
    const mark = '<div class="card"><h2>Завдання тесту';
    return html.includes(mark) ? html.replace(mark, card + mark) : html + card;
  };

  window.studentLesson = async function (lid) {
    const [html, r] = await Promise.all([baseStudent(lid), sb.from('lessons').select('*').eq('id', lid).single()]);
    if (r.error) throw r.error;
    const l = await links(r.data);
    return l ? html.replace('</div></div>', '</div></div><div class="card"><h2>Матеріали</h2>' + l + '</div>') : html;
  };

  F.material = async function (f) {
    const file = f.querySelector('input[type=file]').files[0];
    const kind = new FormData(f).get('kind'), k = KINDS[kind];
    if (!file) throw new Error('Оберіть файл');
    if (file.size > 25 * 1024 * 1024) throw new Error('Файл більший за 25 МБ');
    const ext = extOf(file.name);
    if (!MIME[ext]) throw new Error('Дозволені лише PDF, PPT, PPTX, DOCX, JPG, PNG, WEBP');
    const path = `${f.dataset.sid}/${f.dataset.lid}/${kind}-${Date.now()}${ext}`;
    const up = await sb.storage.from('lessons').upload(path, file, { contentType: MIME[ext], upsert: false });
    if (up.error) throw up.error;
    const prev = await sb.from('lessons').select(k[0]).eq('id', f.dataset.lid).single();
    const { error } = await sb.from('lessons').update({ [k[0]]: path, [k[1]]: file.name.slice(0, 255) }).eq('id', f.dataset.lid);
    if (error) { await sb.storage.from('lessons').remove([path]); throw error; }
    if (prev.data && prev.data[k[0]]) await sb.storage.from('lessons').remove([prev.data[k[0]]]);
    toast('Файл завантажено');
    renderApp();
  };

  if (S.profile) renderApp();
})();
