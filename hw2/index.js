// 【Spec 2.9】A virtual keyboard display: 宣告 QWERTY 配置以於後續透過 DOM 產生虛擬鍵盤
const KEYBOARD_LAYOUT = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    ['CapsLock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
    ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'ShiftRight'],
    ['Space']
];

// ============================================================================
// DOM Elements 取用 (對應至各項 Spec 需求按鈕與區域)
// ============================================================================
const virtualKeyboard = document.getElementById('virtual-keyboard'); // 【Spec 2.9】實體鍵盤對應顯示區域
const elapsedTimeEl = document.getElementById('elapsed-time');       // 【Spec 2.13】已經經過多少時間
const correctCountEl = document.getElementById('correct-count');     // 【Spec 2.13】記分板 - 正確次數
const errorCountEl = document.getElementById('error-count');         // 【Spec 2.13】記分板 - 錯誤次數
const startBtn = document.getElementById('start-btn');               // 【Spec 2.7】開始按鈕
const resetBtn = document.getElementById('reset-btn');               // 【Spec 2.6】重置所有的選項狀態與數字
const endEarlyBtn = document.getElementById('end-early-btn');         // 【Spec 2.8】提早結束按鈕
const controlsPanel = document.getElementById('controls-panel');      // 【Spec 2.8】須被隱藏的控制設定面板群 
const customTimeInput = document.getElementById('custom-time');       // 【Spec 2.5】自訂時間輸入區域
const quickTimeBtns = document.querySelectorAll('.quick-time');       // 【Spec 2.4】快速設定時間 (如 30s, 60s)
const caseRadios = document.getElementsByName('case');                // 【Spec 2.2】大小寫模式選擇
const modeRadios = document.getElementsByName('mode');                // 【Spec 2.3】出題模式選擇 (隨機或循序)
const displayArea = document.getElementById('display-area');          // 【Spec 2.1】一般模式下，中間的字元顯示區域
const targetCharEl = document.getElementById('target-char');          // 【Spec 2.1】負責替換與顯示文字的區塊
const articleDisplayArea = document.getElementById('article-display-area'); // 【Spec 2.12】文章模式下的全版文句顯示區域
const articleUpload = document.getElementById('article-upload');      // 【Spec 2.11】JSON文章上傳按鈕
const resultModal = document.getElementById('result-modal');          // 【Spec 2.14】結算分數結果彈出視窗
const closeModalBtn = document.getElementById('close-modal-btn');     // 關閉結果視窗按鈕
const resAccuracy = document.getElementById('res-accuracy');          // 【Spec 2.14】結算區：Accuracy
const resCpm = document.getElementById('res-cpm');                    // 【Spec 2.14】結算區：CPM
const resCorrect = document.getElementById('res-correct');            
const resError = document.getElementById('res-error');                

// 【Spec 2.10】Auditory feedback：包含打對跟打錯的音效物件
const soundCorrect = document.getElementById('sound-correct');
const soundWrong = document.getElementById('sound-wrong');

// 給不同大小寫模式的常數
const UPPER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER_CHARS = "abcdefghijklmnopqrstuvwxyz";
const MIXED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// ============================================================================
// 全域狀態管理 (State variables)
// ============================================================================
let isPlaying = false;           // 是否正在打字測驗中
let maxTime = 0;                 // 測驗設定了幾秒鐘
let elapsedTime = 0;             // 目前已經經過了幾秒
let correctCount = 0;            // 計算正中字元次數
let errorCount = 0;              // 計算錯誤敲擊次數
let timerInterval = null;        // 計時器本體

// 測驗狀態 (依據介面選取)
let currentCase = 'uppercase';   // 'uppercase' / 'lowercase' / 'both'
let currentMode = 'sequential';  // 'sequential' / 'randomized'
let seqIndex = 0;                // 循序模式使用的內部陣列索引
let currentTargetChar = '';      // 當下要求使者打出來的字 (或字元)

// 【Spec 2.11 - 2.12】Article Mode (文章讀取模式) 狀態管理
let isArticleMode = false;       // 是否正在文章模式
let articleText = '';            // JSON 裡面被解開出來的整段文章
let articleIndex = 0;            // 正在打到這篇文章的第幾個單字
let articleSpanElements = [];    // 儲存 DOM 以方便直接抽換 highlight class

