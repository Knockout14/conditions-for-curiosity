const state = CFC.requireOnboarding();

document.getElementById("edit-details-btn").addEventListener("click", () => {
  location.href = "details.html";
});

state && (async function load() {
  const list = document.getElementById("pick-list");
  // Grabbed and disabled up front — this button is always in the static
  // markup below the (async-filled) list, so without this it sits there
  // looking clickable but silently does nothing until its real listener
  // is wired further down, past the fetch.
  const continueBtn = document.getElementById("continue-btn");
  continueBtn.disabled = true;

  // Editing an active pick (a week not yet finished) re-shows the same
  // three rather than sampling new ones — "editable anytime," not "reroll
  // anytime." A finished week falls through to a fresh sample below.
  const active = Boolean(state.weeklyPick) && !CFC.isWeekDone(state);
  // In a week under way, what's already been asked stays put: it can
  // still be reordered, but not swapped out.
  const askedThisWeek = new Set(active ? CFC.weekAskedIds(state).map(String) : []);
  // Not confirmed yet: re-show the candidates already drawn (see
  // pendingPick in app.js) rather than drawing new ones on every visit.
  const pending = active ? null : CFC.pendingPick(CFC.load());
  let candidates;
  let fromPending = false;
  try {
    if (active) {
      candidates = await CFC.fetchQuestionsByIds(state.weeklyPick.questionIds);
    } else if (pending) {
      candidates = await CFC.fetchQuestionsByIds(pending.questionIds);
      // All three should come back. If one has left the bank since, draw
      // a fresh set rather than show two.
      fromPending = candidates.length === 3;
    }
    if (!active && !fromPending) candidates = await CFC.fetchWeeklyCandidates(state);
  } catch (e) {
    console.error("fetching pick candidates failed:", e);
    CFC.renderLoadError(list, `Couldn't load this week's candidates. ${CFC.failureReason(e)}`, load);
    return;
  }
  const byId = new Map(candidates.map((q) => [String(q.id), q]));

  let order = candidates.map((q) => String(q.id));
  // Spec allows one swap a week across the three — not a reroll of the
  // whole set. Once used, every remaining "swap" affordance disappears on
  // the next render. It's saved with the pick (or with the pending
  // candidates, before confirming), so reopening this screen doesn't
  // bring it back.
  let swapUsed = active ? Boolean(state.weeklyPick.swapUsed) : fromPending && Boolean(pending.swapUsed);
  continueBtn.disabled = false;

  function buildCard(id, index, total) {
    const q = byId.get(id);
    const asked = askedThisWeek.has(id);
    const card = document.createElement("div");
    card.className = "pick-card";
    card.dataset.id = id;
    card.innerHTML = `
      <span class="pick-badge">${index + 1}</span>
      <span class="pick-body">
        <span class="pick-text">${CFC.escapeHtml(q.text)}</span>
        ${asked ? '<span class="pick-asked">Asked this week</span>'
          : swapUsed ? "" : '<button type="button" class="pick-swap">Not this one? Swap it</button>'}
      </span>
      <span class="pick-move">
        <button type="button" class="pick-move-btn" data-dir="-1" ${index === 0 ? "disabled" : ""} aria-label="Move up, currently number ${index + 1} of ${total}">&#9650;</button>
        <button type="button" class="pick-move-btn" data-dir="1" ${index === total - 1 ? "disabled" : ""} aria-label="Move down, currently number ${index + 1} of ${total}">&#9660;</button>
      </span>`;
    const swapBtn = card.querySelector(".pick-swap");
    if (swapBtn) {
      swapBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        swapCandidate(id, swapBtn);
      });
    }
    card.querySelectorAll(".pick-move-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveCard(id, Number(btn.dataset.dir));
      });
    });
    return card;
  }

  // The only way to reorder — a drag handle used to sit alongside these
  // (removed: it fought the page's own scroll on a touch phone, this
  // app's primary device, and these arrows already covered every case,
  // including keyboard/screen-reader use the drag never did).
  function moveCard(id, dir) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    render();
  }

  async function swapCandidate(oldId, btn) {
    if (swapUsed) return;
    // Disabling synchronously (before the await yields) means a second
    // click on the same button can't dispatch at all — closes the
    // double-tap race that used to fire two replacement fetches.
    btn.disabled = true;
    btn.textContent = "Swapping…";
    const excludeIds = order.map(Number);
    let replacement;
    try {
      replacement = await CFC.fetchReplacementCandidate(state, excludeIds);
    } catch (e) {
      // A failed or timed-out fetch used to leave the button stuck on
      // "Swapping…" with no way forward. The swap isn't spent; try again.
      console.error("swap failed:", e);
      btn.disabled = false;
      // A rate limit won't clear on a retry, so say that instead.
      btn.textContent = e.status === 429 ? "Swaps are paused on this network today" : "Couldn't swap. Try again";
      return;
    }
    if (!replacement) {
      // Pool exhausted — vanishingly unlikely, but restore the button
      // instead of leaving it stuck on "Swapping…" forever.
      btn.disabled = false;
      btn.textContent = "Not this one? Swap it";
      return;
    }
    swapUsed = true;
    byId.delete(oldId);
    byId.set(String(replacement.id), replacement);
    order = order.map((id) => (id === oldId ? String(replacement.id) : id));
    render();
  }

  function render() {
    list.innerHTML = "";
    order.forEach((id, i) => list.appendChild(buildCard(id, i, order.length)));
    // Every render follows a draw, a reorder or a swap: keep the
    // unconfirmed candidates saved exactly as shown.
    if (!active) CFC.savePendingPick(order.map(Number), swapUsed);
  }

  render();

  const errorEl = document.getElementById("save-error");

  continueBtn.addEventListener("click", () => {
    if (continueBtn.disabled) return;
    attemptSubmit();
  });

  // Re-reads `order` fresh on every call, including a retry after a
  // failed save — unlike circleback.html's equivalent, CFC.patch() just
  // overwrites rather than accumulating, so there's no correctness
  // reason to lock this to what it was on the first click. That matters
  // here specifically: the cards (reorder, swap) stay interactive behind
  // the error message, so someone who keeps adjusting the order while
  // looking at "couldn't save" gets that adjustment submitted, not
  // whatever it was a moment ago.
  async function attemptSubmit() {
    continueBtn.disabled = true;
    continueBtn.textContent = "Saving…";
    errorEl.hidden = true;
    const rankedQuestions = order.map((id) => byId.get(id));
    // Editing a week under way keeps what's been asked; this used to reset
    // a counter to 0, so a week finished after an edit still looked
    // unfinished and "Pick again" re-showed the same three.
    const changes = {
      weeklyPick: CFC.buildWeeklyPick(CFC.load(), order.map(Number), active, swapUsed),
      pendingPick: null, // confirmed: nothing pending any more
    };
    // The start of the family's first two weeks (low-stakes questions only).
    const firstPickAt = CFC.firstPickAtFor(CFC.load());
    if (firstPickAt) changes.firstPickAt = firstPickAt;
    const newState = CFC.patch(changes);
    try {
      await CFC.submitPick(newState, rankedQuestions, active);
      location.href = CFC.resumeUrl(newState);
    } catch (e) {
      console.error("submitPick failed:", e);
      continueBtn.disabled = false;
      continueBtn.textContent = "Try again";
      errorEl.textContent = `Couldn't save that. ${CFC.failureReason(e)} Your ranking is kept, it just hasn't reached us yet.`;
      errorEl.hidden = false;
    }
  }
})();
