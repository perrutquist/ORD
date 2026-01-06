/* ORD – Vocabulary Trainer for Högskoleprovet
 *
 * Core app logic. Framework‑free SPA with three screens:
 * - #homeScreen
 * - #exerciseScreen
 * - #statsScreen
 *
 * Relies on:
 * - index.html defining the DOM structure and IDs mentioned below.
 * - style.css providing .hidden, .dark, .shake, .strike, .star, etc.
 * - words.json and idioms.json in the same directory.
 */

/* -----------------------------
 * Global state
 * ----------------------------- */

const DATA_URL_WORDS = 'words.json';
const DATA_URL_IDIOMS = 'idioms.json';

const STORAGE_KEYS = {
  DARK_MODE: 'ord.darkMode',
  HAPTICS: 'ord.haptics',
  MODE: 'ord.mode', // 'both' | 'words' | 'idioms'
  LIST_TYPE: 'ord.listType', // 'fixed' | 'random'
  RANDOM_COUNT: 'ord.randomCount',
};

const MODES = {
  BOTH: 'both',
  WORDS: 'words',
  IDIOMS: 'idioms',
};

const LIST_TYPES = {
  FIXED: 'fixed',
  RANDOM: 'random',
};

// Loaded datasets
let wordsPool = [];
let idiomsPool = [];

// Session state
let appInitialized = false;
let currentSettings = null; // { mode, listType, randomCount, fixedLetterIndex }
let queue = []; // array of items
let currentIndex = 0; // index in queue
let currentItem = null;
let currentChoices = []; // shuffled array of { text, isCorrect }
let hasMadeMistakeThisItem = false;

// Stats
let stats = {
  totalItems: 0,
  answeredItems: 0, // number of items that have been fully completed
  totalAttempts: 0,
  correctFirstTry: 0,
  wrongAttempts: 0,
};

// Review list: array of items
let reviewList = [];

// UI / DOM references
let dom = {};

// Haptics
let hapticsEnabled = false;

/* -----------------------------
 * Initialization
 * ----------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(err => {
    console.error('Failed to initialize app', err);
    alert('Kunde inte starta appen. Ladda om sidan.');
  });
});

async function initApp() {
  cacheDom();
  wireEvents();
  loadPreferences();
  applyPreferencesToUI();
  applyTheme();
  await loadData();
  updateModeCounts();
  renderHome();
  appInitialized = true;
}

/* -----------------------------
 * DOM helpers
 * ----------------------------- */

function cacheDom() {
  dom.homeScreen = document.getElementById('homeScreen');
  dom.exerciseScreen = document.getElementById('exerciseScreen');
  dom.statsScreen = document.getElementById('statsScreen');

  // Home controls
  dom.modeSelector = document.getElementById('modeSelector');
  dom.listTypeSelector = document.getElementById('listTypeSelector');
  dom.randomCountInput = document.getElementById('randomCount');
  dom.fixedListPicker = document.getElementById('fixedListPicker');

  // Mode counts
  dom.modeCountBoth = document.getElementById('modeCountBoth');
  dom.modeCountWords = document.getElementById('modeCountWords');
  dom.modeCountIdioms = document.getElementById('modeCountIdioms');
  dom.toggleDark = document.getElementById('toggleDark');
  dom.toggleHaptics = document.getElementById('toggleHaptics');
  dom.btnStart = document.getElementById('btnStart');

  // Exercise UI
  dom.question = document.getElementById('question');
  dom.options = document.getElementById('options');
  dom.hint = document.getElementById('hint');
  dom.progressBar = document.getElementById('progressBar');
  dom.remainingCount = document.getElementById('remainingCount');
  dom.btnMark = document.getElementById('btnMark');
  dom.btnEnd = document.getElementById('btnEnd');

  // Stats UI
  dom.statsSummary = document.getElementById('statsSummary');
  dom.reviewList = document.getElementById('reviewList');
  dom.btnOk = document.getElementById('btnOk');

  // Root for theme
  dom.body = document.body;
}

function getSelectedRadioValue(container, name) {
  if (!container) return null;
  const input = container.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
}

