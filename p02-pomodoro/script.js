const modeLabels = {
  work: "專注",
  shortBreak: "短休息",
  longBreak: "長休息"
};

const state = {
  durations: {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  mode: "work",
  remaining: 25 * 60,
  running: false,
  sessions: 0,
  workRounds: 0,
  timerId: null
};

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const sessionCountEl = document.getElementById("sessionCount");
const nextModeEl = document.getElementById("nextMode");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const tabs = document.querySelectorAll(".tab");
const settingsForm = document.getElementById("settingsForm");

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getNextMode() {
  if (state.mode !== "work") return "work";
  return (state.workRounds + 1) % 4 === 0 ? "longBreak" : "shortBreak";
}

function render() {
  timerEl.textContent = formatTime(state.remaining);
  statusEl.textContent = state.running
    ? `${modeLabels[state.mode]}中...`
    : `準備${modeLabels[state.mode]}`;
  sessionCountEl.textContent = state.sessions.toString();
  nextModeEl.textContent = modeLabels[getNextMode()];
  startPauseBtn.textContent = state.running ? "暫停" : "開始";
  document.title = `${formatTime(state.remaining)} ${modeLabels[state.mode]} | 蕃茄鐘`;

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
  });
}

function stopTimer() {
  if (!state.timerId) return;
  clearInterval(state.timerId);
  state.timerId = null;
  state.running = false;
}

function switchMode(mode) {
  stopTimer();
  state.mode = mode;
  state.remaining = state.durations[mode];
  render();
}

function tick() {
  if (state.remaining > 0) {
    state.remaining -= 1;
    render();
    return;
  }

  if (state.mode === "work") {
    state.sessions += 1;
    state.workRounds += 1;
  }

  switchMode(getNextMode());
}

function toggleTimer() {
  if (state.running) {
    stopTimer();
    render();
    return;
  }

  state.running = true;
  state.timerId = setInterval(tick, 1000);
  render();
}

function applySettings(event) {
  event.preventDefault();
  const values = {
    work: Number(document.getElementById("workInput").value),
    shortBreak: Number(document.getElementById("shortBreakInput").value),
    longBreak: Number(document.getElementById("longBreakInput").value)
  };

  for (const [mode, minutes] of Object.entries(values)) {
    if (!Number.isFinite(minutes) || minutes < 1) return;
    state.durations[mode] = Math.floor(minutes) * 60;
  }

  state.remaining = state.durations[state.mode];
  stopTimer();
  render();
}

startPauseBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click", () => switchMode(state.mode));
settingsForm.addEventListener("submit", applySettings);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

render();
