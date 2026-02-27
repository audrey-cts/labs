// =============================================
// 全域狀態（暫存分析結果）
// =============================================
const AppState = {
    vocabList: [],      // [{ word, definition }]
    fileName: '',
    fcIndex: 0,
    fcFlipped: false,
    fcOrder: [],        // flashcard display order (indices)
};

const SAMPLE_DATA = [
    { word: 'apple', definition: '蘋果' },
    { word: 'banana', definition: '香蕉' },
    { word: 'computer', definition: '電腦' },
    { word: 'dictionary', definition: '字典' },
    { word: 'elephant', definition: '大象' },
    { word: 'flower', definition: '花朵' },
    { word: 'guitar', definition: '吉他' },
    { word: 'hospital', definition: '醫院' },
    { word: 'island', definition: '島嶼' },
    { word: 'journal', definition: '日誌' },
];

// =============================================
// 工具函式：顯示 / 隱藏區塊
// =============================================
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    el.classList.add('active');
}

function setNavActive(navId) {
    document.querySelectorAll('.step-indicator').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(navId);
    if (el) el.classList.add('active');
}

// =============================================
// 檔案解析
// =============================================
function parseVocabFile(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const result = [];
    const separators = [',', '\t', ':', '='];

    for (const line of lines) {
        // Skip comment lines
        if (line.startsWith('#')) continue;

        let sep = null;
        for (const s of separators) {
            if (line.includes(s)) { sep = s; break; }
        }
        if (!sep) continue;

        const idx = line.indexOf(sep);
        const word = line.substring(0, idx).trim();
        const definition = line.substring(idx + 1).trim();

        if (word && definition) {
            result.push({ word, definition });
        }
    }
    return result;
}

function analyzeAndStore(vocabList, fileName) {
    AppState.vocabList = vocabList;
    AppState.fileName = fileName;
    // 暫存分析結果至 sessionStorage
    sessionStorage.setItem('vocabList', JSON.stringify(vocabList));
    sessionStorage.setItem('vocabFileName', fileName);
}

// =============================================
// 分析結果顯示
// =============================================
function renderAnalysisSection() {
    const list = AppState.vocabList;

    // 統計資訊
    document.getElementById('analysisStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${list.length}</div>
            <div class="stat-label">詞彙總數</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${AppState.fileName || '範例資料'}</div>
            <div class="stat-label">來源檔案</div>
        </div>
    `;

    // 詞彙表格
    const tbody = document.getElementById('vocabTableBody');
    tbody.innerHTML = list.map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(item.word)}</strong></td>
            <td>${escapeHtml(item.definition)}</td>
        </tr>
    `).join('');

    setNavActive('nav-analysis');
    showSection('section-analysis');
}

