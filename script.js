let interviewData = null;
let currentQuestion = null;
let currentQuestionData = null;
let repeatCount = 0;
let spanishWarningCount = 0; // Legacy counter kept for backward compatibility.
let offTopicWarningCount = 0; // Legacy counter kept for backward compatibility.
let slowModeEnabled = false;
let protectedFeedback = false;
let emilyIsTalking = false;
let idleHasDisplayed = false;
let activeSupportMode = null; // "hint", "captions", "model" or null
const savedAnswers = {};

const idleImage = document.getElementById("idleImage");
const emilyVideo = document.getElementById("emilyVideo");
const studentAnswer = document.getElementById("studentAnswer");
const feedbackMessage = document.getElementById("feedbackBox");
const captionPanel = document.getElementById("captionPanel");
const captionText = document.getElementById("captionText");
const backBtn = document.getElementById("backBtn");
const speakBtn = document.getElementById("speakBtn");
const repeatBtn = document.getElementById("repeatBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const progressDots = document.querySelectorAll(".progress-dot");

const menuBtn = document.getElementById("menuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const menuOverlay = document.getElementById("menuOverlay");

const hintBtn = document.getElementById("hintBtn");
const captionsBtn = document.getElementById("captionsBtn");
const modelAnswerBtn = document.getElementById("modelAnswerBtn");
const slowModeBtn = document.getElementById("slowModeBtn");
const instructionsBtn = document.getElementById("instructionsBtn");
const finishBtn = document.getElementById("finishBtn");

// Inline copies of Repeat/Hint/Captions/Modeling — visible in the empty
// space on tablet/desktop, hidden on mobile (CSS-controlled). Same
// underlying functions as the menu versions, just a second way to reach them.
const repeatBtnInline = document.getElementById("repeatBtnInline");
const hintBtnInline = document.getElementById("hintBtnInline");
const captionsBtnInline = document.getElementById("captionsBtnInline");
const modelAnswerBtnInline = document.getElementById("modelAnswerBtnInline");

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

function setCaptionText(text) {
  if (!captionText) return;
  captionText.textContent = text || "";
}

function setMenuButtonState(button, label, isActive) {
  if (!button) return;

  button.classList.toggle("is-active-support", isActive);
  button.innerHTML = `
    <span>${label}</span>
    ${isActive ? '<span class="menu-state">ON</span>' : ""}
  `;
}

function updateSupportMenuStates() {
  setMenuButtonState(hintBtn, "Hint", activeSupportMode === "hint");
  setMenuButtonState(captionsBtn, "Captions", activeSupportMode === "captions");
  setMenuButtonState(modelAnswerBtn, "Modeling answer", activeSupportMode === "model");

  if (slowModeBtn) {
    slowModeBtn.innerHTML = `
      <span>Slow mode</span>
      ${slowModeEnabled ? '<span class="menu-state">ON</span>' : ""}
    `;
  }

  // Mirror the active state onto the inline buttons (tablet/desktop).
  if (hintBtnInline) {
    hintBtnInline.classList.toggle("active-action", activeSupportMode === "hint");
  }
  if (captionsBtnInline) {
    captionsBtnInline.classList.toggle("active-action", activeSupportMode === "captions");
  }
  if (modelAnswerBtnInline) {
    modelAnswerBtnInline.classList.toggle("active-action", activeSupportMode === "model");
  }
}

function setActiveSupportMode(mode) {
  activeSupportMode = activeSupportMode === mode ? null : mode;
  updateSupportMenuStates();
}

function updateProgressBar() {
  if (!progressDots || progressDots.length === 0) return;

  const questions = interviewData?.interviewFlow?.questions;

  if (!Array.isArray(questions) || !currentQuestion) {
    progressDots.forEach((dot, index) => {
      dot.classList.toggle("active", index === 0);
    });
    return;
  }

  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);

  progressDots.forEach((dot, index) => {
    dot.classList.toggle("active", index <= currentIndex);
  });
}
function saveCurrentAnswer() {
  if (!currentQuestion || !studentAnswer) return;
  savedAnswers[currentQuestion.id] = studentAnswer.value;
}

function restoreCurrentAnswer() {
  if (!currentQuestion || !studentAnswer) return;
  studentAnswer.value = savedAnswers[currentQuestion.id] || "";
}

function updateBackButtonAvailability() {
  if (!backBtn) return;

  const questions = interviewData?.interviewFlow?.questions;

  if (!Array.isArray(questions) || !currentQuestion) {
    setButtonState(backBtn, { disabled: true, inactive: true });
    return;
  }

  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);

  if (currentIndex <= 0) {
    setButtonState(backBtn, { disabled: true, inactive: true });
  } else {
    setButtonState(backBtn, { disabled: false, inactive: false });
  }
}

