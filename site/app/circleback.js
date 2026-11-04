const state = CFC.requireOnboarding();
const current = CFC.loadCurrentQuestion();

if (!current || current.adultAnswer === undefined) {
  location.replace("open.html");
} else if (state) {
  let childAskedQuestion = null;
  const yesBtn = document.getElementById("yes-btn");
  const noBtn = document.getElementById("no-btn");
  const doneBtn = document.getElementById("done-btn");
  const errorEl = document.getElementById("save-error");

  function select(value, btn, other) {
    childAskedQuestion = value;
    btn.classList.add("selected");
    btn.setAttribute("aria-pressed", "true");
    other.classList.remove("selected");
    other.setAttribute("aria-pressed", "false");
    errorEl.hidden = true;
  }
  yesBtn.addEventListener("click", () => select(true, yesBtn, noBtn));
  noBtn.addEventListener("click", () => select(false, noBtn, yesBtn));

  // Only this part is locked at the first click, and only because it has
  // to be: markQuestionAsked() isn't idempotent (it appends to the
  // all-time askedQuestionIds every time it runs), so calling it again on
  // a retry would record the question as asked twice. Everything else below (note text, yes/no) is read fresh on
  // every attempt — if a save fails, editing the note before hitting
  // "Try again" isn't silently thrown away.
  let lockedState = null;

  doneBtn.addEventListener("click", () => {
    if (doneBtn.disabled) return;
    // The button stays tappable (a greyed one reads as frozen); it says what's missing instead.
    if (childAskedQuestion === null) {
      errorEl.textContent = "Tap Yes or No above, then you're done.";
      errorEl.hidden = false;
      yesBtn.focus();
      return;
    }
    if (!lockedState) lockedState = CFC.markQuestionAsked(state, current.question.id);
    attemptSave();
  });

  async function attemptSave() {
    doneBtn.disabled = true;
    doneBtn.textContent = "Saving…";
    errorEl.hidden = true;
    const note = document.getElementById("note").value.trim();
    const q = current.question;
    try {
      await CFC.submitCircleBack(lockedState, {
        question: q,
        rank: current.index + 1, // the position it held when *this* session started — not whatever it is now, if it's since been reordered
        adultAnswer: current.adultAnswer,
        childAskedQuestion,
        note,
      });
      sessionStorage.removeItem("cfc_current_question");
      location.href = "done.html";
    } catch (e) {
      console.error("submitCircleBack failed:", e);
      doneBtn.disabled = false;
      doneBtn.textContent = "Try again";
      errorEl.textContent = `Couldn't save that. ${CFC.failureReason(e)} Your answer isn't lost, it just hasn't reached us yet.`;
      errorEl.hidden = false;
    }
  }
}