function wireEvents() {
  if (dom.modeSelector) {
    dom.modeSelector.addEventListener('change', () => {
      const value = getSelectedRadioValue(dom.modeSelector, 'mode');
      if (value) {
        savePreference(STORAGE_KEYS.MODE, value);
      }
    });
  }

  if (dom.listTypeSelector) {
    dom.listTypeSelector.addEventListener('change', () => {
      const value = getSelectedRadioValue(dom.listTypeSelector, 'listType');
      if (value) {
        savePreference(STORAGE_KEYS.LIST_TYPE, value);
      }
      updateHomeListTypeVisibility();
    });
  }

  if (dom.randomCountInput) {
    dom.randomCountInput.addEventListener('change', () => {
      const value = parseInt(dom.randomCountInput.value, 10) || 30;
      dom.randomCountInput.value = value;
      savePreference(STORAGE_KEYS.RANDOM_COUNT, value);
    });
  }

  if (dom.fixedListPicker) {
    dom.fixedListPicker.addEventListener('change', () => {
      // No persistence needed; default is based on day.
    });
  }

  if (dom.toggleDark) {
    dom.toggleDark.addEventListener('change', () => {
      toggleDarkMode(dom.toggleDark.checked);
    });
  }

  if (dom.toggleHaptics) {
    dom.toggleHaptics.addEventListener('change', () => {
      toggleHaptics(dom.toggleHaptics.checked);
    });
  }

  if (dom.btnStart) {
    dom.btnStart.addEventListener('click', () => {
      const settings = readHomeSettings();
      startGame(settings);
    });
  }

  if (dom.btnMark) {
    dom.btnMark.addEventListener('click', () => {
      markForReview();
    });
  }

  if (dom.btnEnd) {
    dom.btnEnd.addEventListener('click', () => {
      const confirmed = confirm('Vill du avsluta sessionen?');
      if (confirmed) {
        endSession();
      }
    });
  }

  if (dom.btnOk) {
    dom.btnOk.addEventListener('click', () => {
      renderHome();
    });
  }
}

/* -----------------------------
 * Preferences
 * ----------------------------- */

function loadPreferences() {
  const dark = loadPreference(STORAGE_KEYS.DARK_MODE);
  const haptics = loadPreference(STORAGE_KEYS.HAPTICS);
  const mode = loadPreference(STORAGE_KEYS.MODE);
  const listType = loadPreference(STORAGE_KEYS.LIST_TYPE);
  const randomCount = loadPreference(STORAGE_KEYS.RANDOM_COUNT);

  if (dom.toggleDark) {
    dom.toggleDark.checked = dark === 'true';
  }
  if (dom.toggleHaptics) {
    dom.toggleHaptics.checked = haptics === 'true';
  }
  hapticsEnabled = dom.toggleHaptics ? dom.toggleHaptics.checked : false;

  // Restore mode radio
  if (dom.modeSelector && mode) {
    const input = dom.modeSelector.querySelector(
      `input[name="mode"][value="${mode}"]`
    );
    if (input) {
      input.checked = true;
    }
  }

  // Restore listType radio
  if (dom.listTypeSelector && listType) {
    const input = dom.listTypeSelector.querySelector(
      `input[name="listType"][value="${listType}"]`
    );
    if (input) {
      input.checked = true;
    }
  }

  if (dom.randomCountInput && randomCount) {
    dom.randomCountInput.value = parseInt(randomCount, 10) || 30;
  }

  // Default fixed list index based on daysSinceEpoch (0–25)
  if (dom.fixedListPicker) {
    const storedIndex = loadPreference('ord.fixedLetterIndex');
    if (storedIndex != null) {
      dom.fixedListPicker.value = String(
        Math.max(0, Math.min(25, parseInt(storedIndex, 10) || 0))
      );
    } else {
      const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      const index = daysSinceEpoch % 26;
      dom.fixedListPicker.value = String(index);
    }
  }

  updateHomeListTypeVisibility();
}

function applyPreferencesToUI() {
  // Already applied in loadPreferences; this function is here for symmetry.
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    // Ignore storage errors (e.g. private mode)
  }
}

function loadPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

/* -----------------------------
 * Theme & Haptics
 * ----------------------------- */

function applyTheme() {
  const darkOn = dom.toggleDark ? dom.toggleDark.checked : false;
  if (darkOn) {
    dom.body.classList.add('dark');
  } else {
    dom.body.classList.remove('dark');
  }
}

function toggleDarkMode(on) {
  savePreference(STORAGE_KEYS.DARK_MODE, on);
  applyTheme();
}