function refreshCurrentQuestionScreen() {
  if (!currentQuestion) return;

  protectedFeedback = false;
  resetAnswerSubmissionState();
  setListeningVisualState(false);

  restoreCurrentAnswer();
  updateProgressBar();
  updateBackButtonAvailability();

  setFeedbackText(
    currentQuestion.upperStatusText ||
    getQuestionGuideText(currentQuestion) ||
    currentQuestion.question ||
    "Interview question"
  );

  playQuestionVideo();
}

function backStep() {
  if (
    !currentQuestion ||
    interviewUIState.phase !== "progress" ||
    behaviorState.terminated
  ) {
    return;
  }

  const questions = interviewData?.interviewFlow?.questions;

  if (!Array.isArray(questions)) return;

  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);

  if (currentIndex <= 0) {
    setFeedbackText("You are already on the first question.");
    updateBackButtonAvailability();
    return;
  }

  saveCurrentAnswer();

  currentQuestion = questions[currentIndex - 1];
  currentQuestionData = currentQuestion;
  repeatCount = 0;

  refreshCurrentQuestionScreen();
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
  setButtonState(nextBtn, { disabled: false, inactive: false });

  setButtonLabel(nextBtn, "Next");
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
  
  const academicTerms = [
  "law",
  "psychology",
  "architecture",
  "engineering",
  "marketing",
  "medicine",
  "design",
  "management",
  "finance",
  "economics",
  "business",
  "tourism",
  "education",
  "accounting"
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

    const categories = question?.evaluationCriteria?.semanticCategories || [];
const oldKeywords = question?.evaluationCriteria?.keywords || [];

const softSemanticSignals = [
  ...oldKeywords,
  ...categories
];

const hasQuestionKeyword = softSemanticSignals.some(signal =>
  text.includes(String(signal).replaceAll("_", " ").toLowerCase())
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
  IdleTimerEngine.cancel();
  behaviorState.terminated = true;
  currentQuestion = null;
  studentAnswer.value = "";

  updateInterviewButtons("final");

  if (interviewData?.assets?.finish) {
    playAsset(interviewData.assets.finish);
  }
}



/* =========================================================
   IDLE TIMER ENGINE
   Starts only after Emily has stopped talking.
   It never runs while Emily is speaking, in final state,
   or after behavior termination.
========================================================= */

const IdleTimerEngine = (() => {
  let timerId = null;

  function getDelayMs() {
    const seconds =
      interviewData?.settings?.idleBehavior?.delaySeconds ||
      interviewData?.assets?.idleBehavior?.delaySeconds ||
      25;

    return Number(seconds) * 1000;
  }

  function isEnabled() {
    return (
      interviewData?.settings?.idleBehavior?.enabled !== false &&
      interviewData?.assets?.idleBehavior?.enabled !== false
    );
  }

  function canRun() {
    return (
      isEnabled() &&
      interviewUIState.phase === "progress" &&
      currentQuestion &&
      !interviewUIState.finalReached &&
      !behaviorState.terminated &&
      !emilyIsTalking
    );
  }

  function cancel() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function start() {
    cancel();

    if (!canRun()) return;

    timerId = setTimeout(() => {
      if (!canRun()) return;
      showIdleVisualOnly();
    }, getDelayMs());
  }

  function reset() {
    cancel();

    if (canRun()) {
      start();
    }
  }

  function showIdleVisualOnly() {
    if (!interviewData?.assets?.idle?.url || !canRun()) return;

    idleHasDisplayed = true;
    idleImage.src = interviewData.assets.idle.url;
    idleImage.style.display = "block";
    idleImage.classList.remove("hidden");

    emilyVideo.pause();
    emilyVideo.style.display = "none";
    emilyVideo.classList.add("hidden");

    if (!protectedFeedback) {
      setFeedbackText("Take your time. Emily is ready when you are.");
    }
  }

  function registerUserActivity() {
    idleHasDisplayed = false;
    reset();
  }

  return {
    start,
    cancel,
    reset,
    registerUserActivity
  };
})();

function bindIdleUserActivityListeners() {
  if (studentAnswer) {
    ["input", "keydown", "paste"].forEach(eventName => {
      studentAnswer.addEventListener(eventName, () => {
        IdleTimerEngine.registerUserActivity();
      });
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest("button")) {
      IdleTimerEngine.registerUserActivity();
    }
  });
}

bindIdleUserActivityListeners();

/* =========================================================
   DYNAMIC FEEDBACK SELECTOR + FUTURE CHATGPT HOOK
   Behavior rules are evaluated first in submitAnswer().
========================================================= */

const AnswerQualityEngine = (() => {
  function getWordCount(text) {
    return normalizeText(text).split(" ").filter(Boolean).length;
  }

  function hasAnyMatch(text, items = []) {
    const lowerText = normalizeText(text);

    return items.some(item => lowerText.includes(String(item).toLowerCase()));
  }

function getSemanticTermsForQuestion(question) {
  const criteria = question?.evaluationCriteria || {};

  const semanticLibrary = {
    academic_field: [
      "law", "psychology", "architecture", "engineering", "marketing",
      "medicine", "design", "management", "finance", "economics",
      "business", "tourism", "education", "accounting", "international trade"
    ],

    university_major: [
      "major", "degree", "bachelor", "program", "student",
      "university", "college", "school", "studying", "study"
    ],

    degree_program: [
      "bachelor", "degree", "major", "program", "career"
    ],

    job_position: [
  "lawyer", "accountant", "manager", "assistant", "engineer",
  "developer", "designer", "teacher", "analyst", "receptionist",
  "consultant", "supervisor", "coordinator", "legal advisor"
],

professional_area: [
  "finance", "marketing", "human resources", "accounting", "law",
  "engineering", "management", "business", "tourism", "education",
  "technology", "sales", "administration", "customer service"
],

career_interest: [
  "career", "job", "position", "work", "working", "profession",
  "professional area", "interested", "future"
],

study_field: [
  "law", "accounting", "engineering", "management", "marketing",
  "finance", "business", "tourism", "education", "psychology",
  "architecture", "international trade"
],

    responsibility: [
      "reports", "documents", "customers", "team", "project",
      "records", "files", "sales", "events", "coordinating"
    ],

    personal_activity: [
      "reading", "exercise", "sports", "music", "family",
      "learning", "traveling", "cooking", "swimming"
    ],

    professional_skill: [
      "communication", "organization", "teamwork", "problem solving",
      "leadership", "responsibility", "technology", "programming"
    ],

    teamwork_experience: [
      "team", "project", "classmates", "coworkers", "organized",
      "helped", "presented", "planned", "leader", "coordinated"
    ],

    independent_task: [
  "reports", "files", "emails", "documents", "research",
  "analysis", "customer service", "planning", "pressure", "time", "tasks"
],

school_context: [
  "school", "university", "college", "class", "classmates",
  "teacher", "project", "homework", "presentation", "academic"
],

work_context: [
  "work", "job", "company", "office", "customers", "clients",
  "coworkers", "boss", "manager", "internship", "professional"
],

internship_context: [
  "internship", "intern", "training", "practice", "professional practice",
  "company", "office", "supervisor"
],

sports_or_extracurricular_context: [
  "sports", "soccer", "football", "gym", "exercise", "basketball",
  "music", "club", "dance", "swimming", "extracurricular"
],

hobby_or_interest: [
  "reading", "music", "sports", "exercise", "traveling", "cooking",
  "swimming", "learning", "family", "friends", "movies", "french"
],

professional_ability: [
  "solve problems", "solving problems", "organize", "manage",
  "communicate", "lead", "work under pressure", "use technology",
  "programming", "responsible", "independent", "confident"
],

task_management: [
  "manage my time", "time", "planning", "organize", "complete tasks",
  "finish tasks", "work independently", "under pressure", "prioritize"
],

craft_or_hobby_skill: [
  "drawing", "design", "cooking", "music", "photography",
  "writing", "painting", "crafts", "editing"
]
  };

  const oldKeywords = criteria.keywords || [];

  const semanticTerms = (criteria.semanticCategories || [])
    .flatMap(category => semanticLibrary[category] || []);

  return [...new Set([...oldKeywords, ...semanticTerms])];
}

function hasQuestionKeyword(answer, question) {
  return hasAnyMatch(answer, getSemanticTermsForQuestion(question));
}

  function hasAcceptedPattern(answer, question) {
    return hasAnyMatch(answer, question?.evaluationCriteria?.acceptablePatterns || []);
  }

  function hasCommunicativeFallback(answer) {
    const text = normalizeText(answer);

    const fallbackSignals = [
      "i am",
      "i'm",
      "i have",
      "i can",
      "i like",
      "i enjoy",
      "i want",
      "i study",
      "my major",
      "yes i"
    ];

    return fallbackSignals.some(signal => text.includes(signal));
  }

  function classify(answer, question) {
    const wordCount = getWordCount(answer);

    if (wordCount === 0) {
      return {
        key: "empty_answer",
        shouldAdvance: false,
        needsAIFeedback: false
      };
    }

    if (wordCount <= 3) {
      return {
        key: "too_short",
        shouldAdvance: false,
        needsAIFeedback: false
      };
    }

    const hasKeyword = hasQuestionKeyword(answer, question);
    const hasPattern = hasAcceptedPattern(answer, question);
    const hasFallback = hasCommunicativeFallback(answer);
    const meetsQuestionMinWords =
      wordCount >= Number(question?.evaluationCriteria?.minWords || 4);

    if (hasKeyword && hasPattern && meetsQuestionMinWords) {
      return {
        key: "good_answer",
        shouldAdvance: true,
        needsAIFeedback: false
      };
    }

    if (wordCount >= 4 && hasKeyword) {
      return {
        key: "partial_answer",
        shouldAdvance: false,
        needsAIFeedback: true,
        reason: "keyword_detected_partial_success"
      };
    }

    if (wordCount >= 4 && hasPattern) {
      return {
        key: "partial_answer",
        shouldAdvance: false,
        needsAIFeedback: true,
        reason: "pattern_detected_but_keyword_missing"
      };
    }

    if (wordCount >= 4 && hasFallback) {
      return {
        key: "partial_answer",
        shouldAdvance: false,
        needsAIFeedback: true,
        reason: "intelligent_fallback_partial_success"
      };
    }

    return {
      key: "needs_improvement",
      shouldAdvance: false,
      needsAIFeedback: true,
      reason: "no_clear_keyword_or_pattern"
    };
  }

  return {
  classify,
  getSemanticTermsForQuestion
};
})();

async function requestAIGrammarFeedback(answer, question) {
  const questionNumber = Number(String(question?.id || "").split("_").pop());
  const model = question?.modelingAnswer || "Use a complete professional sentence.";
  const text = normalizeText(answer);

  let suggestion = model;

  if (questionNumber === 1) {
    suggestion = "I am interested in working as a lawyer because I want to help people.";
  }

  if (questionNumber === 2) {
    suggestion = "I am studying law, and I have studied it for three years.";
  }

  if (questionNumber === 3) {
    suggestion = "I have been responsible for organizing documents and working with my team.";
  }

  if (questionNumber === 4) {
    suggestion = "I am interested in exercising and spending time with my family.";
  }

  if (questionNumber === 5) {
    suggestion = "I am good at teamwork and solving problems in a professional environment.";
  }

  if (questionNumber === 6) {
    suggestion = "Yes, I have worked on a team project and helped organize the presentation.";
  }

  if (questionNumber === 7) {
    suggestion = "I am able to manage my time and complete documents independently.";
  }

  return {
    source: "mock_local",
    message:
      text.length > 0
        ? `Good effort. Your idea is partly communicative. Try this clearer version: “${suggestion}”`
        : "Please write or say your answer first."
  };
}

function getSemiFixedAIFeedbackKey(question) {
  const questionNumber = Number(String(question?.id || "").split("_").pop());

  if (questionNumber >= 1 && questionNumber <= 3) {
    return "try_reading_feedback";
  }

  return "try_again_feedback";
}

async function showDynamicAIFeedback(answer, question, fallbackKey = "partial_answer") {
  const aiResult = await requestAIGrammarFeedback(answer, question);

  protectedFeedback = true;
  setFeedbackText(
    aiResult?.message ||
    question?.feedbackText?.[fallbackKey] ||
    "Try again with a clearer complete sentence."
  );

  const assetKey = getSemiFixedAIFeedbackKey(question);
  const asset = interviewData.assets?.[assetKey];

  if (asset) {
    playAsset(asset);
  } else {
    playFeedback(fallbackKey);
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
  currentQuestionData = null;
  IdleTimerEngine.cancel();
  idleHasDisplayed = false;
  protectedFeedback = false;
  activeSupportMode = null;
  updateSupportMenuStates();
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;
  BehaviorEngine.reset();
  Object.keys(savedAnswers).forEach(key => delete savedAnswers[key]);

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
  updateProgressBar();
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
  if (!interviewData) {
    setFeedbackText("Interview data is still loading.");
    return;
  }

  const questions = interviewData?.interviewFlow?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    console.error("Invalid JSON structure:", interviewData);
    setFeedbackText("Interview questions not found in JSON.");
    return;
  }

  currentQuestion = questions[0];
  currentQuestionData = currentQuestion;
  updateProgressBar();
  updateBackButtonAvailability();
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;
  protectedFeedback = false;
  BehaviorEngine.reset();

  studentAnswer.value = "";
  setFeedbackText("Meet Emily");

  updateInterviewButtons("progress");

  if (!interviewData.assets?.intro) {
    console.error("Intro asset not found:", interviewData.assets);
    setFeedbackText("Intro video not found.");
    return;
  }

  playAsset(interviewData.assets.intro, function () {
    playQuestionVideo();
  });
}

function playQuestionVideo() {
  if (!currentQuestion) return;

  protectedFeedback = false;
  resetAnswerSubmissionState();

  setFeedbackText(
    currentQuestion.upperStatusText ||
    currentQuestion.question ||
    "Interview question"
  );

  const videoKey = currentQuestion.video;
  const videoAsset = interviewData.assets?.[videoKey];

  if (!videoAsset) {
    console.error("Question video asset missing:", videoKey);
    setFeedbackText("Question video not found.");
    return;
  }

  playAsset(videoAsset);
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

  IdleTimerEngine.cancel();
  emilyIsTalking = true;
  idleHasDisplayed = false;

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
    emilyIsTalking = false;

    if (typeof onEndedCallback === "function") {
      onEndedCallback();
    }

    IdleTimerEngine.start();
  };

  emilyVideo.play().catch(error => {
    emilyIsTalking = false;
    IdleTimerEngine.start();
    console.warn("Video autoplay blocked or failed:", error);
  });
}

