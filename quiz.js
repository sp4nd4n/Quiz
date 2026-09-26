// ---------- state ----------

const $ = (id) => document.getElementById(id);
let quiz = null;
let quizId = null;
let qIndex = 0;
let answers = [];
let selectedThisQuestion = null;
let contact = {};

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Your name', type: 'text' },
  { key: 'phone', label: 'Your phone number', type: 'tel' },
];

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
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

    renderIdentifyFields((quiz.fields && quiz.fields.length) ? quiz.fields : DEFAULT_FIELDS);
    showView('view-identify');
  } catch (err) {
    console.error(err);
    showView('view-error');
  }
}
loadQuiz();

// ---------- identify ----------

function renderIdentifyFields(fields) {
  const wrap = $('identify-fields');
  const selectStyle = 'width:100%;padding:14px 15px;border-radius:12px;border:1px solid var(--panel-edge);background:var(--panel);color:var(--text);font-size:15px;font-family:var(--body-font);outline:none;';
  wrap.innerHTML = fields.map(f => {
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
      return `
        <div class="field">
          <label for="in-${f.key}">${escapeHtml(f.label)}</label>
          <select id="in-${f.key}" style="${selectStyle}">
            <option value="" disabled selected>Choose one</option>
            ${opts}
          </select>
          <div class="field-err" id="err-${f.key}">Please make a selection</div>
        </div>`;
    }
    const inputType = f.type === 'email' ? 'email' : (f.type === 'tel' ? 'tel' : 'text');
    const errMsg = f.type === 'email' ? 'Enter a valid email' : (f.type === 'tel' ? 'Enter a valid phone number' : 'This field is required');
    return `
      <div class="field">
        <label for="in-${f.key}">${escapeHtml(f.label)}</label>
        <input type="${inputType}" id="in-${f.key}" placeholder="${escapeHtml(f.label)}">
        <div class="field-err" id="err-${f.key}">${errMsg}</div>
      </div>`;
  }).join('');
}

$('btn-identify-continue').addEventListener('click', () => {
  const fields = (quiz.fields && quiz.fields.length) ? quiz.fields : DEFAULT_FIELDS;
  let ok = true;
  contact = {};

  fields.forEach(f => {
    const el = $('in-' + f.key);
    const errEl = $('err-' + f.key);
    const val = (el.value || '').trim();
    let valid = !!val;
    if (valid && f.type === 'email') valid = /\S+@\S+\.\S+/.test(val);
    if (valid && f.type === 'tel') valid = val.replace(/[^0-9]/g, '').length >= 7;

    if (!valid) { errEl.style.display = 'block'; ok = false; }
    else { errEl.style.display = 'none'; }

    contact[f.key] = { label: f.label, value: val };
  });

  if (!ok) return;

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
    const contactFields = Object.entries(contact).map(([key, v]) => ({ key, label: v.label, value: v.value }));
    const payload = {
      quizId,
      contactFields,
      questions: quiz.questions,
      answers,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    contactFields.forEach(f => { payload[f.key] = f.value; }); // convenience top-level copies
    await db.collection('responses').add(payload);
  } catch (err) {
    console.error('submit failed', err);
  }
  showView('view-end');
}
