const API_URL = "https://script.google.com/macros/s/AKfycbypOEVw05FCW7l2RWP9GO__9Zqy1ScPegAXjJSFSIFuxLBwsDI1KKbOOPzsriSd1ugn/exec"; 

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1L2G6ziJM4XaljIm4EfdvR-ZrnjR8Ap-q-17yXNxXsdU/edit?usp=sharing";

let vocaData = {};        
let incorrectNotes = [];  
let currentList = [];     
let currentIndex = 0;
let sessionMode = ''; // 'practice_flashcard', 'practice_mcq', 'test', 'random', 'incorrect'

window.onload = syncData;

async function syncData() {
    const btn = document.getElementById('sync-btn');
    btn.innerText = "🔄 동기화 중...";
    btn.disabled = true;
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        vocaData = {};
        if(data.voca && data.voca.length > 0) {
            data.voca.forEach(row => {
                const [day, word, meanings] = row;
                if(!vocaData[day]) vocaData[day] = [];
                vocaData[day].push({ word, meanings: String(meanings).split(',').map(m => m.trim()) });
            });
        }
        if(data.incorrect && data.incorrect.length > 0) {
            incorrectNotes = data.incorrect.map(row => ({ word: row[0], meanings: String(row[1]).split(',').map(m => m.trim()) }));
        } else {
            incorrectNotes = [];
        }
        renderReviewStatus();
        alert("데이터 동기화 완료!");
    } catch (e) {
        alert("데이터 동기화 실패. URL을 확인하세요.");
    } finally {
        btn.innerText = "🔄 동기화";
        btn.disabled = false;
    }
}

function startSession(mode) {
    const day = document.getElementById('target-day').value;

    if (mode === 'practice') {
        if (!vocaData[day] || vocaData[day].length === 0) return alert("해당 Day의 단어가 없습니다.");
        currentList = [...vocaData[day]];
        sessionMode = 'practice_flashcard'; // 연습 1단계 시작
    } 
    else if (mode === 'test') {
        if (!vocaData[day] || vocaData[day].length === 0) return alert("해당 Day의 단어가 없습니다.");
        currentList = [...vocaData[day]];
        sessionMode = 'test';
    } 
    else if (mode === 'random') {
        const allWords = Object.values(vocaData).flat();
        if (allWords.length === 0) return alert("저장된 단어가 없습니다.");
        currentList = allWords.sort(() => Math.random() - 0.5).slice(0, 30);
        sessionMode = 'test'; // 랜덤은 주관식 테스트
    } 
    else if (mode === 'incorrect') {
        if (incorrectNotes.length === 0) return alert("저장된 오답이 없습니다.");
        currentList = [...incorrectNotes];
        sessionMode = 'test'; // 오답도 주관식 테스트
    }

    if (sessionMode !== 'test' && mode !== 'random') currentList.sort(() => Math.random() - 0.5);
    
    currentIndex = 0;
    showSection('main', document.querySelector('.nav-btn'));
    
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.classList.remove('hidden', 'fade-in');
    void quizContainer.offsetWidth; 
    quizContainer.classList.add('fade-in');
    
    showQuestion();
}

/** 문제 화면 그리기 (모드에 따라 UI 분기) */
function showQuestion() {
    // 현재 페이즈가 끝났을 때
    if (currentIndex >= currentList.length) {
        // 플래시카드가 끝나면 객관식으로 자동 전환
        if (sessionMode === 'practice_flashcard') {
            alert("플래시카드 학습 완료! 이어서 4지 선다 객관식 연습을 시작합니다.");
            sessionMode = 'practice_mcq';
            currentIndex = 0;
            currentList.sort(() => Math.random() - 0.5); // 리스트 다시 섞기
            showQuestion();
            return;
        } else {
            alert("🎉 모든 학습/테스트가 끝났습니다! 수고하셨습니다.");
            document.getElementById('quiz-container').classList.add('hidden');
            return;
        }
    }

    const q = currentList[currentIndex];
    clearFeedback();

    // 프로그레스 바 업데이트
    const progressPercent = ((currentIndex + 1) / currentList.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').innerText = `${currentIndex + 1} / ${currentList.length}`;

    // UI 컨트롤
    document.getElementById('flashcard-ui').classList.add('hidden');
    document.getElementById('mcq-ui').classList.add('hidden');
    document.getElementById('subjective-ui').classList.add('hidden');

    const badge = document.getElementById('mode-badge');

    if (sessionMode === 'practice_flashcard') {
        badge.innerText = "연습 1단계: 플래시카드";
        document.getElementById('flashcard-ui').classList.remove('hidden');
        document.querySelector('.flashcard').classList.remove('flipped');
        document.getElementById('fc-word').innerText = q.word;
        document.getElementById('fc-meaning').innerText = q.meanings.join(', ');
    } 
    else if (sessionMode === 'practice_mcq') {
        badge.innerText = "연습 2단계: 객관식";
        document.getElementById('mcq-ui').classList.remove('hidden');
        document.getElementById('mcq-word').innerText = q.word;
        generateMCQOptions(q);
    } 
    else {
        badge.innerText = "실전 테스트 (주관식)";
        document.getElementById('subjective-ui').classList.remove('hidden');
        document.getElementById('display-word').innerText = q.word;
        const inputEl = document.getElementById('user-answer');
        inputEl.value = '';
        inputEl.disabled = false;
        document.getElementById('submit-btn').disabled = false;
        inputEl.focus();
    }
}

/** 플래시카드 뒤집기 및 다음 */
function flipCard() {
    document.querySelector('.flashcard').classList.toggle('flipped');
}
function nextFlashcard() {
    currentIndex++;
    showQuestion();
}

/** 객관식 보기 생성기 */
function generateMCQOptions(correctWordObj) {
    const optionsContainer = document.getElementById('mcq-options');
    optionsContainer.innerHTML = '';

    let allMeaningsList = [...new Set(Object.values(vocaData).flat().map(w => w.meanings.join(', ')))];
    const correctMeaning = correctWordObj.meanings.join(', ');
    
    let options = [correctMeaning];
    let attempts = 0;

    // 랜덤 오답 3개 뽑기
    while (options.length < 4 && attempts < 100) {
        let randomMeaning = allMeaningsList[Math.floor(Math.random() * allMeaningsList.length)];
        if (!options.includes(randomMeaning)) options.push(randomMeaning);
        attempts++;
    }
    // 데이터가 부족할 경우 예외 처리
    while (options.length < 4) options.push("오답 " + options.length);

    // 섞어서 버튼 렌더링
    options.sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'mcq-btn';
        btn.innerText = opt;
        btn.onclick = () => checkMCQ(btn, opt === correctMeaning, correctMeaning);
        optionsContainer.appendChild(btn);
    });
}