function repeatQuestion() {
  if (!currentQuestion) return;

  repeatCount++;

  // CLOSE MENU OVERLAY
  if (menuOverlay) {
    menuOverlay.classList.add("hidden");
  }

  setFeedbackText(
    currentQuestion.upperStatusText ||
    currentQuestion.question ||
    "Repeating the question."
  );

  playQuestionVideo();

  if (repeatBtn) {
    repeatBtn.classList.add("active-repeat");

    setTimeout(() => {
      repeatBtn.classList.remove("active-repeat");
    }, 400);
  }

  if (repeatBtnInline) {
    repeatBtnInline.classList.add("active-repeat");

    setTimeout(() => {
      repeatBtnInline.classList.remove("active-repeat");
    }, 400);
  }
 }

async function submitAnswer() {
  if (
    !currentQuestion ||
    interviewUIState.phase !== "progress" ||
    behaviorState.terminated
  ) {
    return;
  }

  IdleTimerEngine.registerUserActivity();
  
  const answer = studentAnswer.value.trim();

  // Validación rápida para respuestas vacías (evita análisis innecesarios)
  if (answer.length === 0) {
    showFeedback("empty_answer");
    return;
  }

  markAnswerSubmitted();
  setListeningVisualState(false);

  const behaviorResult = BehaviorEngine.analyze(answer, currentQuestion);

  if (BehaviorEngine.applyResult(behaviorResult)) {
    resetAnswerSubmissionState();
    return;
  }

  const feedbackResult = AnswerQualityEngine.classify(answer, currentQuestion);

  if (feedbackResult.needsAIFeedback) {
    resetAnswerSubmissionState();
    await showDynamicAIFeedback(
      answer,
      currentQuestion,
      feedbackResult.key
    );
    return;
  }

  showFeedback(feedbackResult.key);
}

