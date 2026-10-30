const state = CFC.load();

// Returning adults with saved progress skip the gate (and re-submitting
// details.html) entirely — straight to wherever they actually left off.
// Only a genuinely new visitor (no episode5 flag yet) sees this screen.
if (state.episode5) {
  location.replace(CFC.resumeUrl(state));
} else {
  const screen = document.getElementById("screen");

  function proceed() {
    CFC.patch({ episode5: true });
    location.href = "details.html";
  }

  screen.innerHTML = `
    <p class="eyebrow">Before you begin</p>

    <div class="center-stack">
      <h1 class="headline">Have you gotten to <em>episode five</em>?</h1>
      <p class="body-copy">"Curiosity Is Contagious" is where this whole approach gets explained. The link's below, but basically: you're the variable. An adult who's stopped wondering can't see it in a child.</p>
    </div>

    <div class="actions" id="gate-actions">
      <button type="button" class="btn-primary" id="heard-btn">Yes, I've heard it</button>
      <button type="button" class="btn-outline" id="short-btn">Not yet, show me the short version</button>
      <a class="link-secondary" href="https://open.spotify.com/episode/0FgSgJy199GzoJiRCERGqf?si=ff3aec84f8084122" target="_blank" rel="noopener">Take me to episode 5</a>
    </div>`;

  document.getElementById("heard-btn").addEventListener("click", proceed);

  document.getElementById("short-btn").addEventListener("click", () => {
    document.getElementById("gate-actions").outerHTML = `
      <div class="why-box" id="gate-actions">
        <p>You answer too, and you go first. You're finding out how they think, not teaching.</p>
      </div>
      <div class="actions" style="margin-top:20px">
        <button type="button" class="btn-primary" id="continue-btn">Continue</button>
      </div>`;
    document.getElementById("continue-btn").addEventListener("click", proceed);
  });
}
