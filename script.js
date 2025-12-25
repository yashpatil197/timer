// ===========================
//  GLOBAL STATE & CONFIG
// ===========================
let timerInterval;
let isRunning = false;
let timeLeft;
let currentMode = 'focus'; // 'focus' or 'short'
let totalSecondsElapsedInSession = 0;

// Load data from LocalStorage or set defaults
let settings = JSON.parse(localStorage.getItem('focusSettings')) || { focus: 25, break: 5 };
let stats = JSON.parse(localStorage.getItem('focusStats')) || { sessions: 0, totalXP: 0, level: 1 };

// Audio Objects (ensure assets exist in /assets folder)
const alarmSound = new Audio('assets/alarm.mp3');
const rainSound = new Audio('assets/rain.mp3');
rainSound.loop = true;

// DOM Elements References
const elements = {
    minDisplay: document.getElementById('minutes'),
    secDisplay: document.getElementById('seconds'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    sessionCount: document.getElementById('session-count'),
    taskList: document.getElementById('task-list'),
    taskInput: document.getElementById('task-input'),
    musicBtn: document.getElementById('music-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    settingsModal: document.getElementById('settings-modal'),
    userLevel: document.getElementById('user-level'),
    xpDetails: document.getElementById('xp-details'),
    xpBarFill: document.getElementById('xp-bar-fill'),
    quoteText: document.getElementById('quote-text'),
    quoteAuthor: document.getElementById('quote-author')
};

// ===========================
//  INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI based on saved state
    timeLeft = settings.focus * 60;
    updateTimerDisplay();
    updateStatsUI();
    loadTasks();
    applySavedTheme();
    fetchQuote(); // API Call

    // Initialize Drag & Drop Library
    new Sortable(elements.taskList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: saveLocalTasks // Save new order after drag finishes
    });

    // Event Listeners
    elements.taskInput.addEventListener("keypress", (e) => e.key === "Enter" && addTask());
    elements.themeToggle.addEventListener('click', toggleTheme);
    window.onclick = (e) => e.target === elements.settingsModal && closeSettings();
});


// ===========================
//  TIMER CORE LOGIC
// ===========================
function updateTimerDisplay() {
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    elements.minDisplay.textContent = m.toString().padStart(2, '0');
    elements.secDisplay.textContent = s.toString().padStart(2, '0');
    document.title = `${elements.minDisplay.textContent}:${elements.secDisplay.textContent} | FocusFlow`;
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    toggleTimerControls(true);
    totalSecondsElapsedInSession = 0; // Reset for this specific session

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            totalSecondsElapsedInSession++;
            updateTimerDisplay();
            
            // Gamification: Add XP every 60 seconds ONLY in focus mode
            if (currentMode === 'focus' && totalSecondsElapsedInSession % 60 === 0) {
                addXP(10); // 10 XP per minute
            }
        } else {
            completeSession();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    toggleTimerControls(false);
}

function resetTimer() {
    stopTimer();
    timeLeft = (currentMode === 'focus' ? settings.focus : settings.break) * 60;
    updateTimerDisplay();
}

function completeSession() {
    stopTimer();
    alarmSound.play().catch(e => console.log("Audio play failed. User hasn't interacted yet."));

    if (currentMode === 'focus') {
        stats.sessions++;
        // Bonus XP for finishing a session successfully
        addXP(50); 
        saveStats();
        updateStatsUI();
        alert("Focus session complete! Enjoy your break.");
        setMode('short');
    } else {
        alert("Break over! Time to focus.");
        setMode('focus');
    }
}

function toggleTimerControls(running) {
    elements.startBtn.classList.toggle('hidden', running);
    elements.stopBtn.classList.toggle('hidden', !running);
}

function setMode(mode) {
    stopTimer();
    currentMode = mode;
    timeLeft = (mode === 'focus' ? settings.focus : settings.break) * 60;
    
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
    updateTimerDisplay();
}


// ===========================
//  GAMIFICATION (XP & LEVELS)
// ===========================
function addXP(amount) {
    stats.totalXP += amount;
    // Simple Level Formula: Level up every 100 XP
    const newLevel = Math.floor(stats.totalXP / 100) + 1;
    
    if (newLevel > stats.level) {
        stats.level = newLevel;
        // Optional: Play a "level up" sound here
        alert(`🎉 Congratulations! You reached Level ${newLevel}!`);
    }
    saveStats();
    updateStatsUI();
}