// ============================================================================
// 【Spec 2.9】透過迴圈動態把虛擬鍵盤渲染在 DOM 上面
// ============================================================================
function renderKeyboard() {
    virtualKeyboard.innerHTML = '';
    KEYBOARD_LAYOUT.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';
        row.forEach(key => {
            const keyBtn = document.createElement('div');
            keyBtn.className = 'key';
            
            let displayKey = key;
            if (key === 'Space') {
                keyBtn.classList.add('key-space');
                displayKey = ' ';
            } else if (key.length > 1) {
                keyBtn.classList.add('key-wide');
                if (key === 'ShiftRight') displayKey = 'Shift';
            }
            
            keyBtn.textContent = displayKey;
            keyBtn.dataset.key = key; 
            rowEl.appendChild(keyBtn);
        });
        virtualKeyboard.appendChild(rowEl);
    });
}

// 根據 Case 設定 (2.2) 回傳該提供給系統盲考的字源陣列
function getCharSet() {
    if (currentCase === 'uppercase') return UPPER_CHARS;
    if (currentCase === 'lowercase') return LOWER_CHARS;
    return MIXED_CHARS; 
}

// 負責產生下一個測驗字元 (包含順序、隨機、以及文章推進邏輯)
function generateNextChar() {
    // 【Spec 2.12】如果是文章模式
    if (isArticleMode) {
        if (articleIndex >= articleText.length) {
            endPractice(); // 文章打完了就提早結束
            return;
        }
        
        // 將上一個字的底線框標記拔除
        if (articleIndex > 0 && articleSpanElements[articleIndex - 1]) {
            articleSpanElements[articleIndex - 1].classList.remove('current');
        }
        
        // 幫新的標的字加上 current，提供 Spec 提到的特殊背景色標示
        if (articleSpanElements[articleIndex]) {
            articleSpanElements[articleIndex].classList.remove('future');
            articleSpanElements[articleIndex].classList.add('current');
            currentTargetChar = articleText[articleIndex];
        }
        return;
    }

    // 一般單字練習模式
    const chars = getCharSet();
    // 【Spec 2.3】Sequential or Randomized
    if (currentMode === 'sequential') {
        currentTargetChar = chars[seqIndex % chars.length];
        seqIndex++;
    } else { // Randomized
        // 隨機選一個不同的字元，避免無聊
        let nextChar = currentTargetChar;
        while (nextChar === currentTargetChar) {
            nextChar = chars[Math.floor(Math.random() * chars.length)];
        }
        currentTargetChar = nextChar;
    }
    // 放入 【Spec 2.1】的字元顯示區域
    targetCharEl.textContent = currentTargetChar;
}

// ============================================================================
// 【Spec 2.4 - 2.5】時間控制邏輯 
// ============================================================================
window.setTimerLimit = function(time) {
    maxTime = time;
    customTimeInput.value = time; // 填入自訂時間框框中方便辨識
}

// 【Spec 2.4】點擊 Quick-Set 30s/60s 時呼叫 setTimer
quickTimeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setTimerLimit(parseInt(btn.dataset.time));
    });
});

// ============================================================================
// 【Spec 2.11】JSON檔案瀏覽與上傳觸發處理
// ============================================================================
articleUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 透過 FileReader 解開文字並驗證
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target.result);
            if (json.text) {
                setupArticleMode(json.text); // 如果驗證成功，就進入處理 Spec 2.12
            } else {
                alert("無效的 JSON，其中需要具備 'text' 屬性！");
            }
        } catch (err) {
            alert("讀取或解析 JSON 時發生錯誤！");
        }
    };
    reader.readAsText(file);
});

// 【Spec 2.12】啟動文章模式，並顯示出段落與下一個目標字元
function setupArticleMode(text) {
    isArticleMode = true;
    articleText = text;
    articleIndex = 0;
    
    // 切換 UI，隱藏單一文字區塊，點亮文章顯示區
    displayArea.classList.add('hidden');
    articleDisplayArea.classList.remove('hidden');
    
    // 建立字元 SPAN 元素以方便個別控制樣式 (CSS)
    articleDisplayArea.innerHTML = '';
    articleSpanElements = [];
    
    for (let char of articleText) {
        const span = document.createElement('span');
        span.className = 'article-char future';
        if (char === ' ') {
            span.innerHTML = '&nbsp;'; // 保留空白的排版
            span.dataset.char = ' ';
        } else {
            span.textContent = char;
            span.dataset.char = char;
        }
        articleDisplayArea.appendChild(span);
        articleSpanElements.push(span);
    }
}

