# ORD – Vocabulary Trainer for Högskoleprovet

ORD is a small, self‑contained web app for practicing the **ORD** (vocabulary) section of the Swedish university entrance exam, **Högskoleprovet**.

You can use it directly in your browser, or save it to your phone’s home screen and run it like a native app.

**Live version:** https://perrutquist.github.io/ORD/

---

## What is this?

ORD helps you practice Swedish words and idioms in a quiz format:

- You are shown a **word or idiom**.
- You choose between **five possible meanings**.
- You get **instant feedback**:
  - Correct: a gold star appears briefly.
  - Incorrect: the option shakes, is struck out, and a **hint** is shown.
- You can **mark items for review** and see them at the end of the session.
- The app keeps track of **progress and basic stats**.

The interface is in **Swedish**, but the code, comments, and filenames are in **English**.

---

## How to use it

### 1. Open the app

Go to:

> https://perrutquist.github.io/ORD/

The app is completely static and runs entirely in your browser. No login or backend is required.

### 2. (Recommended) Save to your home screen

ORD is optimized for being installed as a “pseudo‑native” app on your phone.

#### iOS (Safari)

1. Open the link in **Safari**.
2. Tap the **Share** button.
3. Choose **“Add to Home Screen”**.
4. Confirm the name (e.g. “ORD”) and tap **Add**.
5. Launch ORD from your home screen like any other app.

#### Android (Chrome)

1. Open the link in **Chrome**.
2. Open the **menu** (⋮).
3. Tap **“Add to Home screen”** or **“Install app”**.
4. Confirm and then launch ORD from your home screen or app drawer.

You can also use ORD in any modern desktop browser without installing it.

---

## Playing a session

When you open ORD, you start on the **home screen**. Here you choose what and how to practice.

### Home screen options

- **Content type**
  - **Idioms** – only idioms.
  - **Words** – only single words.
  - **Both** – mix of words and idioms.  
    *Default: Both.*

- **List type**
  - **Random list** – randomly sample from the full dataset.
  - **Fixed list** – use a deterministic slice of the dataset.  
    *Default: Fixed.*

- **Random list size**
  - When “Random” is selected, choose how many items to draw.
  - *Default: 30 items.*

- **Fixed list picker**
  - When “Fixed” is selected, choose a letter **A–Z**.
  - Each letter corresponds to roughly **1/26** of the total items.
  - The **default letter** is based on the current day:  
    `daysSinceEpoch % 26`, so each day you get a new default list.

- **Dark mode toggle**
  - Switch between light and dark theme.
  - The choice is remembered between sessions.

- **Haptics toggle**
  - Enable/disable haptic feedback (vibration) on incorrect answers.
  - Turning it on triggers a test vibration so the browser can request permission.

After choosing your settings, start the game (button text may vary, e.g. “Starta”).

---

## Exercise screen

During a session, you see:

- The **current word or idiom**.
- **Five answer options** (one correct, four incorrect).
- A **“Mark for review”** button.
- A **progress bar** and **remaining count**.
- An **“Avsluta”** button at the bottom.

### Answering questions

1. Tap one of the five options.
2. Feedback:
   - **Correct on first try**
     - A gold **star** appears briefly next to the answer.
     - The item is **removed** from the queue.
     - The next item is shown automatically.
   - **Incorrect**
     - The chosen option **shakes** (animation).
     - The option is **struck out** and cannot be chosen again.
     - The **hint** for the item appears below the options (and stays visible).
     - If haptics are enabled, the device **vibrates**.
     - You must keep trying until you pick the correct answer.

### Item scheduling (spaced repetition–like behavior)

The app maintains an internal **queue** of items:

- At the start of a session, the queue is **shuffled**.
- If you answer an item **correctly on the first try**, it is **removed** from the queue.
- If you **make any mistake** on an item:
  - The item is **moved down** the queue so that it will reappear after **10 other items**,  
    or at the **end** if fewer than 10 remain.
  - This means difficult items are **repeated later** in the same session.

### Marking for review

- Tap **“Markera för genomgång”** (or similar) to mark the current item.
- Marked items are collected in a **review list**.
- The review list is shown on the **stats screen** at the end of the session.

### Ending a session

- Tap **“Avsluta”** at the bottom of the exercise screen.
- A **confirmation dialog** appears to prevent accidental exits.
- Confirming takes you to the **stats screen**.

---

## Stats and review screen

When the queue is empty (you have finished all items) or you end the session:

- A **summary of your performance** is shown.
- Numbers are formatted using `Intl.NumberFormat('sv-SE')` (Swedish locale).
- The **review list** is displayed:
  - Each marked word/idiom is listed.
  - Each entry is a link to a Google search:  
    `Vad betyder "<word>"?`  
    so you can read more detailed explanations and examples.

There is also an **“OK”** button that returns you to the **home screen**.

---

## Data files

The app uses two JSON files:

- `words.json` – vocabulary words.
- `idioms.json` – idioms and expressions.

Each entry has the structure:

```json
{
  "question": "ana ugglor i mossen",
  "incorrect": [
    "bli rädd",
    "vara vidskeplig",
    "överdriva risker",
    "fantisera",
    "varna i onödan"
  ],
  "hint": "Felhörning: ulvar i mosen blev ugglor.",
  "answer": "misstänka oråd"
}
```