function showFeedback(feedbackKey, textKey = null) {
  if (!currentQuestion) return;

  const messageKey = textKey || feedbackKey;

  setFeedbackText(
    currentQuestion.feedbackText?.[messageKey] ||
    (messageKey === "needs_improvement"
      ? "Try again with a clearer complete sentence related to the question."
      : "Please try again.")
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
  IdleTimerEngine.registerUserActivity();
  if (!currentQuestion) return;

  const questions = interviewData.interviewFlow.questions;
  const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);
  const nextQuestion = questions[currentIndex + 1];

  saveCurrentAnswer();

  studentAnswer.value = "";
  resetAnswerSubmissionState();
  setListeningVisualState(false);

  if (nextQuestion) {
    currentQuestion = nextQuestion;
    currentQuestionData = currentQuestion;
    repeatCount = 0;
    restoreCurrentAnswer();
    updateProgressBar();
    updateBackButtonAvailability();

    setFeedbackText(getQuestionGuideText(currentQuestion));

    setTimeout(() => {
      playQuestionVideo();
    }, 600);

    return;
  }

  moveToFinalInterviewState();
}

function moveToFinalInterviewState() {
  IdleTimerEngine.cancel();
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

  const criteria = currentQuestion.evaluationCriteria;

  if (!criteria) return false;

  const hasPattern = criteria.acceptablePatterns?.some(pattern =>
    lowerText.includes(pattern.toLowerCase())
  );

  const hasKeyword = AnswerQualityEngine
  .getSemanticTermsForQuestion(currentQuestion)
  .some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  return hasPattern && hasKeyword;
}

