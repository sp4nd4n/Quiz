// ---------- genre themes ----------

const THEMES = {
  romantic: {
    bg: '#2B0E1A', bg2: '#3E1526', accent: '#FF7AA2', accent2: '#E8C468',
    headFont: "'Playfair Display', serif", bodyFont: "'Lora', serif",
    themeClass: 'theme-romantic',
    tag: 'Romantic',
    introTitle: 'A little quiz about love, actually.',
    introSub: 'Answer honestly. Or don\u2019t. Either way, it\u2019s more fun that way.',
    endTitle: 'It\u2019s a match. \uD83D\uDC98',
    endSub: 'Your romantic instincts have officially been logged.',
    motif: () => makeSpans(8, ['\uD83E\uDE77', '\uD83D\uDC96'], 'petal'),
  },
  action: {
    bg: '#141414', bg2: '#241616', accent: '#FF3B3B', accent2: '#FFD23F',
    headFont: "'Anton', sans-serif", bodyFont: "'Oswald', sans-serif",
    themeClass: 'theme-action',
    tag: 'Action',
    introTitle: 'MISSION BRIEFING',
    introSub: 'No time to think twice. Move fast, answer faster.',
    endTitle: 'MISSION COMPLETE',
    endSub: 'Extraction successful. Standing by for the next op.',
    motif: () => '',
  },
  adventure: {
    bg: '#16261F', bg2: '#1E3329', accent: '#E8A33D', accent2: '#7FBF9E',
    headFont: "'Bitter', serif", bodyFont: "'Manrope', sans-serif",
    themeClass: 'theme-adventure',
    tag: 'Adventure',
    introTitle: 'The trail starts here.',
    introSub: 'A short quest, a few choices, one destination.',
    endTitle: 'Quest complete.',
    endSub: 'You\u2019ve reached the summit. Not bad for a first try.',
    motif: () => '',
  },
  'sci-fi': {
    bg: '#070B14', bg2: '#0E1830', accent: '#37E6FF', accent2: '#8B5CFF',
    headFont: "'Orbitron', sans-serif", bodyFont: "'Rajdhani', sans-serif",
    themeClass: 'theme-scifi',
    tag: 'Sci-Fi',
    introTitle: 'INCOMING TRANSMISSION',
    introSub: 'Signal locked. Respond to proceed with the sequence.',
    endTitle: 'Transmission complete.',
    endSub: 'Your data has been received and archived.',
    motif: () => '',
  },
  fantasy: {
    bg: '#1B0F2E', bg2: '#2A1747', accent: '#E8C468', accent2: '#37D6C4',
    headFont: "'Cinzel', serif", bodyFont: "'EB Garamond', serif",
    themeClass: 'theme-fantasy',
    tag: 'Fantasy',
    introTitle: 'The oracle has questions for you.',
    introSub: 'Choose carefully \u2014 fate is taking notes.',
    endTitle: 'The prophecy is fulfilled. \u2728',
    endSub: 'The oracle thanks you for your wisdom.',
    motif: () => makeSpans(10, ['\u2726', '\u2727', '\u2731'], 'spark'),
  },
};

function makeSpans(n, glyphs, cls) {
  let html = '';
  for (let i = 0; i < n; i++) {
    const g = glyphs[Math.floor(Math.random() * glyphs.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 6;
    const dur = 6 + Math.random() * 6;
    html += `<span class="${cls}" style="left:${left}%; animation-delay:${delay}s; animation-duration:${dur}s;">${g}</span>`;
  }
  return html;
}

// ---------- state ----------

const $ = (id) => document.getElementById(id);
let quiz = null;
let quizId = null;
let qIndex = 0;
let answers = [];
let selectedThisQuestion = null;
let contact = { name: '', phone: '' };

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
}

function applyTheme(genre) {
  const t = THEMES[genre] || THEMES.romantic;
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--bg2', t.bg2);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-2', t.accent2);
  root.style.setProperty('--head-font', t.headFont);
  root.style.setProperty('--body-font', t.bodyFont);
  document.body.classList.add(t.themeClass);
  $('motif').innerHTML = t.motif();
  return t;
}

// ---------- load quiz ----------

async function loadQuiz() {
  const params = new URLSearchParams(location.search);
  quizId = params.get('id');
  if (!quizId) { showView('view-error'); return; }

  try {
    const snap = await db.collection('quizzes').doc(quizId).get();
    if (!snap.exists) { showView('view-error'); return; }
    quiz = snap.data();
    const theme = applyTheme(quiz.genre);

    $('intro-genre').textContent = theme.tag;
    $('intro-title').textContent = theme.introTitle;
    $('intro-sub').textContent = `${theme.introSub} (${quiz.questions.length} question${quiz.questions.length > 1 ? 's' : ''})`;
    $('id-genre-tag').textContent = `${theme.tag} \u00b7 before you start`;
    $('end-title').textContent = theme.endTitle;
    $('end-sub').textContent = theme.endSub;

    showView('view-intro');
  } catch (err) {
    console.error(err);
    showView('view-error');
  }
}
loadQuiz();

// ---------- intro -> identify ----------

$('btn-start').addEventListener('click', () => showView('view-identify'));

// ---------- identify ----------

$('btn-identify-continue').addEventListener('click', () => {
  const name = $('in-name').value.trim();
  const phone = $('in-phone').value.trim();
  let ok = true;

  if (!name) { $('err-name').style.display = 'block'; ok = false; }
  else { $('err-name').style.display = 'none'; }

  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 7) { $('err-phone').style.display = 'block'; ok = false; }
  else { $('err-phone').style.display = 'none'; }

  if (!ok) return;

  contact = { name, phone };
  qIndex = 0;
  answers = [];
  renderQuestion();
  showView('view-question');
});

// ---------- questions ----------

function renderProgress() {
  const row = $('progress-row');
  row.innerHTML = quiz.questions.map((_, i) => `
    <div class="progress-dot"><div class="fill" style="width:${i < qIndex ? '100' : (i === qIndex ? '50' : '0')}%"></div></div>
  `).join('');
}

function renderQuestion() {
  const q = quiz.questions[qIndex];
  selectedThisQuestion = null;
  renderProgress();
  $('q-count').textContent = `Question ${qIndex + 1} of ${quiz.questions.length}`;
  $('q-text').textContent = q.text;
  $('opt-list').innerHTML = q.options.map((opt, i) => `
    <button class="opt-btn" data-idx="${i}">${escapeHtml(opt)}</button>
  `).join('');
  $('opt-list').querySelectorAll('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('opt-list').querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedThisQuestion = +btn.dataset.idx;
      $('btn-next').disabled = false;
    });
  });
  $('btn-next').disabled = true;
  $('btn-next').textContent = qIndex === quiz.questions.length - 1 ? 'Finish' : 'Next';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

$('btn-next').addEventListener('click', async () => {
  if (selectedThisQuestion === null) return;
  answers[qIndex] = selectedThisQuestion;

  if (qIndex < quiz.questions.length - 1) {
    qIndex++;
    renderQuestion();
  } else {
    await submitResponse();
  }
});

// ---------- submit ----------

async function submitResponse() {
  showView('view-sending');
  try {
    await db.collection('responses').add({
      quizId,
      genre: quiz.genre,
      genreName: quiz.genreName,
      name: contact.name,
      phone: contact.phone,
      questions: quiz.questions,
      answers,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('submit failed', err);
  }
  showView('view-end');
}
