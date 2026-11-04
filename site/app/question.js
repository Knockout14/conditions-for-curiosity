const state = CFC.requireOnboarding();
const current = CFC.loadCurrentQuestion();

// No in-progress question (e.g. a direct link, or a refresh after
// sessionStorage cleared) — start over from wherever's actually next.
if (!current) {
  location.replace("open.html");
} else if (state) {
  const q = current.question;
  const screen = document.getElementById("screen");
  // Never render q.seed here, even behind a tap — spec §3c: the seed is
  // a post-answer object, never shown before or alongside the question.

  // The bank encodes prep as either a bare "None", or "None" followed by
  // an adult-only note that still applies even though no object is
  // needed — e.g. "None. Land it soon after a mistake, not during." The
  // leading "None" is a flag, not part of the sentence to show; strip it
  // (and a trailing "but") and keep whatever note follows, if any.
  let prepText = (q.prep || "").trim();
  prepText = prepText
    .replace(/^none[\s.,\-–—]*\s*(?:but\s+)?/i, "")
    .trim();
  if (prepText) prepText = prepText.charAt(0).toUpperCase() + prepText.slice(1);
  const showPrep = Boolean(prepText);

  screen.innerHTML = `
    <div class="tag-row">
      <h1 class="eyebrow tight">Tonight's question</h1>
      <span class="tag-row-meta">Ages ${CFC.escapeHtml(q.ages)}</span>
    </div>

    <p class="question-text">${CFC.escapeHtml(q.text)}</p>
    ${showPrep ? `<p class="prep-line">Before you ask: ${CFC.escapeHtml(prepText)}</p>` : ""}

    <div class="answer-field">
      <label class="field-label" for="answer">Your answer (go first)</label>
      <textarea class="field-input" id="answer" maxlength="4000" placeholder="Say it in your own words"></textarea>
      <p class="voice-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>Faster than typing: tap the mic on your keyboard and just say it.</p>
    </div>

    <div class="hint-row">
      <span class="hint-dot"></span>
      Now ask them. Say it exactly like that: a question, not a quiz.
    </div>

    <div class="spacer"></div>

    <div class="actions">
      <button type="button" class="btn-primary" id="both-answered-btn">We both answered</button>
      <p class="helper-caption">Nothing else appears until you've both gone.</p>
    </div>`;

  document.getElementById("both-answered-btn").addEventListener("click", () => {
    const answer = document.getElementById("answer").value.trim();
    CFC.saveCurrentQuestion({ question: q, index: current.index, adultAnswer: answer });
    location.href = "reveal.html";
  });
}