// 關閉文章模式，回歸到普通單字模式處理
function stopArticleMode() {
    isArticleMode = false;
    articleText = '';
    displayArea.classList.remove('hidden');
    articleDisplayArea.classList.add('hidden');
    articleUpload.value = ''; // 將 file input 清空
}

// 從選項 Radio (Case & Mode) 把 UI 資料同步進變數中
function updateSettingsFromUI() {
    if (isArticleMode) return; 
    for (const radio of caseRadios) {
        if (radio.checked) currentCase = radio.value;
    }
    for (const radio of modeRadios) {
        if (radio.checked) currentMode = radio.value;
    }
    seqIndex = 0; // 開始新練習重頭計算順序
}

// ============================================================================
// 【Spec 2.7】點擊開始遊戲 Start 按鈕邏輯
// ============================================================================
function startPractice() {
    let limit = parseInt(customTimeInput.value);
    if (!limit || limit <= 0) {
        alert("請先設定右側 Timer 秒數 (或按 30s/60s 快速設定)！");
        return;
    }
    maxTime = limit;
    
    updateSettingsFromUI();
    
    // 初始化成績
    elapsedTime = 0;
    correctCount = 0;
    errorCount = 0;
    articleIndex = 0;
    updateStatsUI();
    
    if (isArticleMode && articleSpanElements.length > 0) {
        articleSpanElements.forEach(span => span.className = 'article-char future');
    }

    // 產生螢幕上的第一個測驗字
    generateNextChar();
    
    // 【Spec 2.8】開始後把控制面板藏起來，並顯示【提早結束】按鈕
    controlsPanel.classList.add('hidden');
    endEarlyBtn.classList.remove('hidden');
    
    isPlaying = true;
    
    // 定時器，每過一秒處理 Elapsed Tracker 以及倒數機制
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateStatsUI();
        if (elapsedTime >= maxTime) {
            endPractice(); // 時間已到結束遊戲
        }
    }, 1000);
}

// ============================================================================
// 【Spec 2.8】點擊提早結束或時間到時的處置：關閉計時器並發出結算
// ============================================================================
function endPractice() {
    isPlaying = false;
    clearInterval(timerInterval);
    
    // 介面轉換回初期的狀態
    controlsPanel.classList.remove('hidden');
    endEarlyBtn.classList.add('hidden');
    
    // 【Spec 2.14】呼叫結算畫面
    showResults();
}

// ============================================================================
// 【Spec 2.6】點擊 Reset 恢復出廠設置功能
// ============================================================================
function resetPractice() {
    stopArticleMode();
    customTimeInput.value = '';
    elapsedTime = 0;
    correctCount = 0;
    errorCount = 0;
    updateStatsUI();
    targetCharEl.textContent = 'A'; 
    
    caseRadios[0].checked = true; // 預設 Uppercase
    modeRadios[0].checked = true; // 預設 Sequential
}

// 【Spec 2.13】隨時將次數、秒數顯示於畫面上方計分板
function updateStatsUI() {
    elapsedTimeEl.textContent = elapsedTime + 's';
    correctCountEl.textContent = correctCount;
    errorCountEl.textContent = errorCount;
}

// 【Spec 2.10】依據引數播放不同對應的音效
function playSound(isCorrect) {
    const audio = isCorrect ? soundCorrect : soundWrong;
    audio.currentTime = 0; // 重置時間軸以容許連發
    audio.play().catch(e => console.log("Audio play prevented:", e));
}

// 輔助函式：用來將 KeyboardEvent 轉化為對應陣列裡面的按鍵名稱，以找出網頁上的 <div>
function getKeyboardKey(eventKey, eventCode) {
    if (eventCode === 'Space') return "Space";
    if (eventCode === 'ShiftLeft') return "Shift";
    if (eventCode === 'ShiftRight') return "ShiftRight";
    if (eventCode === 'CapsLock') return "CapsLock";
    if (eventCode === 'Tab') return "Tab";
    if (eventCode === 'Backspace') return "Backspace";
    if (eventCode === 'Enter') return "Enter";
    
    if (['Alt', 'Control', 'Meta'].includes(eventKey)) return null;

    return eventKey;
}