/** 객관식 정답 체크 */
function checkMCQ(btn, isCorrect, correctMeaning) {
    // 모든 버튼 비활성화
    document.querySelectorAll('.mcq-btn').forEach(b => b.disabled = true);
    
    if (isCorrect) {
        btn.classList.add('correct');
        showFeedback(true, correctMeaning);
    } else {
        btn.classList.add('incorrect');
        // 정답 버튼도 찾아서 초록색으로 칠해줌
        document.querySelectorAll('.mcq-btn').forEach(b => {
            if (b.innerText === correctMeaning) b.classList.add('correct');
        });
        showFeedback(false, correctMeaning);
    }
    setTimeout(() => { currentIndex++; showQuestion(); }, 1800);
}

/** 주관식 정답 체크 */
async function checkSubjective() {
    const inputEl = document.getElementById('user-answer');
    const userAns = inputEl.value.trim();
    if (!userAns) return; 

    const currentWord = currentList[currentIndex];
    const isCorrect = currentWord.meanings.includes(userAns);
    const allMeanings = currentWord.meanings.join(', ');

    inputEl.disabled = true;
    document.getElementById('submit-btn').disabled = true;

    showFeedback(isCorrect, allMeanings);

    if (!isCorrect) {
        const isAlreadyIncorrect = incorrectNotes.some(item => item.word === currentWord.word);
        if (!isAlreadyIncorrect) {
            await sendToSheet(currentWord.word, allMeanings);
            incorrectNotes.push(currentWord); 
            renderReviewStatus(); 
        }
    }
    setTimeout(() => { currentIndex++; showQuestion(); }, 1800);
}

/** 피드백 공통 함수 */
function showFeedback(isCorrect, meaningStr) {
    const feedbackEl = document.getElementById('feedback');
    if (isCorrect) {
        feedbackEl.innerText = `✅ 정답!\n[뜻: ${meaningStr}]`;
        feedbackEl.className = 'feedback-correct';
    } else {
        feedbackEl.innerText = `❌ 오답!\n[정답: ${meaningStr}]`;
        feedbackEl.className = 'feedback-incorrect';
    }
}
function clearFeedback() {
    document.getElementById('feedback').className = ''; 
    document.getElementById('feedback').innerText = '';
}

/** 구글 시트 저장 통신 */
async function sendToSheet(word, meaning) {
    try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ word, meaning }) }); } 
    catch (e) { console.error("오답 저장 실패", e); }
}

/** 유틸리티 */
function showSection(id, btnElement) {
    document.querySelectorAll('main > section').forEach(s => { s.classList.add('hidden'); s.classList.remove('fade-in'); });
    const targetSection = document.getElementById(`${id}-section`);
    targetSection.classList.remove('hidden');
    void targetSection.offsetWidth; 
    targetSection.classList.add('fade-in');

    if(btnElement) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }
}

function renderReviewStatus() {
    const infoEl = document.getElementById('incorrect-info');
    const retryBtn = document.getElementById('btn-retry-incorrect');
    if (infoEl) infoEl.innerText = `현재 쌓인 오답: ${incorrectNotes.length}개`;
    if (retryBtn) retryBtn.disabled = incorrectNotes.length === 0;
}

function handleKeyPress(e) { if (e.key === 'Enter') checkSubjective(); }