function isPartialAnswer(text) {
  if (!currentQuestion) return false;

  const lowerText = normalizeText(text);

  const criteria = currentQuestion.evaluationCriteria;

  if (!criteria) return false;

  const hasKeyword = AnswerQualityEngine
  .getSemanticTermsForQuestion(currentQuestion)
  .some(keyword => lowerText.includes(keyword.toLowerCase()));

  const hasSomeStructure =
    lowerText.includes("i am") ||
    lowerText.includes("i can") ||
    lowerText.includes("i like") ||
    lowerText.includes("i have");

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

  setActiveSupportMode("hint");

  if (activeSupportMode === "hint") {
    setCaptionText(currentQuestion.hint || "Use a complete sentence.");
    setFeedbackText("Hint opened.");
    protectedFeedback = true;
    playFeedback("hint_requested");
  } else {
    setCaptionText("");
    setFeedbackText("Hint closed.");
    protectedFeedback = false;
  }
}

function showModelAnswer() {
  if (!currentQuestion) return;

  setActiveSupportMode("model");

  if (activeSupportMode === "model") {
    const model =
      currentQuestion.modelingAnswer ||
      currentQuestion.modelAnswers?.[0] ||
      currentQuestion.exampleAnswer ||
      "I am interested in working as a legal advisor.";

    setCaptionText(`Model answer: "${model}"`);
    setFeedbackText("Model answer opened.");

    protectedFeedback = true;
    studentAnswer.value = "";
  } else {
    setCaptionText("");
    setFeedbackText("Model answer closed.");
    protectedFeedback = false;
  }
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
    IdleTimerEngine.registerUserActivity();

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

  IdleTimerEngine.registerUserActivity();

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

function handleEnterSubmit(event) {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;

  if (
    !currentQuestion ||
    interviewUIState.phase !== "progress" ||
    behaviorState.terminated ||
    emilyIsTalking
  ) {
    return;
  }

  const hasAnswer = studentAnswer.value.trim().length > 0;

  if (!hasAnswer) return;

  event.preventDefault();
  submitAnswer();
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (interviewUIState.phase === "before") {
      startInterview();
      return;
    }

    if (interviewUIState.phase === "progress") {
      nextStep();
      return;
    }

    if (interviewUIState.phase === "final") {
      finishInterview();
    }
  });
}

