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
    });
  });
});