- `question` – the word or idiom being tested.
- `incorrect` – an array of **distractors** (wrong answers).
- `hint` – a short hint shown after the first wrong attempt.
- `answer` – the correct meaning.

The app randomly selects four distractors from the available incorrect answers (if there are more than four), adds the correct answer, and shuffles the five options.

---

## Code structure (for developers)

The app is a tiny, framework‑free **single‑page application (SPA)**.

Main files:

- `index.html` – defines the three root screens:
  - `#homeScreen`
  - `#exerciseScreen`
  - `#statsScreen`
- `script.js` – holds all app state, logic, and event wiring.
- `style.css` – layout, colors, dark theme, and micro‑animations.
- `words.json`, `idioms.json` – data sets.
- `manifest.json` – PWA manifest for installability.
- Icon `.png` files – app icons for various devices.
- `qa.html` – a separate data‑quality utility (see below).

### Core logic (script.js)

Key functions (names may vary slightly, but the behavior is as follows):

- `initApp()`  
  Bootstraps the app: loads JSON data, sets up event listeners, applies saved UI toggles, and renders the home screen.

- `loadData()`  
  Fetches `words.json` and `idioms.json`, normalizes records, and prepares them for use.

- `buildQueue(settings)`  
  Based on the home‑screen settings (idioms/words/both, random/fixed, list size or letter), builds the initial **shuffled queue** of items.

- `startGame(settings)`  
  Initializes session state (queue, counters, review list) and renders the first exercise item.

- `composeChoices(item)`  
  For a given item, picks four distractors, adds the correct answer, and shuffles the five options.

- `shuffleArray(arr)`  
  Fisher–Yates shuffle used throughout the app.

- `renderHome()`, `renderExercise()`, `renderStats()`  
  Minimal renderers that show/hide the three main screens and update the relevant DOM elements.

- `handleOptionClick(index)`  
  Core answer handler: applies feedback (star, shake, strikeout, hint, haptics), updates stats, and decides whether to move to the next item or requeue the current one.

- `moveCurrentDownQueue()`  
  Requeues the current item 10 positions later (or at the end) after a wrong attempt.

- `updateProgress()`  
  Updates the progress bar and remaining count.

- `markForReview()`  
  Adds the current item to the review list.

- `endSession()`  
  Finalizes stats and navigates to the stats screen.

- `toggleDarkMode(on)`, `toggleHaptics(on)`  
  Apply/remove theme classes and prepare haptics.

- `vibrateError()`  
  Triggers haptic feedback on incorrect answers (if enabled and supported).

### DOM elements and CSS classes

Important IDs:

- Screens:
  - `#homeScreen`
  - `#exerciseScreen`
  - `#statsScreen`
- Exercise UI:
  - `#question`
  - `#options`
  - `#hint`
  - `#progressBar`
  - `#remainingCount`
  - `#btnMark`
  - `#btnEnd`
- Home controls:
  - `#modeSelector` (idioms/words/both)
  - `#listTypeSelector` (random/fixed)
  - `#randomCount`
  - `#fixedListPicker`
  - `#toggleDark`
  - `#toggleHaptics`
- Stats UI:
  - `#statsSummary`
  - `#reviewList`
  - `#btnOk`

Utility classes:

- `.hidden` – hide elements.
- `.dark` – dark theme.
- `.shake` – wrong‑answer animation.
- `.strike` – strikeout for eliminated options.
- `.star` – correct‑answer feedback.

---

## Data quality tool: qa.html

`qa.html` is a separate page (not part of the main game) used to check the quality of the JSON data.

Open it directly in the browser (e.g. `qa.html` from a local clone or via the repo’s GitHub Pages if exposed).

The inline script:

- Loads both `words.json` and `idioms.json`.
- Runs a few checks:
  - **Duplicates** – finds repeated `question` entries across/all files.
  - **Short hints** – flags hints below a chosen length threshold.
  - **Bad distractors** – detects distractors that are identical to any correct answer.

Results are displayed directly on the page.

---

## Development

### Requirements

- Any **static file server** or GitHub Pages.
- A **modern browser** (Chrome, Firefox, Safari, Edge, mobile or desktop).

No build step or external dependencies are required.

### Running locally

1. Clone the repository.
2. Serve the directory with any static server, for example:

   ```bash
   # Python 3
   python -m http.server 8000
   ```

3. Open `http://localhost:8000/` in your browser.

To run the data quality tool, open `http://localhost:8000/qa.html`.

---

## Browser support and privacy

- Works in all modern browsers that support standard HTML, CSS, and JavaScript.
- Designed and tested primarily for **mobile browsers** (iOS Safari, Android Chrome).
- All logic runs **client‑side**:
  - No accounts.
  - No server‑side storage.
  - No tracking.
- Any preferences (e.g. dark mode, haptics) may be stored locally in the browser (e.g. `localStorage`).

---

## License

This work is licensed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

- **Author:** Per Rutquist  
- **You are free to:**
  - **Share** — copy and redistribute the material in any medium or format.
  - **Adapt** — remix, transform, and build upon the material for any purpose, even commercially.
- **Under the following terms:**
  - **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.

For full license text, see: https://creativecommons.org/licenses/by/4.0/

