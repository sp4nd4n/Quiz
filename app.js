// ---------- data ----------

const FIELD_PRESETS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone number', type: 'tel' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
];

// ---------- state ----------

let current = { questions: [], selectedPresetKeys: ['name', 'phone'], customFields: [], fields: [] };
let currentOptions = ['', ''];
let generatedLink = '';
let respUnsub = null;
let responsesCache = [];

// ---------- helpers ----------

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showToast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildQuizLink(id) {
  const path = location.pathname.replace(/index\.html$/, '');
  return location.origin + path + 'quiz.html?id=' + id;
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// ---------- home ----------

$('btn-create').addEventListener('click', () => {
  current = { questions: [], selectedPresetKeys: ['name', 'phone'], customFields: [], fields: [] };
  renderFieldToggles();
  renderCustomFieldsList();
  showScreen('screen-fields');
});

// ---------- info fields ----------

function renderFieldToggles() {
  const wrap = $('field-toggles');
  wrap.innerHTML = FIELD_PRESETS.map(p => {
    const on = current.selectedPresetKeys.includes(p.key);
    return `<button class="dashed-btn" data-preset="${p.key}" style="text-align:left; margin-bottom:8px; border-style:${on ? 'solid' : 'dashed'}; border-color:${on ? 'var(--accent-soft)' : 'var(--panel-edge)'}; color:${on ? 'var(--text)' : 'var(--text-dim)'}; background:${on ? 'rgba(193,61,255,0.12)' : 'transparent'};">${on ? '✓ ' : '+ '}${p.label}</button>`;
  }).join('');
  wrap.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      const idx = current.selectedPresetKeys.indexOf(key);
      if (idx >= 0) current.selectedPresetKeys.splice(idx, 1);
      else current.selectedPresetKeys.push(key);
      renderFieldToggles();
    });
  });
}

