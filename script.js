const API_URL = "https://script.google.com/macros/s/AKfycbypOEVw05FCW7l2RWP9GO__9Zqy1ScPegAXjJSFSIFuxLBwsDI1KKbOOPzsriSd1ugn/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1L2G6ziJM4XaljIm4EfdvR-ZrnjR8Ap-q-17yXNxXsdU/edit?usp=sharing";

let vocaData = {};        
let incorrectNotes = [];  
let currentList = [];     
let currentIndex = 0;
let sessionMode = ''; // 'practice_flashcard', 'practice_mcq', 'test', 'random', 'incorrect'

window.onload = syncData;

/** 1. 구글 시트 데이터 동기화 */
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
        console.error("동기화 에러:", e);
        alert("데이터 동기화 실패. URL을 확인하세요.");
    } finally {
        btn.innerText = "🔄 동기화";
        btn.disabled = false;
    }
}

/** 2. 학습 모드 시작 */
function startSession(mode) {
    const day = document.getElementById('target-day').value;

    if (mode === 'practice') {
        if (!vocaData[day] || vocaData[day].length === 0) return alert("해당 Day의 단어가 없습니다.");
        currentList = [...vocaData[day]];
        sessionMode = 'practice_flashcard';
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
        sessionMode = 'test'; 
    } 
    else if (mode === 'incorrect') {
        if (incorrectNotes.length === 0) return alert("저장된 오답이 없습니다.");
        currentList = [...incorrectNotes];
        sessionMode = 'test'; 
    }

    if (sessionMode !== 'test' && mode !== 'random') currentList.sort(() => Math.random() - 0.5);
    
    currentIndex = 0;
    showSection('main', document.querySelector('.nav-btn'));
    
    // 퀴즈 렌더링 강제 업데이트(애니메이션 용)
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.classList.remove('hidden', 'fade-in');
    void quizContainer.offsetWidth; 
    quizContainer.classList.add('fade-in');
    
    showQuestion();
}

/** 3. 화면 UI 렌더링 분기 */
function showQuestion() {
    if (currentIndex >= currentList.length) {
        if (sessionMode === 'practice_flashcard') {
            alert("1단계 학습 완료! 이어서 객관식 연습을 시작합니다.");
            sessionMode = 'practice_mcq';
            currentIndex = 0;
            currentList.sort(() => Math.random() - 0.5);
            showQuestion();
            return;
        } else {
            alert("🎉 모든 테스트가 끝났습니다! 수고하셨습니다.");
            document.getElementById('quiz-container').classList.add('hidden');
            return;
        }
    }

    const q = currentList[currentIndex];
    clearFeedback();

    // 프로그레스 바 작동 로직
    const progressPercent = ((currentIndex + 1) / currentList.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').innerText = `${currentIndex + 1} / ${currentList.length}`;

    // UI 컨테이너 제어
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

/** 4-1. 플래시카드 뒤집기 및 스포일러 완벽 방지 */
function flipCard() {
    document.querySelector('.flashcard').classList.toggle('flipped');
}

function nextFlashcard() {
    const card = document.querySelector('.flashcard');
    const nextBtn = document.querySelector('#flashcard-ui button'); // 다음 단어 버튼
    
    // 카드가 뒤집혀(뜻이 보이는) 상태라면?
    if (card.classList.contains('flipped')) {
        // 1. 카드가 돌아가는 동안 '다음' 버튼을 또 누르지 못하게 잠금
        nextBtn.disabled = true;
        
        // 2. 카드를 앞면(영단어)으로 부드럽게 다시 뒤집기 시작
        card.classList.remove('flipped');
        
        // 3. 카드가 완전히 앞면으로 돌아온 후(0.5초 뒤)에 단어 교체
        setTimeout(() => {
            currentIndex++;
            showQuestion();
            nextBtn.disabled = false; // 버튼 잠금 해제
        }, 500); 
        
    } else {
        // 카드가 이미 앞면(영단어)이라면 대기할 필요 없이 즉시 넘김
        currentIndex++;
        showQuestion();
    }
}

/** 4-2. 객관식 오답 생성 및 정답 체크 */
function generateMCQOptions(correctWordObj) {
    const optionsContainer = document.getElementById('mcq-options');
    optionsContainer.innerHTML = '';

    let allMeaningsList = [...new Set(Object.values(vocaData).flat().map(w => w.meanings.join(', ')))];
    const correctMeaning = correctWordObj.meanings.join(', ');
    
    let options = [correctMeaning];
    let attempts = 0;

    while (options.length < 4 && attempts < 100) {
        let randomMeaning = allMeaningsList[Math.floor(Math.random() * allMeaningsList.length)];
        if (!options.includes(randomMeaning)) options.push(randomMeaning);
        attempts++;
    }
    while (options.length < 4) options.push("오답 " + options.length);

    options.sort(() => Math.random() - 0.5).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'mcq-btn';
        btn.innerText = opt;
        btn.onclick = () => checkMCQ(btn, opt === correctMeaning, correctMeaning);
        optionsContainer.appendChild(btn);
    });
}

function checkMCQ(btn, isCorrect, correctMeaning) {
    document.querySelectorAll('.mcq-btn').forEach(b => b.disabled = true);
    
    if (isCorrect) {
        btn.classList.add('correct');
        showFeedback(true, correctMeaning);
    } else {
        btn.classList.add('incorrect');
        document.querySelectorAll('.mcq-btn').forEach(b => {
            if (b.innerText === correctMeaning) b.classList.add('correct');
        });
        showFeedback(false, correctMeaning);
    }
    setTimeout(() => { currentIndex++; showQuestion(); }, 1800);
}

/** 4-3. 주관식 정답 체크 */
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
    setTimeout(() => { currentIndex++; showQuestion(); }, 2000);
}

/** 5. 구글 시트로 데이터 쓰기 (no-cors 적용) */
async function sendToSheet(word, meaning) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({ word, meaning })
        });
        console.log("오답 전송 완료 (no-cors)");
    } catch (e) {
        console.error("오답 저장 실패", e);
    }
}

/** 6. 기타 유틸리티 */
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

function showSection(id, btnElement) {
    document.querySelectorAll('main > section').forEach(s => { 
        s.classList.add('hidden'); 
        s.classList.remove('fade-in'); 
    });
    
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
