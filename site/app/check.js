CFC.requireStep((s) => s.episode5, "index.html") && CFC.requireStep((s) => s.name && s.ageBand, "details.html");

document.getElementById("edit-details-btn").addEventListener("click", () => {
  location.href = "details.html";
});

const answers = {};
const skipLink = document.getElementById("skip-link");

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

      // "Skip, I've got it" only makes sense before engaging with the
      // quiz at all — once any block's been answered, it's a second
      // button doing the same thing as "Start this week."
      skipLink.hidden = true;
    });
  });
});

// Fires from either the primary button or the skip link — either way,
// any block the person never tapped gets recorded as "skipped" rather
// than left absent (absent used to read identically to "answered
// wrong" downstream; now the sheet can actually tell the two apart).
function finishCheck() {
  document.querySelectorAll(".check-block").forEach((block) => {
    const key = block.dataset.key;
    if (!(key in answers)) answers[key] = "skipped";
  });
  const newState = CFC.patch({
    checkAnswers: answers,
    onboardingComplete: true,
    onboardingCompletedAt: new Date().toISOString(),
  });
  location.href = CFC.resumeUrl(newState);
}

document.getElementById("continue-btn").addEventListener("click", finishCheck);
document.getElementById("skip-link").addEventListener("click", finishCheck);
