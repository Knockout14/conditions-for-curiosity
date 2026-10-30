/* The optional guide. Tapping an option shows its feedback, and that's all:
   nothing is saved or sent, nothing is scored, and nothing is ever locked, so
   this page deliberately doesn't load app.js. */
document.querySelectorAll("[data-choice]").forEach((group) => {
  const options = group.querySelectorAll(".check-option");
  options.forEach((option) => {
    option.addEventListener("click", () => {
      options.forEach((o) => o.classList.remove("tapped", "correct", "incorrect"));
      group.querySelectorAll(".guide-fb").forEach((fb) => { fb.hidden = true; });
      option.classList.add("tapped", option.hasAttribute("data-right") ? "correct" : "incorrect");
      document.getElementById(option.dataset.fb).hidden = false;
      const next = group.querySelector("[data-next], [data-done]");
      if (next) next.hidden = false;
    });
  });
});

/* The six-answer sort: swipe, or tap Next once an answer is sorted. Swiping
   also skips ahead without sorting, because nothing here is ever locked. */
document.querySelectorAll("[data-swipe]").forEach((wrap) => {
  const track = wrap.querySelector("[data-track]");
  const count = wrap.querySelector("[data-count]");
  const slides = [...track.querySelectorAll(".guide-slide")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const current = () => {
    let best = 0;
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.offsetLeft - track.scrollLeft)) best = i;
    });
    return best;
  };

  track.addEventListener("scroll", () => { count.textContent = current() + 1; }, { passive: true });

  wrap.querySelector("[data-done]").addEventListener("click", () => {
    wrap.nextElementSibling.scrollIntoView({ behavior: motion, block: "start" });
  });

  slides.forEach((slide, i) => {
    const next = slide.querySelector("[data-next]");
    if (!next) return;
    next.addEventListener("click", () => {
      track.scrollTo({ left: slides[i + 1].offsetLeft - track.offsetLeft, behavior: motion });
      slides[i + 1].querySelector(".check-option").focus({ preventScroll: true });
    });
  });
});
