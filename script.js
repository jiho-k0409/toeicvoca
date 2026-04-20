/**
 * [설정] 구글 배포 후 받은 웹 앱 URL과 시트 주소
 */
const API_URL = "여기에_구글_배포_URL_입력"; 
const SHEET_URL = "여기에_본인의_구글_시트_주소_입력";

let vocaData = {};        
let incorrectNotes = [];  
let currentList = [];     
let currentIndex = 0;
let sessionMode = '';

// 페이지 로드 시 데이터 동기화
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

/** 2. 시험 시작 (30개 제한 적용) */
function startSession(mode) {
    sessionMode = mode;
    const day = document.getElementById('target-day').value;

    if (mode === 'practice' || mode === 'test') {
        if (!vocaData[day]) return alert("해당 Day의 단어가 없습니다.");
        currentList = [...vocaData[day]];
    } 
    else if (mode === 'random') {
        // [수정됨] 전체 리스트를 섞은 후 최대 30개만 잘라서(slice) 가져옴
        const allWords = Object.values(vocaData).flat();
        if (allWords.length === 0) return alert("저장된 단어가 없습니다.");
        currentList = allWords.sort(() => Math.random() - 0.5).slice(0, 30);
    } 
    else if (mode === 'incorrect') {
        if (incorrectNotes.length === 0) return alert("저장된 오답이 없습니다.");
        currentList = [...incorrectNotes];
    }

    // 퀴즈 화면 초기화
    if(mode !== 'random') currentList.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    
    // 오답 섹션 등에서 시작했더라도 퀴즈가 있는 'main' 섹션으로 화면 강제 전환
    showSection('main', document.querySelector('.nav-btn'));
    
    document.getElementById('quiz-container').classList.remove('hidden');
    document.getElementById('feedback').className = ''; // 피드백 초기화
    document.getElementById('feedback').innerText = '';
    
    showQuestion();
}

/** 3. 문제 표시 */
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
    inputEl.disabled = false; // 입력창 활성화
    inputEl.focus();
    
    document.getElementById('submit-btn').disabled = false; // 버튼 활성화
    document.getElementById('feedback').innerText = '';
    document.getElementById('feedback').className = '';

    // 프로그레스 바 업데이트
    const progressPercent = ((currentIndex) / currentList.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').innerText = `${currentIndex + 1} / ${currentList.length}`;
}

/** 4. 정답 확인 및 오답 서버 전송 (모든 뜻 노출 반영) */
async function checkAnswer() {
    const inputEl = document.getElementById('user-answer');
    const userAns = inputEl.value.trim();
    if (!userAns) return; // 빈칸 방지

    const currentWord = currentList[currentIndex];
    const isCorrect = currentWord.meanings.includes(userAns);
    const feedbackEl = document.getElementById('feedback');
    
    // 더블 클릭/중복 제출 방지
    inputEl.disabled = true;
    document.getElementById('submit-btn').disabled = true;

    // 해당 단어의 모든 뜻 조합
    const allMeanings = currentWord.meanings.join(', ');

    if (isCorrect) {
        feedbackEl.innerText = `✅ 정답!\n[뜻: ${allMeanings}]`;
        feedbackEl.className = 'feedback-correct';
    } else {
        feedbackEl.innerText = `❌ 오답!\n[정답: ${allMeanings}]`;
        feedbackEl.className = 'feedback-incorrect';

        // 테스트/랜덤 모드일 때만 구글 시트로 오답 전송 (중복 체크)
        if (['test', 'random'].includes(sessionMode)) {
            const isAlreadyIncorrect = incorrectNotes.some(item => item.word === currentWord.word);
            if (!isAlreadyIncorrect) {
                await sendToSheet(currentWord.word, allMeanings);
                incorrectNotes.push(currentWord); 
                renderReviewStatus(); 
            }
        }
    }

    // 2초(2000ms) 대기 후 다음 문제로 넘어감 (모든 뜻을 읽을 시간 확보)
    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 2000);
}

/** 5. 구글 시트로 데이터 쓰기 (API 통신) */
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

/** 6. 유틸리티 함수들 */
function showSection(id, btnElement) {
    // 모든 섹션 숨기기
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${id}-section`).classList.remove('hidden');

    // 탭 버튼 활성화 스타일 변경
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
