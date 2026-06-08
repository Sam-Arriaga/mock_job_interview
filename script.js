let interviewData = null;
let currentQuestion = null;
let repeatCount = 0;
let spanishWarningCount = 0; // Legacy counter kept for backward compatibility.
let offTopicWarningCount = 0; // Legacy counter kept for backward compatibility.
let slowModeEnabled = false;
let protectedFeedback = false;

const idleImage = document.getElementById("idleImage");
const emilyVideo = document.getElementById("emilyVideo");
const studentAnswer = document.getElementById("studentAnswer");
const feedbackMessage = document.getElementById("feedbackBox");

const backBtn = document.getElementById("backBtn");
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

const interviewUIState = {
  phase: "before",
  hasSubmittedCurrentAnswer: false,
  isListening: false,
  finalReached: false
};

function setButtonLabel(button, label) {
  if (!button) return;

  const span = button.querySelector("span");

  if (span) {
    span.textContent = label;
  }
}

function setButtonState(button, {
  disabled = false,
  primary = false,
  speakingPrimary = false,
  inactive = false
} = {}) {
  if (!button) return;

  button.disabled = disabled;
  button.classList.toggle("is-primary", primary);
  button.classList.toggle("is-speaking-primary", speakingPrimary);
  button.classList.toggle("is-inactive", inactive);
}

function updateInterviewButtons(phase = "before") {
  interviewUIState.phase = phase;

  [backBtn, clearBtn, speakBtn, submitBtn, nextBtn].forEach(btn => {
    if (!btn) return;

    btn.classList.remove(
      "is-primary",
      "is-speaking-primary",
      "is-inactive",
      "active-action",
      "is-listening"
    );

    btn.disabled = false;
  });

  if (phase === "before") {
    setButtonState(nextBtn, { primary: true });
    setButtonState(speakBtn, { disabled: true, inactive: true });
    setButtonState(backBtn, { disabled: true, inactive: true });
    setButtonState(submitBtn, { disabled: true, inactive: true });
    setButtonState(clearBtn, { inactive: true });

    setButtonLabel(nextBtn, "Start");
    setButtonLabel(speakBtn, "Speak");
  }

  if (phase === "progress") {
    setButtonState(speakBtn, { speakingPrimary: true });
    setButtonState(submitBtn, {});
    setButtonState(backBtn, {});
    setButtonState(clearBtn, {});
    setButtonState(nextBtn, { disabled: true, inactive: true });

    setButtonLabel(nextBtn, "Start");
    setButtonLabel(speakBtn, "Speak");
  }

  if (phase === "final") {
    setButtonState(nextBtn, { primary: true });
    setButtonState(speakBtn, { speakingPrimary: true });
    setButtonState(submitBtn, { disabled: true, inactive: true });
    setButtonState(backBtn, {});
    setButtonState(clearBtn, {});

    setButtonLabel(nextBtn, "Finish");
    setButtonLabel(speakBtn, "Speak");

    interviewUIState.finalReached = true;
  }
}

function setListeningVisualState(isListening) {
  interviewUIState.isListening = isListening;

  if (!speakBtn) return;

  speakBtn.classList.toggle("is-listening", isListening);
  speakBtn.classList.toggle("active-action", isListening);

  setButtonLabel(speakBtn, isListening ? "Listening..." : "Speak");
}

function markAnswerSubmitted() {
  interviewUIState.hasSubmittedCurrentAnswer = true;
}

function resetAnswerSubmissionState() {
  interviewUIState.hasSubmittedCurrentAnswer = false;
}

function setFeedbackText(text) {
  if (!feedbackMessage) return;

  feedbackMessage.classList.add("fade-out");

  setTimeout(() => {
    feedbackMessage.textContent = text;
    feedbackMessage.classList.remove("fade-out");
    feedbackMessage.classList.add("fade-in");

    setTimeout(() => {
      feedbackMessage.classList.remove("fade-in");
    }, 240);
  }, 120);
}

function clearTranscriptBeforeNewSpeech() {
  if (!studentAnswer) return;

  studentAnswer.classList.add("fade-out");

  setTimeout(() => {
    studentAnswer.value = "";
    studentAnswer.classList.remove("fade-out");
    studentAnswer.classList.add("fade-in");

    setTimeout(() => {
      studentAnswer.classList.remove("fade-in");
    }, 220);
  }, 180);
}

/* =========================================================
   CONVERSATIONAL BEHAVIOR ENGINE
   Temporary overlays only.
   Does NOT overwrite hints, captions, modeling answers, or question data.
========================================================= */