function toggleHaptics(on) {
  hapticsEnabled = !!on;
  savePreference(STORAGE_KEYS.HAPTICS, hapticsEnabled);
  if (hapticsEnabled) {
    vibrateError(); // test vibration / permission
  }
}

function vibrateError() {
  if (!hapticsEnabled) return;
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
}

/* -----------------------------
 * Data loading
 * ----------------------------- */

async function loadData() {
  const [words, idioms] = await Promise.all([
    fetchJson(DATA_URL_WORDS),
    fetchJson(DATA_URL_IDIOMS),
  ]);

  wordsPool = normalizeData(words, 'word');
  idiomsPool = normalizeData(idioms, 'idiom');
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json();
}

function normalizeData(data, type) {
  if (!Array.isArray(data)) return [];
  return data.map((item, index) => ({
    id: `${type}-${index}`,
    type,
    question: item.question,
    incorrect: Array.isArray(item.incorrect) ? item.incorrect.slice() : [],
    hint: item.hint || '',
    answer: item.answer,
  }));
}

function updateModeCounts() {
  if (!dom.modeCountBoth && !dom.modeCountWords && !dom.modeCountIdioms) return;

  const nf = new Intl.NumberFormat('sv-SE');
  const wordsCount = wordsPool.length;
  const idiomsCount = idiomsPool.length;
  const bothCount = wordsCount + idiomsCount;

  if (dom.modeCountBoth) {
    dom.modeCountBoth.textContent = bothCount
      ? `(${nf.format(bothCount)})`
      : '';
  }
  if (dom.modeCountWords) {
    dom.modeCountWords.textContent = wordsCount
      ? `(${nf.format(wordsCount)})`
      : '';
  }
  if (dom.modeCountIdioms) {
    dom.modeCountIdioms.textContent = idiomsCount
      ? `(${nf.format(idiomsCount)})`
      : '';
  }
}

/* -----------------------------
 * Home screen
 * ----------------------------- */

function renderHome() {
  showScreen('home');

  // Reset session state
  queue = [];
  currentIndex = 0;
  currentItem = null;
  currentChoices = [];
  hasMadeMistakeThisItem = false;
  stats = {
    totalItems: 0,
    answeredItems: 0,
    totalAttempts: 0,
    correctFirstTry: 0,
    wrongAttempts: 0,
  };
  reviewList = [];
}

function updateHomeListTypeVisibility() {
  if (!dom.listTypeSelector) return;
  const type =
    getSelectedRadioValue(dom.listTypeSelector, 'listType') ||
    LIST_TYPES.FIXED;

  const fixedContainer = document.getElementById('fixedListContainer');
  const randomContainer = document.getElementById('randomCountContainer');

  if (type === LIST_TYPES.RANDOM) {
    if (fixedContainer) fixedContainer.classList.add('hidden');
    if (randomContainer) randomContainer.classList.remove('hidden');
  } else {
    if (fixedContainer) fixedContainer.classList.remove('hidden');
    if (randomContainer) randomContainer.classList.add('hidden');
  }
}

function readHomeSettings() {
  const mode = dom.modeSelector
    ? getSelectedRadioValue(dom.modeSelector, 'mode') || MODES.BOTH
    : MODES.BOTH;

  const listType = dom.listTypeSelector
    ? getSelectedRadioValue(dom.listTypeSelector, 'listType') ||
      LIST_TYPES.FIXED
    : LIST_TYPES.FIXED;

  const randomCount = dom.randomCountInput
    ? parseInt(dom.randomCountInput.value, 10) || 30
    : 30;

  const fixedLetterIndex = dom.fixedListPicker
    ? Math.max(
        0,
        Math.min(25, parseInt(dom.fixedListPicker.value, 10) || 0)
      )
    : 0;

  // Persist fixed letter index for next time
  savePreference('ord.fixedLetterIndex', fixedLetterIndex);

  return {
    mode,
    listType,
    randomCount,
    fixedLetterIndex,
  };
}

/* -----------------------------
 * Game setup
 * ----------------------------- */

function startGame(settings) {
  if (!wordsPool.length && !idiomsPool.length) {
    alert('Data är inte laddad ännu. Försök igen om en stund.');
    return;
  }

  currentSettings = settings;
  queue = buildQueue(settings);
  stats.totalItems = queue.length;
  currentIndex = 0;
  reviewList = [];
  hasMadeMistakeThisItem = false;

  if (!queue.length) {
    alert('Inga ord hittades för de valda inställningarna.');
    return;
  }

  renderExercise();
  loadCurrentItem();
}

