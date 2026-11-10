/* The optional guide. Tapping an option shows its feedback, and that's all:
   nothing is saved or sent, nothing is scored, and nothing is ever locked, so
   this page deliberately doesn't load app.js. Every tapped option looks the
   same: there is no right or wrong style here. */
document.querySelectorAll("[data-choice]").forEach((group) => {
  const options = group.querySelectorAll(".check-option");
  options.forEach((option) => {
    option.setAttribute("aria-pressed", "false");
    option.addEventListener("click", () => {
      options.forEach((o) => {
        o.classList.remove("tapped");
        o.setAttribute("aria-pressed", "false");
      });
      group.querySelectorAll(".guide-fb").forEach((fb) => { fb.hidden = true; });
      option.classList.add("tapped");
      option.setAttribute("aria-pressed", "true");
      document.getElementById(option.dataset.fb).hidden = false;
      const next = group.querySelector("[data-next], [data-done]");
      if (next) next.hidden = false;
    });
  });
});

/* One step at a time. Without JavaScript the guide stays one long page; with
   it, main gets .is-stepping and only the current step shows. The step lives
   in the URL hash (#step-3) and nowhere else, so a refresh keeps your place,
   the device's Back button steps back, and a step can be linked to. */
const guide = document.querySelector(".guide");
const steps = [...document.querySelectorAll("[data-step]")];
const total = steps.length;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let shown = 0;
const onShow = [];

const fromHash = () => {
  const m = /^#step-(\d+)$/.exec(location.hash);
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= total ? n : 1;
};

const progress = document.createElement("div");
progress.className = "guide-progress";
progress.innerHTML = '<p class="guide-step-label" aria-live="polite"></p><div class="guide-bar" aria-hidden="true"><span></span></div>';
const label = progress.querySelector(".guide-step-label");
const bar = progress.querySelector(".guide-bar span");
guide.prepend(progress);

const go = (n) => {
  if (n === shown) return;
  history.pushState({ step: n, from: shown }, "", "#step-" + n);
  show(n, true);
};

// Step back through history when we came from the step before, so the
// device's Back and this button agree. Otherwise (a direct link to a step)
// just show the step before without adding a history entry.
const goBack = () => {
  const n = shown;
  if (n <= 1) return;
  if (history.state && history.state.from === n - 1 && history.state.step === n) history.back();
  else {
    history.replaceState({ step: n - 1 }, "", "#step-" + (n - 1));
    show(n - 1, true);
  }
};

steps.forEach((step, i) => {
  const n = i + 1;
  // The ids are anchors for the long page. Here they would make the browser
  // jump past the progress marker on a link like #step-7, so the hash is ours.
  step.removeAttribute("id");
  const nav = document.createElement("div");
  nav.className = "guide-nav";
  if (n < total) {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn-primary";
    next.textContent = n === 1 ? "Start" : "Next →";
    next.addEventListener("click", () => go(n + 1));
    nav.append(next);
  }
  // The last step has no Next. Its own button (Open the question app) takes
  // that spot, so the gold button sits where it has been on every step.
  const cta = step.querySelector("[data-step-cta]");
  if (cta) nav.append(cta);
  if (n > 1) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "link-secondary";
    back.textContent = "Back";
    back.addEventListener("click", goBack);
    nav.append(back);
  }
  step.append(nav);
});

function show(n, moveFocus) {
  shown = n;
  // Fade in only on a step change, never on first paint.
  steps.forEach((step, i) => {
    step.hidden = i !== n - 1;
    step.classList.toggle("is-entering", moveFocus && i === n - 1);
  });
  label.textContent = "Step " + n + " of " + total;
  bar.style.width = (n / total) * 100 + "%";
  const step = steps[n - 1];
  onShow.forEach((fn) => fn(step));
  if (moveFocus) {
    window.scrollTo(0, 0);
    const target = step.querySelector("[data-step-focus]");
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}

/* Swipe left for the next step, right for the one before. Only a quick,
   clearly sideways swipe counts, so scrolling a step never turns the page.
   Ignored inside the six-answer sort (it has its own swipe) and near the
   screen's edges, where phones and in-app browsers use the swipe for Back. */
let touch = null;
guide.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  const edge = 30;
  touch = e.touches.length === 1 && !e.target.closest("[data-track]") &&
    t.clientX > edge && t.clientX < window.innerWidth - edge
    ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
}, { passive: true });
guide.addEventListener("touchend", (e) => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  const quick = Date.now() - touch.at < 600;
  touch = null;
  if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (String(window.getSelection())) return;
  if (dx < 0 && shown < total) go(shown + 1);
  else if (dx > 0) goBack();
}, { passive: true });

// Every step opens at its top, including after the device's Back button.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const sync = () => { if (fromHash() !== shown) show(fromHash(), true); };
window.addEventListener("popstate", sync);
window.addEventListener("hashchange", sync);

/* The six-answer sort: swipe, or tap Next once an answer is sorted. Swiping
   also skips ahead without sorting, because nothing here is ever locked.
   Card positions are measured only while the sort is on screen: a hidden
   step reports offsetLeft 0 for everything. */
document.querySelectorAll("[data-swipe]").forEach((wrap) => {
  const track = wrap.querySelector("[data-track]");
  const count = wrap.querySelector("[data-count]");
  const slides = [...track.querySelectorAll(".guide-slide")];
  const behavior = () => (reduceMotion() ? "auto" : "smooth");

  const current = () => {
    let best = 0;
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.offsetLeft - track.scrollLeft)) best = i;
    });
    return best;
  };

  track.addEventListener("scroll", () => { count.textContent = current() + 1; }, { passive: true });
  onShow.push((step) => { if (step.contains(wrap)) count.textContent = current() + 1; });

  const doneStep = steps.findIndex((s) => s.contains(wrap)) + 1;
  wrap.querySelector("[data-done]").addEventListener("click", () => go(doneStep + 1));

  slides.forEach((slide, i) => {
    const next = slide.querySelector("[data-next]");
    if (!next) return;
    next.addEventListener("click", () => {
      track.scrollTo({ left: slides[i + 1].offsetLeft - track.offsetLeft, behavior: behavior() });
      count.textContent = i + 2;
      slides[i + 1].querySelector(".check-option").focus({ preventScroll: true });
    });
  });
});

show(fromHash(), false);
guide.classList.add("is-stepping");
