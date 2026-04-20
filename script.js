const API_URL = "https://script.google.com/macros/s/AKfycbypOEVw05FCW7l2RWP9GO__9Zqy1ScPegAXjJSFSIFuxLBwsDI1KKbOOPzsriSd1ugn/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1L2G6ziJM4XaljIm4EfdvR-ZrnjR8Ap-q-17yXNxXsdU/edit?usp=sharing";

let vocaData = {};        
let incorrectNotes = [];  
let currentList = [];     
let currentIndex = 0;
let sessionMode = '';

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
                vocaData[day].push({ 
                    word, 
                    meanings: String(meanings).split(',').map(m => m.trim()) 
                });
            });
        }

        if(data.incorrect && data.incorrect.length > 0) {
            incorrectNotes = data.incorrect.map(row => ({
                word: row[0],
                meanings: String(row[1]).split(',').map(m => m.trim())
            }));
        } else {
            incorrectNotes = [];
        }

        renderReviewStatus();
        alert("데이터 동기화 완료!");
    } catch (e) {
        console.error("데이터 동기화 에러:", e);
        alert("데이터를 불러오지 못했습니다. URL 설정을 확인하세요.");
    } finally {
        btn.innerText = "🔄 동기화";
        btn.disabled = false;
    }
}

/** 2. 시험 시작 */
function startSession(mode) {
    sessionMode = mode;
    const day = document.getElementById('target-day').value;

    if (mode === 'practice' || mode === 'test') {
        if (!vocaData[day] || vocaData[day].length === 0) return alert("해당 Day의 단어가 없습니다.");
        currentList = [...vocaData[day]];
    } 
    else if (mode === 'random') {
        const allWords = Object.values(vocaData).flat();
        if (allWords.length === 0) return alert("저장된 단어가 없습니다.");
        currentList = allWords.sort(() => Math.random() - 0.5).slice(0, 30);
    } 
    else if (mode === 'incorrect') {
        if (incorrectNotes.length === 0) return alert("저장된 오답이 없습니다.");
        currentList = [...incorrectNotes];
    }

    if (mode !== 'random') currentList.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    
    // 네비게이션 활성화 처리
    const mainBtn = document.querySelector('.nav-btn');
    showSection('main', mainBtn);
    
    // 퀴즈 컨테이너 애니메이션 강제 재시작 (Reflow 기법)
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.classList.remove('hidden');
    quizContainer.classList.remove('fade-in');
    void quizContainer.offsetWidth; // 브라우저에 렌더링 강제 명령
    quizContainer.classList.add('fade-in');
    
    // 피드백 영역 비우기
    document.getElementById('feedback').className = ''; 
    document.getElementById('feedback').innerText = '';
    
    showQuestion();
}

/** 3. 문제 표시 및 프로그레스 바 작동 로직 수정 */
function showQuestion() {
    if (currentIndex >= currentList.length) {
        alert("🎉 모든 테스트가 끝났습니다! 수고하셨습니다.");
        document.getElementById('quiz-container').classList.add('hidden');
        return;
    }

    const q = currentList[currentIndex];
    document.getElementById('display-word').innerText = q.word;
    
    const inputEl = document.getElementById('user-answer');
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus();
    
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('feedback').innerText = '';
    document.getElementById('feedback').className = '';

    // [핵심 수정] 프로그레스 바가 첫 문제부터 정상적으로 차오르도록 (currentIndex + 1) 적용
    const progressPercent = ((currentIndex + 1) / currentList.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').innerText = `${currentIndex + 1} / ${currentList.length}`;
}

/** 4. 정답 확인 로직 */
async function checkAnswer() {
    const inputEl = document.getElementById('user-answer');
    const userAns = inputEl.value.trim();
    if (!userAns) return; // 빈칸일 때는 반응하지 않음

    const currentWord = currentList[currentIndex];
    const isCorrect = currentWord.meanings.includes(userAns);
    const feedbackEl = document.getElementById('feedback');
    
    inputEl.disabled = true;
    document.getElementById('submit-btn').disabled = true;

    const allMeanings = currentWord.meanings.join(', ');

    if (isCorrect) {
        feedbackEl.innerText = `✅ 정답!\n[뜻: ${allMeanings}]`;
        feedbackEl.className = 'feedback-correct';
    } else {
        feedbackEl.innerText = `❌ 오답!\n[정답: ${allMeanings}]`;
        feedbackEl.className = 'feedback-incorrect';

        if (['test', 'random'].includes(sessionMode)) {
            const isAlreadyIncorrect = incorrectNotes.some(item => item.word === currentWord.word);
            if (!isAlreadyIncorrect) {
                await sendToSheet(currentWord.word, allMeanings);
                incorrectNotes.push(currentWord); 
                renderReviewStatus(); 
            }
        }
    }

    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 2000);
}

/** 5. 구글 API 통신 */
async function sendToSheet(word, meaning) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ word, meaning })
        });
    } catch (e) {
        console.error("오답 저장 실패", e);
    }
}

/** 6. 화면 전환 함수 (애니메이션 초기화 적용) */
function showSection(id, btnElement) {
    document.querySelectorAll('main > section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('fade-in'); 
    });
    
    const targetSection = document.getElementById(`${id}-section`);
    targetSection.classList.remove('hidden');
    void targetSection.offsetWidth; // 브라우저 렌더링 강제 업데이트
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

function handleKeyPress(e) { 
    if (e.key === 'Enter') checkAnswer(); 
}
