// --- STATE & CONFIG ---
let timerInterval;
let isRunning = false;
let timeLeft;
let currentMode = 'focus'; 
let totalSecondsElapsedInSession = 0;
let focusChart;

// Default Settings
let settings = JSON.parse(localStorage.getItem('focusSettings')) || { 
    focus: 25, 
    break: 5, 
    dailyGoal: 60 
};

let stats = JSON.parse(localStorage.getItem('focusStats')) || { sessions: 0, totalXP: 0, level: 1 };

let dailyProgress = JSON.parse(localStorage.getItem('dailyProgress')) || {
    date: new Date().toISOString().split('T')[0],
    minutes: 0,
    goalMet: false
};

// Reset progress if it's a new day
if (dailyProgress.date !== new Date().toISOString().split('T')[0]) {
    dailyProgress = { date: new Date().toISOString().split('T')[0], minutes: 0, goalMet: false };
    localStorage.setItem('dailyProgress', JSON.stringify(dailyProgress));
}

// Audio
const alarmSound = new Audio('assets/alarm.mp3');

// DOM Elements
const elements = {
    min: document.getElementById('minutes'),
    sec: document.getElementById('seconds'),
    start: document.getElementById('start-btn'),
    stop: document.getElementById('stop-btn'),
    session: document.getElementById('session-count'),
    taskList: document.getElementById('task-list'),
    taskInput: document.getElementById('task-input'),
    themeToggle: document.getElementById('theme-toggle'),
    modal: document.getElementById('settings-modal'),
    playlist: document.getElementById('playlist-select'),
    player: document.getElementById('spotify-player')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    timeLeft = settings.focus * 60;
    updateDisplay();
    updateStatsUI();
    updateProgressUI();
    renderStreakUI();
    loadTasks();
    applyTheme();
    initChart();
    fetchQuote();

    // SortableJS Init
    new Sortable(elements.taskList, { animation: 150, onEnd: saveTasks });

    elements.taskInput.addEventListener("keypress", (e) => e.key === "Enter" && addTask());
    elements.themeToggle.addEventListener('click', toggleTheme);
    window.onclick = (e) => e.target === elements.modal && closeSettings();
});

// --- TIMER LOGIC ---
function startTimer() {
    if (isRunning) return;
    isRunning = true;
    toggleControls(true);
    totalSecondsElapsedInSession = 0;

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            totalSecondsElapsedInSession++;
            updateDisplay();

            // Track Daily Goal (Every 60s)
            if (currentMode === 'focus' && totalSecondsElapsedInSession % 60 === 0) {
                incrementDailyProgress();
                addXP(5); // 5 XP per minute
            }
        } else {
            completeSession();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    toggleControls(false);
}

function resetTimer() {
    stopTimer();
    timeLeft = (currentMode === 'focus' ? settings.focus : settings.break) * 60;
    updateDisplay();
}

function completeSession() {
    stopTimer();
    alarmSound.play().catch(e => console.log("Audio blocked"));

    if (currentMode === 'focus') {
        stats.sessions++;
        addXP(50); // Session Bonus
        logHistory(); // Chart Data
        
        // Save & UI
        localStorage.setItem('focusStats', JSON.stringify(stats));
        updateStatsUI();
        
        alert("Session Complete! Take a break.");
        setMode('short');
    } else {
        alert("Break over! Back to focus.");
        setMode('focus');
    }
}

function updateDisplay() {
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    elements.min.textContent = m.toString().padStart(2, '0');
    elements.sec.textContent = s.toString().padStart(2, '0');
    document.title = `${elements.min.textContent}:${elements.sec.textContent} | FocusFlow`;
}

function toggleControls(running) {
    elements.start.classList.toggle('hidden', running);
    elements.stop.classList.toggle('hidden', !running);
}

function setMode(mode) {
    stopTimer();
    currentMode = mode;
    timeLeft = (mode === 'focus' ? settings.focus : settings.break) * 60;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
    updateDisplay();
}

// --- GAMIFICATION & GOALS ---
function incrementDailyProgress() {
    dailyProgress.minutes++;
    localStorage.setItem('dailyProgress', JSON.stringify(dailyProgress));
    updateProgressUI();

    if (dailyProgress.minutes >= settings.dailyGoal && !dailyProgress.goalMet) {
        dailyProgress.goalMet = true;
        updateStreak();
        alert("🎯 Daily Goal Reached! Streak +1 🔥");
    }
}

function updateProgressUI() {
    document.getElementById('mins-today').textContent = dailyProgress.minutes;
    document.getElementById('goal-display').textContent = settings.dailyGoal;
}

function addXP(amount) {
    stats.totalXP += amount;
    const newLevel = Math.floor(stats.totalXP / 100) + 1;
    if (newLevel > stats.level) stats.level = newLevel;
    localStorage.setItem('focusStats', JSON.stringify(stats));
    updateStatsUI();
}

