const speakBtn = document.getElementById("speakBtn");
const finishBtn = document.getElementById("finishBtn");
const responseText = document.getElementById("responseText");

speakBtn.addEventListener("click", () => {

    responseText.innerHTML =
    "Listening to your answer...";

});

finishBtn.addEventListener("click", () => {

    responseText.innerHTML =
    "Interview completed successfully.";

});