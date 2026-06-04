let interviewData = null;
let currentQuestion = null;
let repeatCount = 0;
let spanishWarningCount = 0;
let offTopicWarningCount = 0;

const idleImage = document.getElementById("idleImage");
const emilyVideo = document.getElementById("emilyVideo");
emilyVideo.playsInline = true;

const questionText = document.getElementById("questionText");
const studentAnswer = document.getElementById("studentAnswer");
const feedbackMessage = document.getElementById("feedbackMessage");
const subtitleBox = document.getElementById("subtitleBox");
const captionText = document.getElementById("captionText");
const systemBanner = document.getElementById("systemBanner");
const progressLabel = document.getElementById("progressLabel");
const captionMode = document.getElementById("captionMode");

const speakBtn = document.getElementById("speakBtn");
const startBtn = document.getElementById("startBtn");
const repeatBtn = document.getElementById("repeatBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");

fetch("interview-flow.json")
  .then(response => response.json())
  .then(data => {
    interviewData = data;
    loadIdle();
  })
  .catch(error => {
    console.error("JSON loading error:", error);
    questionText.textContent = "Error loading interview.";
  });

function loadIdle() {
  progressLabel.textContent = "Progress: 0 / 1";
  questionText.textContent = "Welcome to Emily's Interview Coach";
  subtitleBox.textContent = "Click Start Interview when you are ready.";
  captionText.textContent = "Emily will ask you one short job interview question.";
  feedbackMessage.textContent = "Waiting to start...";
  systemBanner.classList.add("hidden");
  speakBtn.disabled = true;

  idleImage.src = interviewData.assets.idle.url;
  idleImage.style.display = "block";
  idleImage.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.removeAttribute("src");
  emilyVideo.load();
  emilyVideo.style.display = "none";
  emilyVideo.classList.add("hidden");
}

function startInterview() {
  currentQuestion = interviewData.interview.questions[0];
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;

  speakBtn.disabled = false;
  progressLabel.textContent = "Progress: 1 / 1";
  questionText.textContent = "Introduction";
  studentAnswer.value = "";
  feedbackMessage.textContent = "Listen to Emily first.";
  systemBanner.classList.add("hidden");

  playAsset(interviewData.assets.intro, function () {
    playQuestionVideo();
  });
}

function playQuestionVideo() {
  if (!currentQuestion) return;

  questionText.textContent = currentQuestion.prompt;
  feedbackMessage.textContent = "Waiting for your answer...";
  playAsset(currentQuestion.video);
}

function playAsset(asset, onEndedCallback = null) {
  if (!asset || !asset.url) return;

  idleImage.style.display = "none";
  emilyVideo.style.display = "block";
  emilyVideo.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.src = asset.url;
  emilyVideo.currentTime = 0;
  emilyVideo.muted = false;
  emilyVideo.volume = 1;
  emilyVideo.playbackRate = slowModeEnabled ? 0.75 : 1;
  emilyVideo.load();

  subtitleBox.textContent = asset.subtitle || "";
  updateCaptions(asset);

  emilyVideo.onended = function () {
    if (onEndedCallback) onEndedCallback();
  };

  emilyVideo.play().catch(error => {
    console.warn("Video autoplay blocked or failed:", error);
  });
}

function repeatQuestion() {
  if (!currentQuestion || !currentQuestion.repeat?.allowed) return;

  repeatCount++;

  if (repeatCount > currentQuestion.repeat.limit) {
    systemBanner.textContent =
      currentQuestion.repeat.onLimitReached?.message ||
      "You have reached the repeat limit for this question.";
    systemBanner.classList.remove("hidden");
    return;
  }

  systemBanner.classList.add("hidden");
  playQuestionVideo();
}

function submitAnswer() {
  if (!currentQuestion) return;

  const answer = studentAnswer.value.trim();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  systemBanner.classList.add("hidden");

  if (answer.length === 0) {
    showFeedback("empty_answer");
    return;
  }

  if (containsProfanity(answer)) {
    showFeedback("profanity_detected");
    return;
  }

  if (containsSpanish(answer)) {
    spanishWarningCount++;

    if (spanishWarningCount === 1) {
      showFeedback("spanish_detected_first_time", "spanish_detected");
    } else {
      showFeedback("spanish_detected_second_time", "spanish_detected");
    }

    return;
  }

  if (wordCount < currentQuestion.studentInput.minWords) {
    showFeedback("too_short");
    return;
  }

  if (isGoodAnswer(answer)) {
    showFeedback("good_answer");
    return;
  }

  if (isPartialAnswer(answer)) {
    showFeedback("partial_answer");
    return;
  }

  showFeedback("needs_improvement");
}

function showFeedback(feedbackKey, textKey = null) {
  const messageKey = textKey || feedbackKey;

  feedbackMessage.textContent =
    currentQuestion.feedbackText?.[messageKey] ||
    "Please try again.";

  playFeedback(feedbackKey);
}

function playFeedback(feedbackKey) {
  const assetKey = currentQuestion.feedbackMap?.[feedbackKey];
  const asset = interviewData.assets?.[assetKey];

  if (!asset) {
    console.warn("Missing feedback asset:", feedbackKey);
    return;
  }

  playAsset(asset);
}

