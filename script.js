/**
 * 설정 변수 (본인의 구글 정보로 수정 필수)
 */
const MAIN_SHEET_CSV = "https://docs.google.com/spreadsheets/d/본인_시트_ID/export?format=csv";
const INCORRECT_SHEET_CSV = "https://docs.google.com/spreadsheets/d/본인_시트_ID/export?format=csv&gid=오답탭ID";
const FORM_URL = "https://docs.google.com/forms/d/e/본인_폼_ID/formResponse";
const ENTRY_WORD = "entry.123456"; // 구글 폼 단어 필드 ID
const ENTRY_MEANING = "entry.789012"; // 구글 폼 뜻 필드 ID

let wordsData = {}; // Day별 단어 저장 객체
let incorrectWords = []; // 불러온 오답 리스트
let currentQuizList = []; // 현재 시험 중인 단어들
let currentIndex = 0;
let isTestMode = false;

/**
 * 1. 데이터 로딩 (구글 시트에서 가져오기)
 */
async function loadMainData() {
    try {
        const response = await fetch(MAIN_SHEET_CSV);
        const csvText = await response.text();
        parseMainCSV(csvText);
        console.log("메인 데이터 로드 완료");
    } catch (err) {
        alert("데이터를 불러오는데 실패했습니다. URL을 확인하세요.");
    }
}

function parseMainCSV(text) {
    const lines = text.split('\n').slice(1); // 첫 줄(헤더) 제외
    wordsData = {};
    lines.forEach(line => {
        // CSV 파싱 (쉼표 구분)
        const [day, word, meanings] = line.split(',').map(item => item?.trim());
        if (day && word && meanings) {
            if (!wordsData[day]) wordsData[day] = [];
            wordsData[day].push({ word, meanings: meanings.split('|').map(m => m.trim()) });
        }
    });
}

/**
 * 2. 퀴즈 엔진 로직
 */
function startMode(mode) {
    const day = document.getElementById('test-day').value;
    if (!wordsData[day]) return alert("해당 Day의 데이터가 없습니다.");
    
    currentQuizList = [...wordsData[day]].sort(() => Math.random() - 0.5);
    isTestMode = (mode === 'test');
    initQuiz();
}

function startTotalRandomTest() {
    currentQuizList = Object.values(wordsData).flat().sort(() => Math.random() - 0.5);
    if (currentQuizList.length === 0) return alert("데이터가 비어있습니다.");
    isTestMode = true;
    initQuiz();
}

function initQuiz() {
    currentIndex = 0;
    showSection('practice');
    document.getElementById('quiz-container').classList.remove('hidden');
    showNextQuestion();
}

function showNextQuestion() {
    if (currentIndex >= currentQuizList.length) {
        alert("학습이 끝났습니다!");
        document.getElementById('quiz-container').classList.add('hidden');
        return;
    }
    const q = currentQuizList[currentIndex];
    document.getElementById('display-word').innerText = q.word;
    document.getElementById('user-answer').value = '';
    document.getElementById('user-answer').focus();
    document.getElementById('feedback').innerText = '';
    document.getElementById('progress').innerText = `${currentIndex + 1} / ${currentQuizList.length}`;
}

/**
 * 3. 정답 확인 및 오답 전송 (핵심 기능)
 */
function checkAnswer() {
    const userAns = document.getElementById('user-answer').value.trim();
    const currentWord = currentQuizList[currentIndex];
    const isCorrect = currentWord.meanings.includes(userAns);

    if (isCorrect) {
        document.getElementById('feedback').innerText = "✅ 정답!";
        document.getElementById('feedback').style.color = "green";
    } else {
        const correctStr = currentWord.meanings.join(', ');
        document.getElementById('feedback').innerText = `❌ 틀림 (정답: ${correctStr})`;
        document.getElementById('feedback').style.color = "red";
        
        // 테스트 모드일 때만 구글 폼으로 오답 전송 (클라우드 저장)
        if (isTestMode) {
            sendToGoogleForm(currentWord.word, correctStr);
        }
    }

    // 1.5초 후 다음 문제로
    setTimeout(() => {
        currentIndex++;
        showNextQuestion();
    }, 1500);
}

// 구글 폼으로 데이터 쏘기 (공용컴퓨터 저장 대용)
function sendToGoogleForm(word, meaning) {
    const formData = new FormData();
    formData.append(ENTRY_WORD, word);
    formData.append(ENTRY_MEANING, meaning);

    fetch(FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
    }).catch(e => console.error("오답 저장 실패"));
}

/**
 * 4. 유틸리티 함수
 */
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${id}-section`).classList.remove('hidden');
}

function handleKeyPress(e) {
    if (e.key === 'Enter') checkAnswer();
}

// 페이지 시작 시 데이터 로드
window.onload = loadMainData;