function updateStatsUI() {
    elements.sessionCount.textContent = stats.sessions;
    elements.userLevel.textContent = `Level ${stats.level}`;
    
    const xpTowardsNextLevel = stats.totalXP % 100;
    elements.xpDetails.textContent = `${xpTowardsNextLevel} / 100 XP`;
    elements.xpBarFill.style.width = `${xpTowardsNextLevel}%`;
}

function saveStats() {
    localStorage.setItem('focusStats', JSON.stringify(stats));
}


// ===========================
//  TASK MANAGER (CRUD + Drag)
// ===========================
function addTask() {
    const text = elements.taskInput.value.trim();
    if (text === '') return;
    createTaskElement(text);
    saveLocalTasks();
    elements.taskInput.value = '';
}

function createTaskElement(text, completed = false) {
    const li = document.createElement('li');
    if (completed) li.classList.add('completed');

    li.innerHTML = `
        <div class="check-btn"></div>
        <span class="task-text">${text}</span>
        <button class="delete-btn">🗑️</button>
    `;

    // Add interactivity to the new elements
    const checkBtn = li.querySelector('.check-btn');
    checkBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering drag
        li.classList.toggle('completed');
        saveLocalTasks();
    });

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        li.remove();
        saveLocalTasks();
    });

    elements.taskList.appendChild(li);
}

function saveLocalTasks() {
    const tasks = Array.from(elements.taskList.children).map(li => ({
        text: li.querySelector('.task-text').textContent,
        completed: li.classList.contains('completed')
    }));
    localStorage.setItem('focusTasks', JSON.stringify(tasks));
}

function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('focusTasks')) || [];
    tasks.forEach(task => createTaskElement(task.text, task.completed));
}


// ===========================
//  API INTEGRATION (Quotes)
// ===========================
async function fetchQuote() {
    try {
        // Using a free, reliable quote API
        const response = await fetch('https://api.quotable.io/random?tags=technology,wisdom');
        if (!response.ok) throw new Error('API connection failed');
        const data = await response.json();
        
        elements.quoteText.textContent = `"${data.content}"`;
        elements.quoteAuthor.textContent = `- ${data.author}`;
    } catch (error) {
        console.warn("Quote API failed, using fallback:", error);
        elements.quoteText.textContent = '"Simplicity is the ultimate sophistication."';
        elements.quoteAuthor.textContent = "- Leonardo da Vinci";
    }
}


// ===========================
//  UI / UX & INTERACTION
// ===========================
// --- Music ---
function toggleMusic() {
    if (rainSound.paused) {
        rainSound.play().then(() => {
            elements.musicBtn.classList.add('playing');
            elements.musicBtn.querySelector('span').textContent = "⏸ Pausing Ambiance";
        }).catch(e => alert("Please interact with the page first so music can play!"));
    } else {
        rainSound.pause();
        elements.musicBtn.classList.remove('playing');
        elements.musicBtn.querySelector('span').textContent = "🎧 Play Ambiance";
    }
}

// --- Settings Modal ---
function openSettings() {
    elements.settingsModal.style.display = "flex";
    document.getElementById('custom-focus').value = settings.focus;
    document.getElementById('custom-break').value = settings.break;
}

function closeSettings() {
    elements.settingsModal.style.display = "none";
}

function saveSettings() {
    let newFocus = parseInt(document.getElementById('custom-focus').value);
    let newBreak = parseInt(document.getElementById('custom-break').value);
    
    // Basic validation
    settings.focus = (newFocus > 0 && newFocus <= 60) ? newFocus : 25;
    settings.break = (newBreak > 0 && newBreak <= 30) ? newBreak : 5;
    
    localStorage.setItem('focusSettings', JSON.stringify(settings));
    closeSettings();
    resetTimer();
}

// --- Dark Mode ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('focusTheme', next);
    updateThemeIcon(next);
}

function applySavedTheme() {
    const saved = localStorage.getItem('focusTheme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
    elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}