const behaviorState = {
  profanityWarningCount: 0,
  spanishWarningCount: 0,
  mediumOffTopicCount: 0,
  strongOffTopicCount: 0,
  terminated: false
};

const BehaviorEngine = (() => {
  const TERMINATION_MESSAGE =
    "Alright, I am stopping the interview here. This session is officially over.";

  const severeHarassmentPatterns = [
    "i hate you",
    "kill yourself",
    "shut up bitch",
    "fuck you",
    "stupid bitch"
  ];

  const mildProfanityPatterns = [
    "fuck",
    "fucking",
    "shit",
    "damn",
    "asshole",
    "bitch"
  ];

  const spanishPatterns = [
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

  const strongOffTopicPatterns = [
    "i do not care",
    "this is stupid",
    "i hate this interview",
    "i don't want to answer",
    "leave me alone"
  ];

  const mediumOffTopicPatterns = [
    "what is your name",
    "are you real",
    "do you have a boyfriend",
    "sing a song",
    "tell me a joke",
    "let's talk about something else"
  ];

  function reset() {
    behaviorState.profanityWarningCount = 0;
    behaviorState.spanishWarningCount = 0;
    behaviorState.mediumOffTopicCount = 0;
    behaviorState.strongOffTopicCount = 0;
    behaviorState.terminated = false;
  }

  function normalize(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/[.,!?;:]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, patterns) {
    return patterns.some(pattern => text.includes(pattern));
  }

  function createResult({
    handled = false,
    severity = "none",
    message = "",
    terminate = false
  } = {}) {
    return {
      handled,
      severity,
      message,
      terminate,
      shouldAdvance: false,
      shouldClearAnswer: false
    };
  }

  function analyze(answer, question) {
    const text = normalize(answer);

    if (!text) {
      return createResult({ handled: false });
    }

    if (includesAny(text, severeHarassmentPatterns)) {
      behaviorState.terminated = true;

      return createResult({
        handled: true,
        severity: "termination",
        message: TERMINATION_MESSAGE,
        terminate: true
      });
    }

    if (includesAny(text, mildProfanityPatterns)) {
      behaviorState.profanityWarningCount++;

      if (behaviorState.profanityWarningCount >= 3) {
        behaviorState.terminated = true;

        return createResult({
          handled: true,
          severity: "termination",
          message: TERMINATION_MESSAGE,
          terminate: true
        });
      }

      return createResult({
        handled: true,
        severity: "mild_profanity",
        message:
          behaviorState.profanityWarningCount === 1
            ? "Please keep your language professional. Let’s continue with the interview question."
            : "This is your second language warning. Please answer respectfully and professionally."
      });
    }

    if (includesAny(text, spanishPatterns)) {
      behaviorState.spanishWarningCount++;

      if (behaviorState.spanishWarningCount >= 3) {
        return createResult({
          handled: true,
          severity: "spanish_strong",
          message:
            "Please answer in English. This is an English interview practice. Try again using a short complete sentence."
        });
      }

      return createResult({
        handled: true,
        severity:
          behaviorState.spanishWarningCount === 1
            ? "spanish_soft"
            : "spanish_medium",
        message:
          behaviorState.spanishWarningCount === 1
            ? "Good effort, but please answer in English. Try again with a simple sentence."
            : "Please stay in English. You can use the Hint or Modeling Answer if you need support."
      });
    }

    if (includesAny(text, strongOffTopicPatterns)) {
      behaviorState.strongOffTopicCount++;

      if (behaviorState.strongOffTopicCount >= 4) {
        behaviorState.terminated = true;

        return createResult({
          handled: true,
          severity: "termination",
          message: TERMINATION_MESSAGE,
          terminate: true
        });
      }

      return createResult({
        handled: true,
        severity: "strong_off_topic",
        message:
          "Let’s stay focused. This is an interview practice. Please answer the current question professionally."
      });
    }

    if (includesAny(text, mediumOffTopicPatterns)) {
      behaviorState.mediumOffTopicCount++;

      return createResult({
        handled: true,
        severity: "medium_off_topic",
        message:
          behaviorState.mediumOffTopicCount >= 2
            ? "Please return to the interview question. Your answer should focus on your professional experience or goals."
            : "That is not part of the interview. Please answer the current question."
      });
    }

    if (isSoftOffTopic(text, question)) {
      return createResult({
        handled: true,
        severity: "soft_off_topic",
        message:
          "Try to connect your answer to the interview question. Give a short professional answer."
      });
    }

    return createResult({ handled: false });
  }

  function isSoftOffTopic(text, question) {
    if (!question) return false;

    const professionalSignals = [
      "job",
      "work",
      "study",
      "career",
      "experience",
      "skills",
      "team",
      "responsible",
      "interested",
      "position",
      "company"
    ];

    const hasProfessionalSignal = professionalSignals.some(signal =>
      text.includes(signal)
    );

    const hasQuestionKeyword = question.keywords?.some(keyword =>
      text.includes(keyword.toLowerCase())
    );

    return !hasProfessionalSignal && !hasQuestionKeyword && text.split(" ").length >= 5;
  }

  function applyResult(result) {
    if (!result || !result.handled) return false;

    protectedFeedback = true;
    setFeedbackText(result.message);
    setListeningVisualState(false);

    if (result.terminate) {
      terminateInterviewByBehavior();
    }

    return true;
  }

  return {
    reset,
    analyze,
    applyResult
  };
})();

function terminateInterviewByBehavior() {
  behaviorState.terminated = true;
  currentQuestion = null;
  studentAnswer.value = "";

  updateInterviewButtons("final");

  if (interviewData?.assets?.finish) {
    playAsset(interviewData.assets.finish);
  }
}

/* =========================================================
   MAIN INTERVIEW FLOW
========================================================= */

fetch("interview-flow.json")
  .then(response => response.json())
  .then(data => {
    interviewData = data;
    loadIdle();
  })
  .catch(error => {
    console.error("JSON loading error:", error);
    setFeedbackText("Error loading interview.");
  });

function loadIdle() {
  currentQuestion = null;
  protectedFeedback = false;
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;
  BehaviorEngine.reset();

  studentAnswer.value = "";
  setFeedbackText("Ready to begin?");

  idleImage.src = interviewData.assets.idle.url;
  idleImage.style.display = "block";
  idleImage.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.removeAttribute("src");
  emilyVideo.load();
  emilyVideo.style.display = "none";
  emilyVideo.classList.add("hidden");

  resetInterviewUIState();
}

function resetInterviewUIState() {
  interviewUIState.phase = "before";
  interviewUIState.hasSubmittedCurrentAnswer = false;
  interviewUIState.isListening = false;
  interviewUIState.finalReached = false;

  updateInterviewButtons("before");
}

function startInterview() {
  if (!interviewData) return;

  currentQuestion = interviewData.interview.questions[0];
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;
  protectedFeedback = false;
  BehaviorEngine.reset();

  studentAnswer.value = "";
  setFeedbackText("Meet Emily");

  updateInterviewButtons("progress");

  playAsset(interviewData.assets.intro, function () {
    playQuestionVideo();
  });
}

function playQuestionVideo() {
  if (!currentQuestion) return;

  protectedFeedback = false;
  resetAnswerSubmissionState();

  setFeedbackText(getQuestionGuideText(currentQuestion));

  playAsset(currentQuestion.video);
}

function getQuestionGuideText(question) {
  const guides = {
    question_1: "Desired job position",
    question_2: "Academic background",
    question_3: "Responsibilities and experience",
    question_4: "Activities outside work",
    question_5: "Your strengths",
    question_6: "Teamwork experience",
    question_7: "Independent work"
  };

  return guides[question.id] || question.prompt || "Your answer";
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
    if (typeof onEndedCallback === "function") {
      onEndedCallback();
    }
  };

  emilyVideo.play().catch(error => {
    console.warn("Video autoplay blocked or failed:", error);
  });
}

