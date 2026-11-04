const state = CFC.load();
if (CFC.resumeUrl(state) !== "complete.html") {
  location.replace(CFC.resumeUrl(state));
} else {
  (async function load() {
    const screen = document.getElementById("screen");
    let questions;
    const stopLoading = CFC.showLoading(screen, "Getting tonight's question");
    try {
      questions = await CFC.fetchQuestionsByIds(state.weeklyPick.questionIds);
    } catch (e) {
      stopLoading();
      console.error("fetchQuestionsByIds failed:", e);
      CFC.renderLoadError(screen, `Couldn't load tonight's question. ${CFC.failureReason(e)}`, load);
      return;
    }
    stopLoading();
    const next = CFC.nextQuestion(state, questions);
    const ORDINALS = ["one", "two", "three"];

    if (!next) {
      CFC.maybeSubmitWeekSummary(state, questions);
      screen.innerHTML = `
        <p class="eyebrow">All caught up</p>
        <div class="center-stack">
          <h1 class="headline">When do you want to start <em>next week</em>?</h1>
          <p class="body-copy">All three asked. Nothing due again until you're ready. Anytime after Sunday works well for most families.</p>
        </div>
        <p class="calendar-label">Add a reminder for next week:</p>
        <div class="calendar-row">
          <a class="btn-outline" id="gcal-link" target="_blank" rel="noopener">Google Calendar</a>
          <button type="button" class="btn-outline" id="ical-link">Apple Calendar</button>
        </div>
        <div class="actions" style="margin-top:20px">
          <a class="link-secondary" href="pick.html">Pick again now</a>
          <a class="link-secondary" href="complete.html">Back to this week's three</a>
        </div>`;

      const url = `${location.origin}/app/pick.html`;
      CFC.wireCalendarButtons(document.getElementById("gcal-link"), document.getElementById("ical-link"), {
        // Working title — still being decided; easy to change in one place.
        title: "Conditions for Curiosity",
        description: `Time to pick next week's three questions. Open: ${url}`,
        url,
        start: CFC.nextSundayNoon(),
        durationMinutes: 30,
        uid: `${state.sessionId || "cfc"}-next-week@conditionsforcuriosity.netlify.app`,
      });
      return;
    }

    CFC.saveCurrentQuestion({ question: next.question, index: next.index });

    screen.innerHTML = `
      <p class="eyebrow">Conditions for Curiosity</p>
      <div class="center-stack">
        <h1 class="headline">Tonight, ask <em>one</em> thing.</h1>
        <p class="body-copy">Question ${ORDINALS[next.index]} of the three you picked. You answer first, always. No streak, no score.</p>
      </div>
      <div class="actions">
        <button type="button" class="btn-primary" id="begin-btn">Begin question ${ORDINALS[next.index]} of three</button>
        <p class="helper-caption">About 90 seconds</p>
        <a class="link-secondary" href="complete.html">See this week's three</a>
      </div>`;

    document.getElementById("begin-btn").addEventListener("click", () => (location.href = "question.html"));
  })();
}
