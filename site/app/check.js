// Optional since 2026-11-03 (KO): offered from the done screen after a night,
// no longer a step before the first question.
CFC.requireStep((s) => s.name && s.ageBand, "details.html");

document.getElementById("edit-details-btn").addEventListener("click", () => {
  location.href = "details.html";
});

const answers = {};

document.querySelectorAll(".check-block").forEach((block) => {
  const options = Array.from(block.querySelectorAll(".check-option"));
  const feedback = block.querySelector(".check-feedback");

  options.forEach((opt) => {
    opt.addEventListener("click", () => {
      const isCorrect = opt.dataset.correct === "true";

      options.forEach((o) => {
        o.disabled = true;
        const correct = o.dataset.correct === "true";
        o.classList.add(correct ? "correct" : "incorrect");
        if (o === opt) o.classList.add("tapped");
      });

      feedback.textContent = opt.dataset.blurb;
      feedback.classList.add("show", isCorrect ? "positive" : "negative");

      answers[block.dataset.key] = { selected: opt.textContent.trim(), correct: isCorrect };
    });
  });
});

// Any block the person never tapped is recorded as "skipped" rather than
// left absent, so the sheet can tell a skip from a wrong answer. The answers
// reach the sheet with the next pick.
function finishCheck() {
  document.querySelectorAll(".check-block").forEach((block) => {
    const key = block.dataset.key;
    if (!(key in answers)) answers[key] = "skipped";
  });
  const newState = CFC.patch({ checkAnswers: answers, checkCompletedAt: new Date().toISOString() });
  location.href = CFC.resumeUrl(newState);
}

document.getElementById("continue-btn").addEventListener("click", finishCheck);
