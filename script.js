let interviewData = null;
let currentQuestion = null;
let repeatCount = 0;
let spanishWarningCount = 0;
let offTopicWarningCount = 0;
let slowModeEnabled = false;
let protectedFeedback = false;

const idleImage = document.getElementById("idleImage");
const emilyVideo = document.getElementById("emilyVideo");
const studentAnswer = document.getElementById("studentAnswer");
const feedbackMessage = document.getElementById("feedbackBox");

const speakBtn = document.getElementById("speakBtn");
const repeatBtn = document.getElementById("repeatBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");

const menuBtn = document.getElementById("menuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const menuOverlay = document.getElementById("menuOverlay");

const hintBtn = document.getElementById("hintBtn");
const modelAnswerBtn = document.getElementById("modelAnswerBtn");
const slowModeBtn = document.getElementById("slowModeBtn");

emilyVideo.playsInline = true;

fetch("interview-flow.json")
  .then(response => response.json())
  .then(data => {
    interviewData = data;
    loadIdle();
  })
  .catch(error => {
    console.error("JSON loading error:", error);
    feedbackMessage.textContent = "Error loading interview.";
  });

function loadIdle() {
  currentQuestion = null;
  protectedFeedback = false;

  feedbackMessage.textContent = "Click ➡️ to start when you are ready.";

  if (speakBtn) speakBtn.disabled = true;

  idleImage.src = interviewData.assets.idle.url;
  idleImage.style.display = "block";
  idleImage.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.removeAttribute("src");
  emilyVideo.load();
  emilyVideo.style.display = "none";
  emilyVideo.classList.add("hidden");

  nextBtn.querySelector("span").textContent = "Start";
  setActiveAction("nextBtn");
}

function startInterview() {
  currentQuestion = interviewData.interview.questions[0];
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;
  protectedFeedback = false;

  if (speakBtn) speakBtn.disabled = false;

  studentAnswer.value = "";
  feedbackMessage.textContent = "Listen to Emily first.";

  playAsset(interviewData.assets.intro, function () {
    playQuestionVideo();
  });

  nextBtn.querySelector("span").textContent = "Next";
}

function playQuestionVideo() {
  if (!currentQuestion) return;

  protectedFeedback = false;
  feedbackMessage.textContent = currentQuestion.prompt;

  playAsset(currentQuestion.video);

  setActiveAction("submitBtn");
}

function setActiveAction(buttonId) {
  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.classList.remove("active-action");
  });

  const activeBtn = document.getElementById(buttonId);
  if (activeBtn) {
    activeBtn.classList.add("active-action");
  }
}

function playAsset(asset, onEndedCallback = null) {
  if (!asset || !asset.url) return;

  idleImage.style.display = "none";
  idleImage.classList.add("hidden");

  emilyVideo.style.display = "block";
  emilyVideo.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.src = asset.url;
  emilyVideo.currentTime = 0;
  emilyVideo.muted = false;
  emilyVideo.volume = 1;
  emilyVideo.playbackRate = slowModeEnabled ? 0.75 : 1;
  emilyVideo.load();

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
    feedbackMessage.textContent =
      currentQuestion.repeat.onLimitReached?.message ||
      "You have reached the repeat limit for this question.";
    return;
  }

  playQuestionVideo();
}

function submitAnswer() {
  if (!currentQuestion) return;

  const answer = studentAnswer.value.trim();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

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

  protectedFeedback = feedbackKey === "partial_answer";

  if (feedbackKey === "partial_answer") {
    studentAnswer.value = "";
  }

  playFeedback(feedbackKey);

  if (
    feedbackKey === "good_answer" ||
    feedbackKey === "excellent_answer"
  ) {
    setTimeout(() => {
      nextStep();
    }, 3500);
  }
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

  protectedFeedback = true;
  playFeedback("hint_requested");
}

function showModelAnswer() {
  if (!currentQuestion) return;

  const model =
    currentQuestion.modelAnswers?.[0] ||
    currentQuestion.exampleAnswer ||
    "I am interested in working as a legal advisor.";

  feedbackMessage.textContent = `Model answer: "${model}"`;
  protectedFeedback = true;
  studentAnswer.value = "";

  playFeedback("modeling_requested");
}

function nextStep() {
  feedbackMessage.textContent = "Interview finished. Great job!";

  setActiveAction("nextBtn");

  playAsset(interviewData.assets.finish, function () {
    loadIdle();
  });
}

/* SPEECH RECOGNITION */

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
    if (!protectedFeedback) {
      feedbackMessage.textContent = "Emily is listening...";
    }

    speakBtn.textContent = "🎙 Listening...";
    recognition.start();
  });

  recognition.onresult = event => {
    const spokenText = event.results[0][0].transcript;
    studentAnswer.value += " " + spokenText;

    if (!protectedFeedback) {
      feedbackMessage.textContent = "Speech captured. You can submit your answer.";
    }

    speakBtn.textContent = "🎤 Speak";
  };

  recognition.onerror = () => {
    feedbackMessage.textContent =
      "Microphone problem. You can type your answer instead.";
    speakBtn.textContent = "🎤 Speak";
  };

  recognition.onend = () => {
    speakBtn.textContent = "🎤 Speak";
  };
}

/* MAIN BUTTONS */

nextBtn.addEventListener("click", () => {
  startInterview();
});

repeatBtn.addEventListener("click", repeatQuestion);
submitBtn.addEventListener("click", submitAnswer);

clearBtn.addEventListener("click", () => {
  studentAnswer.value = "";
  protectedFeedback = false;
  feedbackMessage.textContent = "Answer area cleared.";
});

/* MENU */

menuBtn.addEventListener("click", () => {
  menuOverlay.classList.remove("hidden");
});

closeMenuBtn.addEventListener("click", () => {
  menuOverlay.classList.add("hidden");
});

menuOverlay.addEventListener("click", event => {
  if (event.target === menuOverlay) {
    menuOverlay.classList.add("hidden");
  }
});

hintBtn.addEventListener("click", () => {
  showHint();
  menuOverlay.classList.add("hidden");
});

modelAnswerBtn.addEventListener("click", () => {
  showModelAnswer();
  menuOverlay.classList.add("hidden");
});

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