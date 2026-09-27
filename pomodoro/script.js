const durations = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const modeLabels = {
  focus: '專注',
  shortBreak: '短休息',
  longBreak: '長休息',
};

const timeDisplay = document.getElementById('timeDisplay');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const sessionCountEl = document.getElementById('sessionCount');
const currentModeEl = document.getElementById('currentMode');
const modeButtons = document.querySelectorAll('.mode-btn');

let currentMode = 'focus';
let remainingSeconds = durations[currentMode];
let timer = null;
let completedSessions = 0;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateDisplay() {
  timeDisplay.textContent = formatTime(remainingSeconds);
  currentModeEl.textContent = modeLabels[currentMode];
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
  startPauseBtn.textContent = '開始';
}

function setMode(mode) {
  currentMode = mode;
  remainingSeconds = durations[mode];
  stopTimer();
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  updateDisplay();
}

function onTimerFinish() {
  stopTimer();

  if (currentMode === 'focus') {
    completedSessions += 1;
    sessionCountEl.textContent = completedSessions;
    setMode(completedSessions % 4 === 0 ? 'longBreak' : 'shortBreak');
  } else {
    setMode('focus');
  }
}

function startTimer() {
  if (timer) {
    stopTimer();
    return;
  }

  startPauseBtn.textContent = '暫停';
  timer = setInterval(() => {
    remainingSeconds -= 1;

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      updateDisplay();
      onTimerFinish();
      return;
    }

    updateDisplay();
  }, 1000);
}

startPauseBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', () => setMode(currentMode));
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

updateDisplay();
