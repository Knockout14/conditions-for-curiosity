const form = document.getElementById("details-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");

// Restore anything already saved (e.g. returning to edit from a later screen).
const existing = CFC.load();
if (existing.name) nameInput.value = existing.name;
if (existing.email) emailInput.value = existing.email;
if (existing.ageBand) {
  const radio = form.querySelector(`input[name="ageBand"][value="${existing.ageBand}"]`);
  if (radio) radio.checked = true;
}

// Native constraint validation (required name, required-as-a-group age
// radios, type=email format) does the checking — reportValidity() shows
// the browser's own inline message pointing at whichever field is
// actually incomplete, instead of a silently-disabled button.
document.getElementById("continue-btn").disabled = false; // see the note in details.html
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const ageBand = form.querySelector('input[name="ageBand"]:checked').value;
  // saveDetails also drops unconfirmed pick candidates if the age band
  // changed, since they were drawn for the old one.
  const newState = CFC.saveDetails({
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    ageBand,
  });
  location.href = CFC.resumeUrl(newState);
});