function repeatQuestion() {
  if (!currentQuestion || !currentQuestion.repeat?.allowed) return;

  repeatCount++;

  if (repeatCount > currentQuestion.repeat.limit) {
    setFeedbackText(
      currentQuestion.repeat.onLimitReached?.message ||
      "You have reached the repeat limit. Please use Hint or Modeling Answer if you need support."
    );
    return;
  }

  playQuestionVideo();
}

function submitAnswer() {
  if (
    !currentQuestion ||
    interviewUIState.phase !== "progress" ||
    behaviorState.terminated
  ) {
    return;
  }

  markAnswerSubmitted();
  setListeningVisualState(false);

  const answer = studentAnswer.value.trim();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  if (answer.length === 0) {
    showFeedback("empty_answer");
    return;
  }

  const behaviorResult = BehaviorEngine.analyze(answer, currentQuestion);

  if (BehaviorEngine.applyResult(behaviorResult)) {
    resetAnswerSubmissionState();
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
  if (!currentQuestion) return;

  const messageKey = textKey || feedbackKey;

  setFeedbackText(
    currentQuestion.feedbackText?.[messageKey] ||
    "Please try again."
  );

  protectedFeedback = feedbackKey === "partial_answer";

  if (feedbackKey === "partial_answer") {
    studentAnswer.value = "";
    resetAnswerSubmissionState();
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
  if (!currentQuestion) return;

  const assetKey = currentQuestion.feedbackMap?.[feedbackKey];
  const asset = interviewData.assets?.[assetKey];

  if (!asset) {
    console.warn("Missing feedback asset:", feedbackKey);
    return;
  }

  playAsset(asset);
}

function nextStep() {
  if (!currentQuestion) return;

  const questions = interviewData.interview.questions;
  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);
  const nextQuestion = questions[currentIndex + 1];

  studentAnswer.value = "";
  resetAnswerSubmissionState();
  setListeningVisualState(false);

  if (nextQuestion) {
    currentQuestion = nextQuestion;
    repeatCount = 0;

    setFeedbackText(getQuestionGuideText(currentQuestion));

    setTimeout(() => {
      playQuestionVideo();
    }, 600);

    return;
  }

  moveToFinalInterviewState();
}

function moveToFinalInterviewState() {
  currentQuestion = null;
  protectedFeedback = false;

  studentAnswer.value = "";
  setFeedbackText("Interview completed");

  updateInterviewButtons("final");

  playAsset(interviewData.assets.finish);
}

function finishInterview() {
  loadIdle();
}

function isGoodAnswer(text) {
  if (!currentQuestion) return false;

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
  if (!currentQuestion) return false;

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

  setFeedbackText(
    currentQuestion.feedbackText?.hint_requested ||
    currentQuestion.hint ||
    "Use a complete sentence."
  );

  protectedFeedback = true;
  playFeedback("hint_requested");
}

function showModelAnswer() {
  if (!currentQuestion) return;

  const model =
    currentQuestion.modelAnswers?.[0] ||
    currentQuestion.exampleAnswer ||
    "I am interested in working as a legal advisor.";

  setFeedbackText(`Model answer: "${model}"`);
  protectedFeedback = true;
  studentAnswer.value = "";

  playFeedback("modeling_requested");
}

/* SPEECH RECOGNITION */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

if (!SpeechRecognition) {
  if (speakBtn) {
    speakBtn.disabled = true;
    setButtonLabel(speakBtn, "No mic");
  }
} else {
  recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = event => {
    const spokenText = event.results[0][0].transcript.trim();

    studentAnswer.value = spokenText;

    if (!protectedFeedback) {
      setFeedbackText("Speech captured. You can submit your answer.");
    }

    setListeningVisualState(false);
  };

  recognition.onerror = () => {
    setFeedbackText("Microphone problem. You can type your answer instead.");
    setListeningVisualState(false);
  };

  recognition.onend = () => {
    setListeningVisualState(false);
  };
}

function startListeningSession() {
  if (!recognition || !currentQuestion) return;

  if (!protectedFeedback) {
    setFeedbackText("Emily is listening...");
  }

  try {
    recognition.abort();
  } catch (error) {
    console.warn("Recognition abort warning:", error);
  }

  setTimeout(() => {
    try {
      recognition.start();
      setListeningVisualState(true);
    } catch (error) {
      console.warn("Recognition start warning:", error);
      setListeningVisualState(false);
    }
  }, 180);
}

function handleSpeakPress() {
  if (interviewUIState.phase !== "progress") return;

  const shouldClearBeforeSpeaking =
    !interviewUIState.hasSubmittedCurrentAnswer &&
    studentAnswer.value.trim().length > 0;

  if (shouldClearBeforeSpeaking) {
    setListeningVisualState(false);
    clearTranscriptBeforeNewSpeech();

    setTimeout(() => {
      resetAnswerSubmissionState();
      startListeningSession();
    }, 260);

    return;
  }

  resetAnswerSubmissionState();
  startListeningSession();
}

/* MAIN BUTTONS */

nextBtn.addEventListener("click", () => {
  if (interviewUIState.phase === "before") {
    startInterview();
    return;
  }

  if (interviewUIState.phase === "final") {
    finishInterview();
  }
});

speakBtn.addEventListener("click", handleSpeakPress);

submitBtn.addEventListener("click", submitAnswer);

clearBtn.addEventListener("click", () => {
  studentAnswer.value = "";
  protectedFeedback = false;
  resetAnswerSubmissionState();
  setFeedbackText("Answer area cleared.");
});

if (backBtn) {
  backBtn.addEventListener("click", () => {
    setFeedbackText("Back is not available in this practice version.");
  });
}

repeatBtn.addEventListener("click", repeatQuestion);

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
    setFeedbackText("Slow mode activated.");
    slowModeBtn.textContent = "Slow mode ON";
  } else {
    emilyVideo.playbackRate = 1;
    setFeedbackText("Slow mode deactivated.");
    slowModeBtn.textContent = "Slow mode";
  }
});