if (speakBtn) {
  speakBtn.addEventListener("click", handleSpeakPress);
}

if (submitBtn) {
  submitBtn.addEventListener("click", submitAnswer);
}

if (studentAnswer) {
  studentAnswer.addEventListener("keydown", handleEnterSubmit);
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    studentAnswer.value = "";
    protectedFeedback = false;
    resetAnswerSubmissionState();
    setFeedbackText("Answer area cleared.");
  });
}

if (backBtn) {
  backBtn.addEventListener("click", backStep);
}

  if (repeatBtn) {
  repeatBtn.addEventListener("click", repeatQuestion);
}


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
function toggleCaptions() {
  if (!currentQuestion) return;

  setActiveSupportMode("captions");

  if (activeSupportMode === "captions") {
    setCaptionText(
      currentQuestion.caption ||
      currentQuestion.question ||
      "No captions available."
    );

    setFeedbackText("Captions opened.");
    protectedFeedback = true;
  } else {
    setCaptionText("");
    setFeedbackText("Captions closed.");
    protectedFeedback = false;
  }
}

if (captionsBtn) {
  captionsBtn.addEventListener("click", () => {
    toggleCaptions();
    menuOverlay.classList.add("hidden");
  });
}

if (slowModeBtn) {
  slowModeBtn.addEventListener("click", () => {
    slowModeEnabled = !slowModeEnabled;

    emilyVideo.playbackRate = slowModeEnabled ? 0.75 : 1;

    setFeedbackText(
      slowModeEnabled ? "Slow mode activated." : "Slow mode deactivated."
    );

    updateSupportMenuStates();
  });
}
const SILVERCLASSROOM_LANDING_URL = "https://silverclassroom.com/lms2";

function confirmAndExitInterview() {
  const wantsToQuit = window.confirm(
    "Are you sure you want to leave the interview? Your current progress may not be saved."
  );

  if (!wantsToQuit) return;

IdleTimerEngine.cancel();
recognition?.abort?.();

window.location.assign(SILVERCLASSROOM_LANDING_URL);
}

if (instructionsBtn) {
  instructionsBtn.addEventListener("click", () => {
    window.location.href = SILVERCLASSROOM_LANDING_URL;
  });
}

if (finishBtn) {
  finishBtn.addEventListener("click", () => {
    confirmAndExitInterview();
  });
}

/* INLINE SUPPORT BUTTONS (tablet/desktop) — same functions as the menu */

if (repeatBtnInline) {
  repeatBtnInline.addEventListener("click", repeatQuestion);
}

if (hintBtnInline) {
  hintBtnInline.addEventListener("click", showHint);
}

if (captionsBtnInline) {
  captionsBtnInline.addEventListener("click", toggleCaptions);
}

if (modelAnswerBtnInline) {
  modelAnswerBtnInline.addEventListener("click", showModelAnswer);
}