// 【Spec 2.9】點擊虛擬鍵盤特效 (改變色彩或跳動)
function highlightKey(key, statusClass, duration = 300) {
    let keyEl = document.querySelector(`.key[data-key="${key}"]`);
    if (!keyEl) keyEl = document.querySelector(`.key[data-key="${key.toLowerCase()}"]`);
    if (!keyEl) keyEl = document.querySelector(`.key[data-key="${key.toUpperCase()}"]`);
    
    if (keyEl) {
        keyEl.classList.add(statusClass);
        setTimeout(() => {
            keyEl.classList.remove(statusClass);
        }, duration);
    }
}

// ============================================================================
// 主核心：聆聽實體鍵入時觸發的判斷
// ============================================================================
document.addEventListener('keydown', (e) => {
    // 就算不在遊玩狀態，還是可以有純粹的反饋光澤
    if (!isPlaying) {
        const k = getKeyboardKey(e.key, e.code);
        if (k) highlightKey(k, 'active', 100);
        return;
    }
    
    // 擋住空白鍵預設的滾轉能力
    if (e.code === 'Space' || e.code === 'Quote' || e.code === 'Slash') e.preventDefault();

    // 忽略 Modifier
    if (['Shift', 'CapsLock', 'Tab', 'Alt', 'Control', 'Meta'].includes(e.key)) {
        const k = getKeyboardKey(e.key, e.code);
        if (k) highlightKey(k, 'active', 200);
        return;
    }
    
    const k = getKeyboardKey(e.key, e.code);

    // 【判斷答對】與需要的指定目標字元吻合
    if (e.key === currentTargetChar) {
        correctCount++;
        playSound(true); // 撥出對的音效
        if (k) highlightKey(k, 'correct', 200); // 將對應虛擬鍵盤染綠
        
        // 若是在文章模式，將當下的 <span> 變成過關樣式，並且將指標往前推進
        if (isArticleMode) {
            articleSpanElements[articleIndex].classList.remove('current', 'incorrect');
            articleSpanElements[articleIndex].classList.add('correct');
            articleIndex++;
        }
        
        updateStatsUI();
        generateNextChar(); // 出題
        
    } else {
    // 【判斷答錯】與指定字元不吻合
        errorCount++;
        playSound(false); // 錯誤音效
        if (k) highlightKey(k, 'wrong', 300); // 虛擬鍵盤錯字發紅、抖動
        
        // 若在文章模式，該指標文字給出錯字樣式，但指標不推進，必須等打對為止
        if (isArticleMode) { 
            articleSpanElements[articleIndex].classList.add('incorrect');
        }
        
        updateStatsUI();
    }
});

// ============================================================================
// 【Spec 2.14】秀出結算成績與數學公式計算
// ============================================================================
function showResults() {
    const totalHits = correctCount + errorCount;
    // 公式: Correct / (Correct + Wrong) * 100%
    let accuracy = 0;
    if (totalHits > 0) {
        accuracy = Math.round((correctCount / totalHits) * 100);
    }
    
    // 公式: (Correct / Elapsed seconds) * 60
    let cpm = 0;
    if (elapsedTime > 0) {
        cpm = Math.round((correctCount / elapsedTime) * 60);
    }
    
    // 指派至結算 Modal 清單
    resAccuracy.textContent = accuracy + '%';
    resCpm.textContent = cpm;
    resCorrect.textContent = correctCount;
    resError.textContent = errorCount;
    
    resultModal.classList.remove('hidden'); // 將彈窗顯示
}

// ============================================================================
// 初始化事件綁定 (Event Listeners Binding)
// ============================================================================
startBtn.addEventListener('click', startPractice);
endEarlyBtn.addEventListener('click', endPractice);
resetBtn.addEventListener('click', resetPractice);

// 結算畫面的打叉(關閉)按紐
closeModalBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    resetPractice();
});

// 網頁初始起手式：建立虛擬鍵盤 DOM
renderKeyboard();