// =============================================
// 單字卡功能
// =============================================
function initFlashcardOrder() {
    AppState.fcOrder = AppState.vocabList.map((_, i) => i);
    AppState.fcIndex = 0;
    AppState.fcFlipped = false;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function renderFlashcard() {
    const list = AppState.vocabList;
    const order = AppState.fcOrder;
    const idx = order[AppState.fcIndex];
    const item = list[idx];
    const total = order.length;
    const current = AppState.fcIndex + 1;

    document.getElementById('fcFront').textContent = item.word;
    document.getElementById('fcBack').textContent = item.definition;
    document.getElementById('fcProgressText').textContent = `${current} / ${total}`;

    const fill = document.getElementById('fcProgressFill');
    fill.style.width = ((current / total) * 100) + '%';

    // Reset flip state
    const card = document.getElementById('flashcard');
    card.classList.remove('flipped');
    AppState.fcFlipped = false;

    // Update nav buttons
    document.getElementById('fcPrevBtn').disabled = AppState.fcIndex === 0;
    document.getElementById('fcNextBtn').disabled = AppState.fcIndex === total - 1;
}

function startFlashcard() {
    initFlashcardOrder();
    renderFlashcard();
    setNavActive('nav-mode');
    showSection('section-flashcard');
}

// =============================================
// 測驗功能
// =============================================
function buildQuizQuestions() {
    const list = AppState.vocabList;
    // Shuffle a copy for quiz order
    const order = list.map((_, i) => i);
    shuffleArray(order);

    const container = document.getElementById('quizQuestions');
    container.innerHTML = order.map((vocabIdx, qNum) => {
        const item = list[vocabIdx];
        return `
            <div class="quiz-question" data-vocab-idx="${vocabIdx}">
                <div class="q-number">第 ${qNum + 1} 題</div>
                <div class="q-prompt">請填入對應「<strong>${escapeHtml(item.definition)}</strong>」的單字：</div>
                <input type="text"
                       class="q-input"
                       id="q-input-${vocabIdx}"
                       placeholder="輸入答案..."
                       autocomplete="off"
                       spellcheck="false">
                <div class="q-feedback hidden" id="q-feedback-${vocabIdx}"></div>
            </div>
        `;
    }).join('');

    // Store quiz order for grading
    container.dataset.order = JSON.stringify(order);
}

function gradeQuiz() {
    const list = AppState.vocabList;
    const container = document.getElementById('quizQuestions');
    const order = JSON.parse(container.dataset.order);

    let correctCount = 0;
    const details = [];

    order.forEach(vocabIdx => {
        const item = list[vocabIdx];
        const input = document.getElementById(`q-input-${vocabIdx}`);
        const userAnswer = input ? input.value.trim() : '';
        const isCorrect = userAnswer.toLowerCase() === item.word.toLowerCase();
        if (isCorrect) correctCount++;
        details.push({ vocabIdx, word: item.word, definition: item.definition, userAnswer, isCorrect });
    });

    const total = order.length;
    const allCorrect = correctCount === total;
    const score = allCorrect ? total : 0; // 全對才給分

    return { correctCount, total, allCorrect, score, details };
}

function renderQuizResult(result) {
    const { correctCount, total, allCorrect, score, details } = result;

    // 顯示個別題目回饋
    details.forEach(d => {
        const { vocabIdx } = d;
        const feedback = document.getElementById(`q-feedback-${vocabIdx}`);
        if (feedback) {
            feedback.classList.remove('hidden');
            if (d.isCorrect) {
                feedback.className = 'q-feedback correct';
                feedback.textContent = '✓ 正確！';
            } else {
                feedback.className = 'q-feedback incorrect';
                feedback.textContent = `✗ 正確答案：${d.word}（你填：${d.userAnswer || '（未填寫）'}）`;
            }
            // Disable input
            const input = document.getElementById(`q-input-${vocabIdx}`);
            if (input) input.disabled = true;
        }
    });

    // Score card
    const resultCard = document.getElementById('resultCard');
    const scoreEl = document.getElementById('resultScore');
    const msgEl = document.getElementById('resultMessage');

    if (allCorrect) {
        resultCard.className = 'result-card result-perfect';
        scoreEl.textContent = `🎉 ${score} / ${total}`;
        msgEl.textContent = '太棒了！全部答對，得到滿分！';
    } else {
        resultCard.className = 'result-card result-fail';
        scoreEl.textContent = `得分：0 / ${total}`;
        msgEl.textContent = `答對 ${correctCount} 題，錯誤 ${total - correctCount} 題。需要全對才計分，加油！`;
    }

    // Detail table
    document.getElementById('resultDetails').innerHTML = `
        <h3 class="result-detail-title">詳細結果：</h3>
        <table class="result-table">
            <thead><tr><th>#</th><th>定義</th><th>正確答案</th><th>你的答案</th><th>結果</th></tr></thead>
            <tbody>
                ${details.map((d, i) => `
                    <tr class="${d.isCorrect ? 'row-correct' : 'row-incorrect'}">
                        <td>${i + 1}</td>
                        <td>${escapeHtml(d.definition)}</td>
                        <td><strong>${escapeHtml(d.word)}</strong></td>
                        <td>${escapeHtml(d.userAnswer) || '<em>未填寫</em>'}</td>
                        <td>${d.isCorrect ? '✓' : '✗'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('quizContent').classList.add('hidden');
    document.getElementById('quizResult').classList.remove('hidden');
}

// =============================================
// 工具
// =============================================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// =============================================
// 初始化
// =============================================
document.addEventListener('DOMContentLoaded', function () {

    // --- 上傳區 ---
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameEl = document.getElementById('fileName');
    const loadSampleBtn = document.getElementById('loadSampleBtn');

    // 點擊選擇檔案
    selectFileBtn.addEventListener('click', () => fileInput.click());

    // 拖曳上傳
    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelected(file);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
    });

    function handleFileSelected(file) {
        fileNameEl.textContent = file.name;
        fileInfo.classList.remove('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.dataset.fileReady = '1';
        // Store file reference
        analyzeBtn._file = file;
    }

    clearFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn._file = null;
    });

    // 分析按鈕
    analyzeBtn.addEventListener('click', () => {
        const file = analyzeBtn._file;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target.result;
            const list = parseVocabFile(text);
            if (list.length === 0) {
                alert('未能從檔案中解析出詞彙，請確認格式正確（每行：單字,定義）。');
                return;
            }
            analyzeAndStore(list, file.name);
            renderAnalysisSection();
        };
        reader.readAsText(file, 'UTF-8');
    });

    // 範例資料
    loadSampleBtn.addEventListener('click', () => {
        analyzeAndStore(SAMPLE_DATA, '範例資料');
        renderAnalysisSection();
    });

    // --- 分析區 ---
    document.getElementById('reuploadBtn').addEventListener('click', () => {
        setNavActive('nav-upload');
        showSection('section-upload');
    });

    document.getElementById('startFlashcardBtn').addEventListener('click', () => {
        if (AppState.vocabList.length === 0) return;
        startFlashcard();
    });

    document.getElementById('startQuizBtn').addEventListener('click', () => {
        if (AppState.vocabList.length === 0) return;
        buildQuizQuestions();
        document.getElementById('quizContent').classList.remove('hidden');
        document.getElementById('quizResult').classList.add('hidden');
        setNavActive('nav-mode');
        showSection('section-quiz');
    });

    // --- 單字卡 ---
    document.getElementById('flashcard').addEventListener('click', () => {
        const card = document.getElementById('flashcard');
        AppState.fcFlipped = !AppState.fcFlipped;
        card.classList.toggle('flipped', AppState.fcFlipped);
    });

    document.getElementById('fcPrevBtn').addEventListener('click', () => {
        if (AppState.fcIndex > 0) {
            AppState.fcIndex--;
            renderFlashcard();
        }
    });

    document.getElementById('fcNextBtn').addEventListener('click', () => {
        if (AppState.fcIndex < AppState.fcOrder.length - 1) {
            AppState.fcIndex++;
            renderFlashcard();
        }
    });

    document.getElementById('fcShuffleBtn').addEventListener('click', () => {
        shuffleArray(AppState.fcOrder);
        AppState.fcIndex = 0;
        renderFlashcard();
    });

    document.getElementById('fcResetBtn').addEventListener('click', () => {
        initFlashcardOrder();
        renderFlashcard();
    });

    document.getElementById('flashcardBackBtn').addEventListener('click', () => {
        renderAnalysisSection();
    });

    // --- 測驗 ---
    document.getElementById('submitQuizBtn').addEventListener('click', () => {
        const result = gradeQuiz();
        renderQuizResult(result);
    });

    document.getElementById('retryQuizBtn').addEventListener('click', () => {
        buildQuizQuestions();
        document.getElementById('quizContent').classList.remove('hidden');
        document.getElementById('quizResult').classList.add('hidden');
    });

    document.getElementById('quizToModeBtn').addEventListener('click', () => {
        renderAnalysisSection();
    });

    document.getElementById('quizBackBtn').addEventListener('click', () => {
        renderAnalysisSection();
    });

    // 鍵盤導覽：單字卡左右鍵
    document.addEventListener('keydown', e => {
        const fc = document.getElementById('section-flashcard');
        if (fc.classList.contains('active')) {
            if (e.key === 'ArrowLeft') document.getElementById('fcPrevBtn').click();
            else if (e.key === 'ArrowRight') document.getElementById('fcNextBtn').click();
            else if (e.key === ' ') {
                e.preventDefault();
                document.getElementById('flashcard').click();
            }
        }
    });

    // 嘗試從 sessionStorage 恢復狀態
    const saved = sessionStorage.getItem('vocabList');
    if (saved) {
        try {
            const list = JSON.parse(saved);
            const name = sessionStorage.getItem('vocabFileName') || '';
            if (Array.isArray(list) && list.length > 0) {
                AppState.vocabList = list;
                AppState.fileName = name;
            }
        } catch (e) {
            // ignore
        }
    }

    console.log('📚 單字學習系統已載入完成！');
});