function buildQueue(settings) {
  let pool = [];

  if (settings.mode === MODES.BOTH || settings.mode === MODES.WORDS) {
    pool = pool.concat(wordsPool);
  }
  if (settings.mode === MODES.BOTH || settings.mode === MODES.IDIOMS) {
    pool = pool.concat(idiomsPool);
  }

  if (!pool.length) return [];

  if (settings.listType === LIST_TYPES.RANDOM) {
    const count = Math.min(settings.randomCount, pool.length);
    const sampled = sampleWithoutReplacement(pool, count);
    shuffleArray(sampled);
    return sampled;
  }

  // Fixed list: deterministic slice based on letter index
  const sorted = pool.slice().sort((a, b) => {
    const qa = (a.question || '').toLocaleLowerCase('sv-SE');
    const qb = (b.question || '').toLocaleLowerCase('sv-SE');
    if (qa < qb) return -1;
    if (qa > qb) return 1;
    return 0;
  });

  const total = sorted.length;
  const sliceSize = Math.ceil(total / 26);
  const start = settings.fixedLetterIndex * sliceSize;
  const end = Math.min(start + sliceSize, total);
  const slice = sorted.slice(start, end);
  shuffleArray(slice);
  return slice;
}

/* -----------------------------
 * Exercise flow
 * ----------------------------- */

function renderExercise() {
  showScreen('exercise');
  updateProgress();
}

function loadCurrentItem() {
  if (currentIndex >= queue.length) {
    endSession();
    return;
  }

  currentItem = queue[currentIndex];
  hasMadeMistakeThisItem = false;

  if (dom.question) {
    dom.question.textContent = currentItem.question;
  }

  if (dom.hint) {
    dom.hint.textContent = '';
    dom.hint.classList.add('hidden');
  }

  currentChoices = composeChoices(currentItem);
  renderOptions();
  updateProgress();
}

function composeChoices(item) {
  const incorrect = item.incorrect || [];
  let distractors = [];

  if (incorrect.length <= 4) {
    distractors = incorrect.slice();
  } else {
    distractors = sampleWithoutReplacement(incorrect, 4);
  }

  const choices = distractors.map(text => ({
    text,
    isCorrect: false,
  }));

  choices.push({
    text: item.answer,
    isCorrect: true,
  });

  shuffleArray(choices);
  return choices;
}

function renderOptions() {
  if (!dom.options) return;
  dom.options.innerHTML = '';

  currentChoices.forEach((choice, index) => {
    const li = document.createElement('li');
    li.className = 'option';
    li.textContent = choice.text;
    li.dataset.index = String(index);
    li.addEventListener('click', () => handleOptionClick(index, li));
    dom.options.appendChild(li);
  });
}

function handleOptionClick(index, liElement) {
  if (!currentItem || !currentChoices.length) return;

  const choice = currentChoices[index];
  if (!choice) return;

  // Ignore clicks on already struck options
  if (liElement.classList.contains('strike')) return;

  stats.totalAttempts += 1;

  if (choice.isCorrect) {
    // Correct answer
    const wasFirstTry = !hasMadeMistakeThisItem;
    if (wasFirstTry) {
      stats.correctFirstTry += 1;
    }

    showCorrectFeedback(liElement);

    // Remove item from queue if first try, otherwise move to next index
    if (wasFirstTry) {
      queue.splice(currentIndex, 1);
    } else {
      currentIndex += 1;
    }

    stats.answeredItems += 1;

    // Delay a bit to show star animation
    setTimeout(() => {
      if (currentIndex >= queue.length) {
        endSession();
      } else {
        loadCurrentItem();
      }
    }, 500);
  } else {
    // Wrong answer
    stats.wrongAttempts += 1;
    hasMadeMistakeThisItem = true;
    showWrongFeedback(liElement);
    vibrateError();

    // Show hint
    if (dom.hint) {
      dom.hint.textContent = currentItem.hint || '';
      dom.hint.classList.remove('hidden');
    }

    // Move current item down the queue if this is the first wrong attempt
    if (!currentItem._requeued) {
      moveCurrentDownQueue();
      currentItem._requeued = true;
    }
  }

  updateProgress();
}

