// ---------- data ----------

const GENRES = [
  { id: 'romantic', name: 'Romantic', desc: 'Soft, swoony, a little cheesy', icon: 'M12 21s-7.5-4.6-10-9.3C.5 8 2.3 4.5 6 4.5c2 0 3.4 1 4 2.3.6-1.3 2-2.3 4-2.3 3.7 0 5.5 3.5 4 7.2C19.5 16.4 12 21 12 21z' },
  { id: 'action', name: 'Action', desc: 'Fast, loud, high stakes', icon: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z' },
  { id: 'adventure', name: 'Adventure', desc: 'Maps, quests, wide open world', icon: 'M12 2l9 20-9-5-9 5 9-20z' },
  { id: 'sci-fi', name: 'Sci-Fi', desc: 'Space, tech, the unknown', icon: 'M12 2c2 2 3 5 3 8 0 2-1 4-3 6-2-2-3-4-3-6 0-3 1-6 3-8zM7 17l-3 4 4-2M17 17l3 4-4-2' },
  { id: 'fantasy', name: 'Fantasy', desc: 'Magic, myth, a little wonder', icon: 'M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4z M19 15l.9 2 2.1.6-2.1.6-.9 2-.9-2-2.1-.6 2.1-.6z' },
];

// ---------- state ----------

let current = { genre: null, genreName: '', questions: [] };
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

// ---------- home ----------

$('btn-create').addEventListener('click', () => {
  current = { genre: null, genreName: '', questions: [] };
  showScreen('screen-genre');
});

// ---------- genre picker ----------

function renderGenres() {
  const grid = $('genre-grid');
  grid.innerHTML = GENRES.map(g => `
    <button class="genre-card" data-genre="${g.id}" data-name="${g.name}">
      <svg class="g-icon" viewBox="0 0 24 24" fill="none" stroke="#C13DFF" stroke-width="1.8"><path d="${g.icon}"/></svg>
      <span class="g-name">${g.name}</span>
      <span class="g-desc">${g.desc}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.genre-card').forEach(card => {
    card.addEventListener('click', () => {
      current.genre = card.dataset.genre;
      current.genreName = card.dataset.name;
      current.questions = [];
      $('builder-genre-label').textContent = current.genreName + ' quiz · add your questions';
      resetBuilderForm();
      renderQuestionList();
      showScreen('screen-builder');
    });
  });
}
renderGenres();

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
      genre: current.genre,
      genreName: current.genreName,
      questions: current.questions,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    generatedLink = buildQuizLink(code);
    $('link-text').textContent = generatedLink;
    $('link-genre-label').textContent = `${current.genreName} quiz · ${current.questions.length} question${current.questions.length > 1 ? 's' : ''}`;
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
  try {
    await navigator.clipboard.writeText(generatedLink);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = generatedLink;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
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
  current = { genre: null, genreName: '', questions: [] };
  showScreen('screen-genre');
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
  list.innerHTML = responsesCache.map((r, i) => `
    <div class="resp-card" data-idx="${i}">
      <div class="resp-top">
        <span class="resp-name">${escapeHtml(r.name)}</span>
        <span class="resp-genre">${escapeHtml(r.genreName || r.genre || '')}</span>
      </div>
      <div class="resp-phone">${escapeHtml(r.phone)}</div>
      <div class="resp-time">${r.submittedAtMs ? new Date(r.submittedAtMs).toLocaleString() : 'just now'}</div>
      <div class="resp-answers">
        ${(r.questions || []).map((q, qi) => `<div><strong>${escapeHtml(q.text)}</strong> → ${escapeHtml((r.answers && r.answers[qi] !== undefined && q.options[r.answers[qi]]) || '—')}</div>`).join('')}
      </div>
      <button class="mini-btn danger" data-del-idx="${i}">delete this entry</button>
    </div>
  `).join('');
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

// ---------- always open on home ----------

showScreen('screen-home');

// ---------- register service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