function updateStatsUI() {
    elements.session.textContent = stats.sessions;
    document.getElementById('user-level').textContent = `Level ${stats.level}`;
    document.getElementById('xp-details').textContent = `${stats.totalXP % 100} / 100 XP`;
    document.getElementById('xp-bar-fill').style.width = `${stats.totalXP % 100}%`;
}

// --- STREAK LOGIC ---
function updateStreak() {
    let streak = parseInt(localStorage.getItem('focusStreak')) || 0;
    let lastDate = localStorage.getItem('lastStreakDate');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (lastDate === yesterday) streak++;
    else if (lastDate !== today) streak = 1;

    localStorage.setItem('focusStreak', streak);
    localStorage.setItem('lastStreakDate', today);
    renderStreakUI();
}

function renderStreakUI() {
    const streak = parseInt(localStorage.getItem('focusStreak')) || 0;
    document.getElementById('streak-count').textContent = streak;
    const badge = document.querySelector('.streak-badge');
    
    if (dailyProgress.goalMet) {
        document.getElementById('streak-icon').textContent = "🔥";
        badge.classList.add('active');
    } else {
        document.getElementById('streak-icon').textContent = "❄️";
        badge.classList.remove('active');
    }
}

// --- CHART.JS ---
function logHistory() {
    let history = JSON.parse(localStorage.getItem('focusHistory')) || {};
    const today = new Date().toISOString().split('T')[0];
    history[today] = (history[today] || 0) + 1;
    localStorage.setItem('focusHistory', JSON.stringify(history));
    updateChart(history);
}

function initChart() {
    const ctx = document.getElementById('focusChart').getContext('2d');
    focusChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Sessions', data: [], backgroundColor: '#6c5ce7', borderRadius: 5 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
    });
    const history = JSON.parse(localStorage.getItem('focusHistory')) || {};
    updateChart(history);
}

function updateChart(history) {
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(history[dateStr] || 0);
    }
    focusChart.data.labels = labels;
    focusChart.data.datasets[0].data = data;
    focusChart.update();
}

// --- SPOTIFY ---
function changeSpotifyPlaylist() {
    const id = elements.playlist.value;
    elements.player.src = `https://open.spotify.com/embed/playlist/${id}?utm_source=generator`;
}

// --- TASKS ---
function addTask() {
    const text = elements.taskInput.value.trim();
    if (!text) return;
    createTaskEl(text);
    saveTasks();
    elements.taskInput.value = '';
}

function createTaskEl(text, completed = false) {
    const li = document.createElement('li');
    if (completed) li.classList.add('completed');
    li.innerHTML = `<span>${text}</span> <button class="delete-btn" onclick="this.parentElement.remove(); saveTasks()">×</button>`;
    li.addEventListener('click', (e) => {
        if(e.target.tagName !== 'BUTTON') {
            li.classList.toggle('completed');
            saveTasks();
        }
    });
    elements.taskList.appendChild(li);
}

function saveTasks() {
    const tasks = Array.from(elements.taskList.children).map(li => ({
        text: li.querySelector('span').textContent,
        completed: li.classList.contains('completed')
    }));
    localStorage.setItem('focusTasks', JSON.stringify(tasks));
}

function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('focusTasks')) || [];
    tasks.forEach(t => createTaskEl(t.text, t.completed));
}

// --- SETTINGS & THEME ---
function openSettings() {
    elements.modal.style.display = 'flex';
    document.getElementById('custom-focus').value = settings.focus;
    document.getElementById('custom-break').value = settings.break;
    document.getElementById('daily-goal-input').value = settings.dailyGoal;
}
function closeSettings() { elements.modal.style.display = 'none'; }
function saveSettings() {
    settings.focus = parseInt(document.getElementById('custom-focus').value) || 25;
    settings.break = parseInt(document.getElementById('custom-break').value) || 5;
    settings.dailyGoal = parseInt(document.getElementById('daily-goal-input').value) || 60;
    localStorage.setItem('focusSettings', JSON.stringify(settings));
    updateProgressUI();
    closeSettings();
    resetTimer();
}
function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('focusTheme', newTheme);
}
function applyTheme() {
    const theme = localStorage.getItem('focusTheme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

// --- API ---
async function fetchQuote() {
    try {
        const res = await fetch('https://api.quotable.io/random?tags=technology,wisdom');
        const data = await res.json();
        document.getElementById('quote-text').textContent = `"${data.content}"`;
        document.getElementById('quote-author').textContent = `- ${data.author}`;
    } catch (e) {
        document.getElementById('quote-text').textContent = '"Focus is the key to success."';
    }
}