function moveCurrentDownQueue() {
  if (!queue.length) return;
  const item = queue[currentIndex];
  queue.splice(currentIndex, 1);

  const targetIndex = Math.min(currentIndex + 10, queue.length);
  queue.splice(targetIndex, 0, item);
}

/* -----------------------------
 * Feedback helpers
 * ----------------------------- */

function showCorrectFeedback(liElement) {
  if (!liElement) return;
  liElement.classList.add('correct');

  // Add star element
  const star = document.createElement('span');
  star.className = 'star';
  star.textContent = '★';
  liElement.appendChild(star);

  // Remove star after animation
  setTimeout(() => {
    if (star.parentNode) {
      star.parentNode.removeChild(star);
    }
    liElement.classList.remove('correct');
  }, 500);
}

function showWrongFeedback(liElement) {
  if (!liElement) return;

  liElement.classList.add('shake');
  liElement.classList.add('strike');

  // Remove shake class after animation duration
  setTimeout(() => {
    liElement.classList.remove('shake');
  }, 500);
}

/* -----------------------------
 * Progress & stats
 * ----------------------------- */

function updateProgress() {
  if (!dom.progressBar || !dom.remainingCount) return;

  const total = stats.totalItems || queue.length || 1;
  const remaining = queue.length - currentIndex;
  const answered = stats.answeredItems;

  const progress = Math.min(1, Math.max(0, answered / total));
  dom.progressBar.style.width = `${progress * 100}%`;

  const nf = new Intl.NumberFormat('sv-SE');
  dom.remainingCount.textContent = nf.format(remaining);
}

function endSession() {
  renderStats();
}

/* -----------------------------
 * Review & stats screen
 * ----------------------------- */

function markForReview() {
  if (!currentItem) return;
  if (reviewList.includes(currentItem)) return;
  reviewList.push(currentItem);
}

function renderStats() {
  showScreen('stats');

  const nf = new Intl.NumberFormat('sv-SE');

  const totalItems = stats.totalItems;
  const answeredItems = stats.answeredItems;
  const totalAttempts = stats.totalAttempts;
  const correctFirstTry = stats.correctFirstTry;
  const wrongAttempts = stats.wrongAttempts;

  const accuracy =
    totalAttempts > 0 ? (correctFirstTry / totalAttempts) * 100 : 0;

  if (dom.statsSummary) {
    dom.statsSummary.innerHTML = `
      <p>Antal uppgifter: <strong>${nf.format(totalItems)}</strong></p>
      <p>Färdiga uppgifter: <strong>${nf.format(answeredItems)}</strong></p>
      <p>Försök totalt: <strong>${nf.format(totalAttempts)}</strong></p>
      <p>Rätt på första försöket: <strong>${nf.format(
        correctFirstTry
      )}</strong></p>
      <p>Felaktiga försök: <strong>${nf.format(wrongAttempts)}</strong></p>
      <p>Träffsäkerhet (första försök): <strong>${nf.format(
        Math.round(accuracy)
      )}%</strong></p>
    `;
  }

  if (dom.reviewList) {
    dom.reviewList.innerHTML = '';
    if (!reviewList.length) {
      const li = document.createElement('li');
      li.textContent = 'Inga markerade ord.';
      dom.reviewList.appendChild(li);
    } else {
      reviewList.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        const q = encodeURIComponent(`Vad betyder "${item.question}"?`);
        a.href = `https://www.google.com/search?q=${q}`;
        a.textContent = item.question;
        li.appendChild(a);
        dom.reviewList.appendChild(li);
      });
    }
  }
}

/* -----------------------------
 * Screen navigation
 * ----------------------------- */

function showScreen(name) {
  if (!dom.homeScreen || !dom.exerciseScreen || !dom.statsScreen) return;

  dom.homeScreen.classList.add('hidden');
  dom.exerciseScreen.classList.add('hidden');
  dom.statsScreen.classList.add('hidden');

  switch (name) {
    case 'home':
      dom.homeScreen.classList.remove('hidden');
      break;
    case 'exercise':
      dom.exerciseScreen.classList.remove('hidden');
      break;
    case 'stats':
      dom.statsScreen.classList.remove('hidden');
      break;
  }
}

/* -----------------------------
 * Utility functions
 * ----------------------------- */

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    if (i !== j) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
  return arr;
}

function sampleWithoutReplacement(arr, count) {
  const copy = arr.slice();
  shuffleArray(copy);
  return copy.slice(0, count);
}