function isGoodAnswer(text) {
  const lowerText = normalizeText(text);

  const hasPattern = currentQuestion.acceptablePatterns?.some(pattern =>
    lowerText.includes(pattern)
  );

  const hasKeyword = currentQuestion.keywords?.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  return hasPattern && hasKeyword;
}

function isPartialAnswer(text) {
  const lowerText = normalizeText(text);

  const hasKeyword = currentQuestion.keywords?.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  const hasSomeStructure =
    lowerText.includes("interested") ||
    lowerText.includes("work") ||
    lowerText.includes("job") ||
    lowerText.includes("position");

  return hasKeyword || hasSomeStructure;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsSpanish(text) {
  const spanishWords = [
    "quiero",
    "trabajo",
    "puesto",
    "porque",
    "necesito",
    "me interesa",
    "estoy interesado",
    "estoy interesada",
    "empresa",
    "gracias",
    "hola",
    "sí",
    "para",
    "abogado",
    "contador",
    "administrador"
  ];

  const lowerText = text.toLowerCase();

  return spanishWords.some(word => lowerText.includes(word));
}

function containsProfanity(text) {
  const bannedWords =
    interviewData.globalValidation?.profanityList || [
      "fuck",
      "fucking",
      "shit",
      "bitch",
      "asshole",
      "damn"
    ];

  const lowerText = text.toLowerCase();

  return bannedWords.some(word => lowerText.includes(word));
}

function showHint() {
  if (!currentQuestion) return;

  feedbackMessage.textContent =
    currentQuestion.feedbackText?.hint_requested ||
    currentQuestion.hint ||
    "Use a complete sentence.";

  playFeedback("hint_requested");
}

function showModelAnswer() {
  if (!currentQuestion) return;

  const model =
    currentQuestion.modelAnswers?.[0] ||
    currentQuestion.exampleAnswer ||
    "I am interested in working as a legal advisor.";

  feedbackMessage.textContent = `Model answer: "${model}"`;
  playFeedback("modeling_requested");
}

function nextStep() {
  questionText.textContent = "Interview finished";
  feedbackMessage.textContent = "Session complete.";
  captionText.textContent = "You completed the first interview question.";
  systemBanner.classList.add("hidden");

  playAsset(interviewData.assets.finish, function () {
    loadIdle();
  });
}

function updateCaptions(asset = null) {
  if (!captionMode) return;

  const mode = captionMode.value;

  const activeSubtitle =
    asset?.subtitle ||
    currentQuestion?.video?.subtitle ||
    currentQuestion?.prompt ||
    "";

  if (mode === "none") {
    captionText.textContent = "";
  } else if (mode === "key") {
    captionText.textContent = currentQuestion?.prompt || activeSubtitle;
  } else if (mode === "full") {
    captionText.textContent = activeSubtitle;
  }
}

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  speakBtn.disabled = true;
  speakBtn.textContent = "Speech not supported";
} else {
  const recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  speakBtn.addEventListener("click", () => {
    feedbackMessage.textContent = "Listening... please speak now.";
    speakBtn.textContent = "🎙 Listening...";
    recognition.start();
  });

  recognition.onresult = event => {
    const spokenText = event.results[0][0].transcript;
    studentAnswer.value += " " + spokenText;
    feedbackMessage.textContent = "Speech captured. You can submit your answer.";
    speakBtn.textContent = "🎙 Speak Now";
  };

  recognition.onerror = () => {
    feedbackMessage.textContent =
      "Microphone problem. You can type your answer instead.";
    speakBtn.textContent = "🎙 Speak Now";
  };

  recognition.onend = () => {
    speakBtn.textContent = "🎙 Speak Now";
  };
}

startBtn.addEventListener("click", startInterview);
repeatBtn.addEventListener("click", repeatQuestion);
submitBtn.addEventListener("click", submitAnswer);
nextBtn.addEventListener("click", nextStep);

captionMode.addEventListener("change", function () {
  updateCaptions();
});

// =========================
// MENU BUTTONS
// =========================

const clearBtn = document.getElementById("clearBtn");
const hintBtn = document.getElementById("hintBtn");
const modelAnswerBtn = document.getElementById("modelAnswerBtn");
const slowModeBtn = document.getElementById("slowModeBtn");

let slowModeEnabled = false;

// CLEAR
clearBtn.addEventListener("click", () => {
  studentAnswer.value = "";
  feedbackMessage.textContent = "Answer area cleared.";
});

// HINT
hintBtn.addEventListener("click", () => {
  showHint();
});

// MODEL ANSWER
modelAnswerBtn.addEventListener("click", () => {
  showModelAnswer();
});

// SLOW MODE
slowModeBtn.addEventListener("click", () => {
  slowModeEnabled = !slowModeEnabled;

  if (slowModeEnabled) {
    emilyVideo.playbackRate = 0.75;
    feedbackMessage.textContent = "Slow mode activated.";
    slowModeBtn.textContent = "Slow mode ON";
  } else {
    emilyVideo.playbackRate = 1;
    feedbackMessage.textContent = "Slow mode deactivated.";
    slowModeBtn.textContent = "Slow mode";
  }
});