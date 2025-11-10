// 全域變數
let currentStep = 1;
const totalSteps = 6;
let timerInterval = null;

// DOM 載入完成後執行
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initStepNavigation();
    initTimer();
    initCalculator();
});

// 初始化分頁功能
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // 移除所有 active 類別
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加 active 到選中的分頁
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// 初始化步驟導航
function initStepNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const steps = document.querySelectorAll('.step');
    const stepIndicator = document.getElementById('stepIndicator');
    const progress = document.getElementById('progress');

    // 更新步驟顯示
    function updateStep() {
        // 更新步驟顯示
        steps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.getAttribute('data-step')) === currentStep) {
                step.classList.add('active');
            }
        });

        // 更新指示器
        stepIndicator.textContent = `${currentStep} / ${totalSteps}`;

        // 更新進度條
        const progressPercent = (currentStep / totalSteps) * 100;
        progress.style.width = progressPercent + '%';

        // 更新按鈕狀態
        prevBtn.disabled = currentStep === 1;
        nextBtn.disabled = currentStep === totalSteps;

        // 捲動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 上一步
    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateStep();
        }
    });

    // 下一步
    nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
            currentStep++;
            updateStep();
        }
    });

    // 初始化
    updateStep();
}

// 初始化計時器
function initTimer() {
    const startTimerBtn = document.getElementById('startTimer');
    const timerHoursInput = document.getElementById('timerHours');
    const timerDisplay = document.getElementById('timerDisplay');

    startTimerBtn.addEventListener('click', () => {
        // 清除現有計時器
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        const hours = parseInt(timerHoursInput.value) || 6;
        let totalSeconds = hours * 3600;
        const endTime = Date.now() + (totalSeconds * 1000);

        // 更新按鈕文字
        startTimerBtn.textContent = '重新計時';

        // 顯示初始時間
        updateTimerDisplay(totalSeconds);

        // 開始倒數
        timerInterval = setInterval(() => {
            const remainingMs = endTime - Date.now();

            if (remainingMs <= 0) {
                clearInterval(timerInterval);
                timerDisplay.innerHTML = `
                    <div style="color: #28a745; font-size: 1.8rem;">
                        ⏰ 時間到！冰棒應該已經凍好了！
                    </div>
                    <div style="margin-top: 10px; font-size: 1rem; color: #6c757d;">
                        可以準備進行脫模囉！
                    </div>
                `;
                // 播放提示音（如果瀏覽器支援）
                playNotificationSound();
            } else {
                const remainingSeconds = Math.floor(remainingMs / 1000);
                updateTimerDisplay(remainingSeconds);
            }
        }, 1000);
    });

    // 更新計時器顯示
    function updateTimerDisplay(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const timeString = `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;

        timerDisplay.innerHTML = `
            <div style="font-size: 2.5rem; color: #667eea;">
                ${timeString}
            </div>
            <div style="margin-top: 10px; font-size: 0.9rem; color: #6c757d;">
                剩餘時間
            </div>
        `;
    }

    // 補零函數
    function pad(num) {
        return num.toString().padStart(2, '0');
    }

    // 播放通知音效
    function playNotificationSound() {
        try {
            // 創建簡單的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // 如果不支援，則靜默失敗
            console.log('Audio not supported');
        }
    }
}

// 初始化計算器
function initCalculator() {
    const calculateBtn = document.getElementById('calculateBtn');
    const popsicleCount = document.getElementById('popsicleCount');
    const popsicleSize = document.getElementById('popsicleSize');
    const sugarLevel = document.getElementById('sugarLevel');
    const calcResult = document.getElementById('calcResult');

    calculateBtn.addEventListener('click', () => {
        const count = parseInt(popsicleCount.value) || 8;
        const size = parseInt(popsicleSize.value) || 80;
        const sugar = parseFloat(sugarLevel.value) || 0.20;

        // 計算總容量（ml）
        const totalVolume = count * size;

        // 計算各材料份量
        const waterVolume = Math.round(totalVolume * 0.6); // 60% 水分
        const fruitVolume = Math.round(totalVolume * 0.4); // 40% 水果
        const sugarWeight = Math.round(totalVolume * sugar); // 糖的重量
        const lemonJuice = Math.ceil(count / 4); // 每4支約1湯匙檸檬汁

        // 水果重量估算（假設果泥密度約1.1）
        const fruitWeight = Math.round(fruitVolume * 1.1);

        // 顯示結果
        calcResult.innerHTML = `
            <h3>📊 所需材料份量</h3>
            <ul>
                <li><strong>冰棒數量：</strong>${count} 支</li>
                <li><strong>總容量：</strong>${totalVolume} ml</li>
                <li style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #28a745;"><strong>材料清單：</strong></li>
                <li>🍎 水果果肉：約 ${fruitWeight}g（或果汁 ${fruitVolume}ml）</li>
                <li>💧 水：${waterVolume}ml</li>
                <li>🍬 細砂糖：${sugarWeight}g</li>
                <li>🍋 檸檬汁：${lemonJuice} 湯匙</li>
            </ul>
            <div style="margin-top: 20px; padding: 15px; background: #d4edda; border-radius: 8px; font-size: 0.95rem;">
                <strong>💡 溫馨提醒：</strong><br>
                • 可依個人口味調整糖量<br>
                • 使用新鮮水果風味更佳<br>
                • 建議先製作少量試吃，再調整配方
            </div>
        `;

        calcResult.classList.add('show');

        // 捲動到結果處
        calcResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// 鍵盤快捷鍵支援
document.addEventListener('keydown', (e) => {
    // 在步驟分頁時，左右鍵可切換步驟
    const stepsTab = document.getElementById('steps');
    if (stepsTab.classList.contains('active')) {
        if (e.key === 'ArrowLeft' && currentStep > 1) {
            currentStep--;
            document.getElementById('prevBtn').click();
        } else if (e.key === 'ArrowRight' && currentStep < totalSteps) {
            currentStep++;
            document.getElementById('nextBtn').click();
        }
    }
});

// 平滑捲動功能
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// 防止表單輸入負數
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', function() {
        if (this.value < 0) {
            this.value = 0;
        }
        const max = this.getAttribute('max');
        if (max && parseInt(this.value) > parseInt(max)) {
            this.value = max;
        }
    });
});

// 頁面載入完成提示
window.addEventListener('load', () => {
    console.log('🍦 枝仔冰製作教學工具已載入完成！');
    console.log('💡 提示：在製作步驟頁面可以使用左右方向鍵切換步驟');
});
