/**
 * [설정] 구글 배포 후 받은 URL과 시트 주소를 입력하세요.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbypOEVw05FCW7l2RWP9GO__9Zqy1ScPegAXjJSFSIFuxLBwsDI1KKbOOPzsriSd1ugn/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1L2G6ziJM4XaljIm4EfdvR-ZrnjR8Ap-q-17yXNxXsdU/edit?usp=sharing";

let vocaData = {};        // Day별 단어 데이터
let incorrectNotes = [];  // 오답 데이터
let currentList = [];     // 현재 시험 리스트
let currentIndex = 0;
let sessionMode = '';

// 페이지 로드 시 데이터 동기화
window.onload = syncData;

/** 1. 구글 시트와 데이터 동기화 */
async function syncData() {
    const btn = document.getElementById('sync-btn');
    btn.innerText = "🔄 로딩 중...";
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // 데이터 구조화 (Day별로 묶기)
        vocaData = {};
        data.voca.forEach(row => {
            const [day, word, meanings] = row;
            if(!vocaData[day]) vocaData[day] = [];
            vocaData[day].push({ 
                word, 
                meanings: String(meanings).split(',').map(m => m.trim()) 
            });
        });

        incorrectNotes = data.incorrect.map(row => ({
            word: row[0],
            meanings: String(row[1]).split(',').map(m => m.trim())
        }));

        alert("동기화 완료!");
        renderReviewStatus();
    } catch (e) {
        console.error(e);
        alert("데이터를 불러오지 못했습니다. URL을 확인하세요.");
    } finally {
        btn.innerText = "🔄 데이터 동기화";
    }
}

/** 2. 시험 시작 */
function startSession(mode) {
    sessionMode = mode;
    const day = document.getElementById('target-day').value;

    if (mode === 'practice' || mode === 'test') {
        if (!vocaData[day]) return alert("해당 Day가 없습니다.");
        currentList = [...vocaData[day]];
    } else if (mode === 'random') {
        currentList = Object.values(vocaData).flat();
    } else if (mode === 'incorrect') {
        currentList = [...incorrectNotes];
    }

    if (currentList.length === 0) return alert("문제가 없습니다.");

    currentList.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    document.getElementById('quiz-container').classList.remove('hidden');
    showQuestion();
}

/** 3. 문제 표시 */
function showQuestion() {
    if (currentIndex >= currentList.length) {
        alert("세션 종료!");
        document.getElementById('quiz-container').classList.add('hidden');
        return;
    }
    const q = currentList[currentIndex];
    document.getElementById('display-word').innerText = q.word;
    document.getElementById('user-answer').value = '';
    document.getElementById('user-answer').focus();
    document.getElementById('progress').innerText = `${currentIndex + 1} / ${currentList.length}`;
}

/** 4. 정답 확인 및 오답 서버 전송 */
async function checkAnswer() {
    const userAns = document.getElementById('user-answer').value.trim();
    const currentWord = currentList[currentIndex];
    const isCorrect = currentWord.meanings.includes(userAns);
    const feedbackEl = document.getElementById('feedback');

    if (isCorrect) {
        feedbackEl.innerText = "✅ 정답!";
        feedbackEl.style.color = "green";
    } else {
        feedbackEl.innerText = `❌ 오답 (정답: ${currentWord.meanings[0]})`;
        feedbackEl.style.color = "red";

        // 테스트 모드일 때만 구글 시트로 오답 전송
        if (['test', 'random'].includes(sessionMode)) {
            await sendToSheet(currentWord.word, currentWord.meanings.join(', '));
        }
    }

    setTimeout(() => {
        currentIndex++;
        showQuestion();
        feedbackEl.innerText = "";
    }, 1200);
}

/** 5. [핵심] 구글 시트로 데이터 쓰기 */
async function sendToSheet(word, meaning) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ word, meaning })
        });
        console.log("오답 저장 완료");
    } catch (e) {
        console.error("저장 실패", e);
    }
}

function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${id}-section`).classList.remove('hidden');
}

function renderReviewStatus() {
    document.getElementById('incorrect-info').innerText = `현재 저장된 오답: ${incorrectNotes.length}개`;
    document.getElementById('btn-retry-incorrect').disabled = incorrectNotes.length === 0;
}

function handleKeyPress(e) { if (e.key === 'Enter') checkAnswer(); }
