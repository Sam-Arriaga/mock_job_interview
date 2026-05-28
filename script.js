let interviewData = null;
let currentQuestion = null;
let repeatCount = 0;
let spanishWarningCount = 0;
let offTopicWarningCount = 0;

const idleImage = document.getElementById("idleImage");
const emilyVideo = document.getElementById("emilyVideo");
const questionText = document.getElementById("questionText");
const studentAnswer = document.getElementById("studentAnswer");
const feedbackMessage = document.getElementById("feedbackMessage");
const subtitleBox = document.getElementById("subtitleBox");
const captionText = document.getElementById("captionText");
const systemBanner = document.getElementById("systemBanner");
const progressLabel = document.getElementById("progressLabel");
const captionMode = document.getElementById("captionMode");

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

  idleImage.src = interviewData.assets.idle.url;
  idleImage.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.removeAttribute("src");
  emilyVideo.load();
  emilyVideo.classList.add("hidden");
}

function startInterview() {
  currentQuestion = interviewData.interview.questions[0];
  repeatCount = 0;
  spanishWarningCount = 0;
  offTopicWarningCount = 0;

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

  idleImage.classList.add("hidden");
  emilyVideo.classList.remove("hidden");

  emilyVideo.pause();
  emilyVideo.src = asset.url;
  emilyVideo.currentTime = 0;
  emilyVideo.load();

  subtitleBox.textContent = asset.subtitle || "";
  updateCaptions(asset);

  emilyVideo.onended = function () {
    if (onEndedCallback) {
      onEndedCallback();
    }
  };

  emilyVideo.play().catch(error => {
    console.warn("Video autoplay blocked or failed:", error);
  });
}

function repeatQuestion() {
  if (!currentQuestion) return;

  if (!currentQuestion.repeat?.allowed) return;

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
    feedbackMessage.textContent = "Please write an answer before submitting.";
    playFeedback("empty_answer");
    return;
  }

  if (containsProfanity(answer)) {
    feedbackMessage.textContent = "Please use respectful language during the interview.";
    playFeedback("profanity_detected");
    return;
  }

  if (containsSpanish(answer)) {
    spanishWarningCount++;

    feedbackMessage.textContent = "Please answer in English.";

    if (spanishWarningCount === 1) {
      playFeedback("spanish_detected_first_time");
    } else {
      playFeedback("spanish_detected_second_time");
    }

    return;
  }

  if (isOffTopic(answer)) {
    offTopicWarningCount++;

    feedbackMessage.textContent = "Please focus on the job position.";

    if (offTopicWarningCount === 1) {
      playFeedback("off_topic_first_time");
    } else {
      playFeedback("off_topic_second_time");
    }

    return;
  }

  if (wordCount < currentQuestion.studentInput.minWords) {
    feedbackMessage.textContent =
      "Try to write a little more. Example: I am interested in the position of sales assistant.";
    playFeedback("needs_improvement");
    return;
  }

  feedbackMessage.textContent =
    "Good answer. Your response is clear and appropriate for the interview.";
  playFeedback("good_answer");
}

function playFeedback(feedbackKey) {
  const assetKey = currentQuestion.feedbackMap[feedbackKey];
  const asset = interviewData.assets[assetKey];

  if (!asset) return;

  playAsset(asset);
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

function containsSpanish(text) {
  const spanishWords = [
    "quiero", "trabajo", "puesto", "porque", "necesito", "me interesa",
    "estoy interesado", "empresa", "gracias", "hola", "sí", "para"
  ];

  const lowerText = text.toLowerCase();

  return spanishWords.some(word => lowerText.includes(word));
}

function containsProfanity(text) {
  const bannedWords = [
    "fuck", "shit", "bitch", "asshole", "damn"
  ];

  const lowerText = text.toLowerCase();

  return bannedWords.some(word => lowerText.includes(word));
}

function isOffTopic(text) {
  const lowerText = text.toLowerCase();

  const jobWords = [
    "position", "job", "role", "assistant", "manager", "teacher",
    "consultant", "developer", "engineer", "sales", "marketing",
    "finance", "intern", "trainee", "recruitment"
  ];

  return !jobWords.some(word => lowerText.includes(word));
}

startBtn.addEventListener("click", startInterview);
repeatBtn.addEventListener("click", repeatQuestion);
submitBtn.addEventListener("click", submitAnswer);
nextBtn.addEventListener("click", nextStep);
captionMode.addEventListener("change", function () {
  updateCaptions();
});