function renderCustomFieldsList() {
  const wrap = $('custom-fields-list');
  wrap.innerHTML = current.customFields.map((f, i) => `
    <div class="ticket">
      <div class="ticket-row">
        <span class="ticket-q">${escapeHtml(f.label)}</span>
        <button class="mini-btn danger" data-idx="${i}">remove</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('.mini-btn.danger').forEach(btn => {
    btn.addEventListener('click', () => {
      current.customFields.splice(+btn.dataset.idx, 1);
      renderCustomFieldsList();
    });
  });
}

$('btn-add-custom-field').addEventListener('click', () => {
  const label = prompt('Field label (e.g. Instagram handle, Age, College)');
  if (!label || !label.trim()) return;
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
  const existingKeys = FIELD_PRESETS.map(p => p.key).concat(current.customFields.map(f => f.key));
  let key = base, n = 1;
  while (existingKeys.includes(key)) { key = base + '_' + (++n); }
  current.customFields.push({ key, label: label.trim(), type: 'text' });
  renderCustomFieldsList();
});

$('btn-fields-continue').addEventListener('click', () => {
  current.fields = FIELD_PRESETS.filter(p => current.selectedPresetKeys.includes(p.key)).concat(current.customFields);
  resetBuilderForm();
  renderQuestionList();
  showScreen('screen-builder');
});

// ---------- MCQ builder ----------

function resetBuilderForm() {
  $('q-text').value = '';
  currentOptions = ['', ''];
  renderOptionRows();
}

function renderOptionRows() {
  const wrap = $('opt-rows');
  wrap.innerHTML = currentOptions.map((val, i) => `
    <div class="option-row">
      <input type="text" data-idx="${i}" class="opt-input" placeholder="Option ${i + 1}" value="${val.replace(/"/g, '&quot;')}">
      ${currentOptions.length > 2 ? `<button class="option-remove" data-idx="${i}">✕</button>` : ''}
    </div>
  `).join('');
  wrap.querySelectorAll('.opt-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      currentOptions[+e.target.dataset.idx] = e.target.value;
    });
  });
  wrap.querySelectorAll('.option-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentOptions.splice(+btn.dataset.idx, 1);
      renderOptionRows();
    });
  });
}
renderOptionRows();

$('btn-add-opt').addEventListener('click', () => {
  if (currentOptions.length >= 5) { showToast('Max 5 options'); return; }
  currentOptions.push('');
  renderOptionRows();
});

$('btn-add-question').addEventListener('click', () => {
  const text = $('q-text').value.trim();
  const opts = currentOptions.map(o => o.trim()).filter(Boolean);
  if (!text) { showToast('Write the question first'); return; }
  if (opts.length < 2) { showToast('Add at least 2 options'); return; }
  current.questions.push({ text, options: opts });
  resetBuilderForm();
  renderQuestionList();
});

function renderQuestionList() {
  const list = $('question-list');
  if (!current.questions.length) { list.innerHTML = ''; }
  else {
    list.innerHTML = current.questions.map((q, i) => `
      <div class="ticket">
        <div class="ticket-row">
          <span class="ticket-q">${i + 1}. ${escapeHtml(q.text)}</span>
          <button class="mini-btn danger" data-idx="${i}">remove</button>
        </div>
        <div class="ticket-opts">${q.options.map(o => `<span class="opt-chip">${escapeHtml(o)}</span>`).join('')}</div>
      </div>
    `).join('');
    list.querySelectorAll('.mini-btn.danger').forEach(btn => {
      btn.addEventListener('click', () => {
        current.questions.splice(+btn.dataset.idx, 1);
        renderQuestionList();
      });
    });
  }
  $('btn-done-building').disabled = current.questions.length === 0;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

$('btn-done-building').addEventListener('click', async () => {
  const btn = $('btn-done-building');
  btn.disabled = true;
  btn.textContent = 'Setting the trap…';
  try {
    let code, exists = true, attempts = 0;
    do {
      code = genCode();
      const snap = await db.collection('quizzes').doc(code).get();
      exists = snap.exists;
      attempts++;
    } while (exists && attempts < 6);

    await db.collection('quizzes').doc(code).set({
      questions: current.questions,
      fields: current.fields,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    generatedLink = buildQuizLink(code);
    $('link-text').textContent = generatedLink;
    $('link-genre-label').textContent = `${current.questions.length} question${current.questions.length > 1 ? 's' : ''}`;
    $('btn-copy-link').textContent = 'Copy';
    $('btn-copy-link').classList.remove('copied');
    showScreen('screen-link');
  } catch (err) {
    console.error(err);
    showToast('Could not create link — check your connection');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Done — generate link';
  }
});

// ---------- link ready ----------

$('btn-copy-link').addEventListener('click', async () => {
  await copyTextToClipboard(generatedLink);
  $('btn-copy-link').textContent = 'Copied ✓';
  $('btn-copy-link').classList.add('copied');
  showToast('Link copied to clipboard');
});

$('btn-share-link').addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: 'Take this quiz', url: generatedLink }); } catch {}
  } else {
    await navigator.clipboard.writeText(generatedLink);
    showToast('Link copied — paste it anywhere');
  }
});

$('btn-new-from-link').addEventListener('click', () => {
  current = { questions: [], selectedPresetKeys: ['name', 'phone'], customFields: [], fields: [] };
  renderFieldToggles();
  renderCustomFieldsList();
  showScreen('screen-fields');
});

// ---------- back buttons ----------

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

// ---------- responses ----------

$('btn-open-responses').addEventListener('click', () => {
  showScreen('screen-responses');
  localStorage.setItem('punkd_lastSeen', String(Date.now()));
  updateBadge();
});

function updateBadge() {
  const lastSeen = Number(localStorage.getItem('punkd_lastSeen') || 0);
  const unseen = responsesCache.filter(r => r.submittedAtMs > lastSeen).length;
  const badge = $('resp-badge');
  if (unseen > 0) { badge.style.display = 'flex'; badge.textContent = unseen > 9 ? '9+' : unseen; }
  else { badge.style.display = 'none'; }
}

function renderResponses() {
  const list = $('responses-list');
  if (!responsesCache.length) {
    list.innerHTML = '<p class="resp-empty">Nobody\'s taken the bait yet.<br>Share a link to get started.</p>';
    return;
  }
  list.innerHTML = responsesCache.map((r, i) => {
    const fields = (r.contactFields && r.contactFields.length) ? r.contactFields : [
      ...(r.name ? [{ label: 'Name', value: r.name }] : []),
      ...(r.phone ? [{ label: 'Phone', value: r.phone }] : []),
    ];
    const headline = fields[0] ? fields[0].value : 'Response';
    const restLine = fields.slice(1).map(f => `${escapeHtml(f.label)}: ${escapeHtml(f.value)}`).join(' · ');
    return `
    <div class="resp-card" data-idx="${i}">
      <div class="resp-top">
        <span class="resp-name">${escapeHtml(headline)}</span>
        <span class="resp-genre">${escapeHtml(r.quizId || '')}</span>
      </div>
      ${restLine ? `<div class="resp-phone">${restLine}</div>` : ''}
      <div class="resp-time">${r.submittedAtMs ? new Date(r.submittedAtMs).toLocaleString() : 'just now'}</div>
      <div class="resp-answers">
        ${(r.questions || []).map((q, qi) => `<div><strong>${escapeHtml(q.text)}</strong> → ${escapeHtml((r.answers && r.answers[qi] !== undefined && q.options[r.answers[qi]]) || '—')}</div>`).join('')}
      </div>
      <button class="mini-btn danger" data-del-idx="${i}">delete this entry</button>
    </div>
  `;
  }).join('');
  list.querySelectorAll('.resp-card').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('expanded'));
  });
  list.querySelectorAll('[data-del-idx]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = responsesCache[+btn.dataset.delIdx];
      if (!r || !r.id) return;
      if (!confirm(`Delete ${r.name}'s entry? This can't be undone.`)) return;
      try {
        await db.collection('responses').doc(r.id).delete();
        showToast('Entry deleted');
      } catch (err) {
        console.error(err);
        showToast('Could not delete — check your connection');
      }
    });
  });
}

function listenForResponses() {
  respUnsub = db.collection('responses').orderBy('submittedAt', 'desc').limit(100)
    .onSnapshot(snap => {
      responsesCache = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, submittedAtMs: data.submittedAt ? data.submittedAt.toMillis() : Date.now() };
      });
      renderResponses();
      updateBadge();
    }, err => console.error('responses listener error', err));
}
listenForResponses();

// ---------- my quizzes ----------

let quizzesCache = [];

$('btn-open-quizzes').addEventListener('click', () => showScreen('screen-quizzes'));

function renderQuizzes() {
  const list = $('quizzes-list');
  if (!quizzesCache.length) {
    list.innerHTML = '<p class="resp-empty">You haven\'t created any quizzes yet.</p>';
    return;
  }
  list.innerHTML = quizzesCache.map((q, i) => `
    <div class="resp-card" data-idx="${i}">
      <div class="resp-top">
        <span class="resp-name">Quiz ${escapeHtml(q.id)}</span>
        <span class="resp-genre">${q.questions ? q.questions.length : 0} Q${q.questions && q.questions.length === 1 ? '' : 's'}</span>
      </div>
      <div class="resp-time">${q.createdAtMs ? new Date(q.createdAtMs).toLocaleString() : 'just now'}</div>
      <div class="link-box" style="margin-top:12px">
        <span class="qz-link">${escapeHtml(buildQuizLink(q.id))}</span>
        <button class="copy-btn" data-copy-idx="${i}">Copy</button>
      </div>
      <button class="mini-btn danger" data-delq-idx="${i}" style="margin-top:8px">delete this quiz permanently</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-copy-idx]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const q = quizzesCache[+btn.dataset.copyIdx];
      await copyTextToClipboard(buildQuizLink(q.id));
      btn.textContent = 'Copied ✓';
      btn.classList.add('copied');
      showToast('Link copied to clipboard');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
    });
  });

  list.querySelectorAll('[data-delq-idx]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const q = quizzesCache[+btn.dataset.delqIdx];
      if (!q) return;
      if (!confirm('Delete this quiz link permanently? Anyone still holding the link will hit a dead end. Responses already collected are not affected.')) return;
      try {
        await db.collection('quizzes').doc(q.id).delete();
        showToast('Quiz deleted');
      } catch (err) {
        console.error(err);
        showToast('Could not delete — check your connection');
      }
    });
  });
}

function listenForQuizzes() {
  db.collection('quizzes').orderBy('createdAt', 'desc').limit(50)
    .onSnapshot(snap => {
      quizzesCache = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, createdAtMs: data.createdAt ? data.createdAt.toMillis() : Date.now() };
      });
      renderQuizzes();
    }, err => console.error('quizzes listener error', err));
}
listenForQuizzes();

// ---------- always open on home ----------

showScreen('screen-home');

// ---------- register service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
