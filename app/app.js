/* Conditions for Curiosity — app
   Shared client-side state. No backend yet (per app-v1-spec-2026-09-01.md
   §2): continuity rests on this device, via a random session id and a
   localStorage record of onboarding progress. Nothing here is sent
   anywhere — it's a placeholder for the lightweight backend described
   in the spec, so the shape (session id, name, email, age band) matches
   what that backend will eventually receive. */

(function (global) {
  const STORAGE_KEY = "cfc_app_state";

  function randomId() {
    if (global.crypto && global.crypto.randomUUID) {
      return global.crypto.randomUUID();
    }
    // Fallback for older mobile browsers without crypto.randomUUID.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function load() {
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      state = {};
    }
    if (!state.sessionId) {
      state.sessionId = randomId();
      save(state);
    }
    return state;
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private browsing / storage disabled — onboarding still works
         within a single page-load, it just won't persist across screens */
    }
    return state;
  }

  function patch(partial) {
    const state = Object.assign(load(), partial);
    return save(state);
  }

  /* Redirects to `fallback` if `test(state)` fails, otherwise returns the
     state. Use at the top of a screen that depends on an earlier one
     having been completed, so a deep link can't strand someone on a
     screen with nothing to show. */
  function requireStep(test, fallback) {
    const state = load();
    if (!test(state)) {
      location.replace(fallback);
      return null;
    }
    return state;
  }

  /* Same idea as requireStep, but walks the whole onboarding chain, so a
     screen past onboarding always bounces to the earliest incomplete
     step rather than a generic fallback. */
  function requireOnboarding() {
    const state = load();
    if (!state.episode5) return void location.replace("index.html");
    if (!(state.name && state.ageBand)) return void location.replace("details.html");
    if (!state.onboardingComplete) return void location.replace("check.html");
    return state;
  }

  /* The full chain through the one-time commitment moment: where should
     someone land next, given what they've already done? Used so editing
     your details from check/pick/confirm returns you to wherever you'd
     actually gotten to, instead of re-running the whole sequence — and
     so a page can guard itself by checking "is this actually my step." */
  function resumeUrl(state) {
    if (!state.episode5) return "index.html";
    if (!(state.name && state.ageBand)) return "details.html";
    if (!state.onboardingComplete) return "check.html";
    if (!state.weeklyPick) return "pick.html";
    if (!state.commitConfirmed) return "confirm.html";
    return "complete.html";
  }

  /* ── question bank access ──
     The bank itself (all 165 questions, fully tagged) is proprietary and
     lives only in Netlify Blobs, read by two Functions under
     netlify/functions/ — never as a static file the browser can fetch
     wholesale. Each endpoint hands back only the fields the calling
     screen renders: candidates get text + tag, a confirmed pick's
     questions get the seed/prep too, and questions-by-ids caps how many
     ids it'll answer in one call so it can't be turned into a bulk dump
     of the bank. These two calls are the entire surface the front-end
     has onto the data — nothing here ever holds the full bank. */

  async function postJSON(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  }

  /* Three candidates for the weekly pick (spec §3b), sampled server-side:
     one guaranteed Math question, one guaranteed General-or-Both, a
     third from whatever's left in the age-matched Raw/Found pool.
     Already-asked questions are excluded until the pool would come up
     short. */
  function fetchWeeklyCandidates(state) {
    return postJSON("/api/weekly-candidates", {
      ageBand: state.ageBand,
      askedQuestionIds: state.askedQuestionIds || [],
    });
  }

  /* Full fields for a specific, already-confirmed set of question ids —
     used for the "you're set" summary, editing an active pick, and
     later the nightly loop. Never for browsing the bank at large. */
  function fetchQuestionsByIds(ids) {
    if (!ids.length) return Promise.resolve([]);
    return postJSON("/api/questions-by-ids", { ids });
  }

  /* One replacement candidate for the weekly pick's "swap one" allowance
     — same age-matched Raw/Found pool, excluding both already-asked
     questions and whatever's currently on the table (so the replacement
     can't just be one of the other two). */
  function fetchReplacementCandidate(state, excludeIds) {
    return postJSON("/api/weekly-candidates", {
      ageBand: state.ageBand,
      askedQuestionIds: state.askedQuestionIds || [],
      excludeIds,
      count: 1,
    }).then((r) => r[0] || null);
  }

  /* Records a confirmed weekly pick to the founder's spreadsheet (spec
     §2/§3e's "lightweight backend"). `questions` is the ranked array of
     full question objects (id, text, domain, bigIdea/category) the pick
     screen already has in hand. Best-effort — a family's local state is
     already saved by the time this is called, so a network hiccup here
     shouldn't block them from moving on. */
  function submitPick(state, questions) {
    return postJSON("/api/submit-pick", {
      sessionId: state.sessionId,
      name: state.name,
      email: state.email,
      ageBand: state.ageBand,
      checkAnswers: state.checkAnswers,
      questions,
    }).catch((e) => console.error("submitPick failed (continuing anyway):", e));
  }

  /* ── the nightly loop ──
     One question, in ranked order, per session (spec §3c). "Which one is
     next" is always computed the same way — first of the week's three
     not yet in askedQuestionIds — so the calendar buttons, the open
     screen, and the summary screen can never disagree with each other. */
  function nextQuestion(state, questions) {
    const asked = new Set(state.askedQuestionIds || []);
    const idx = questions.findIndex((q) => !asked.has(q.id));
    return idx === -1 ? null : { question: questions[idx], index: idx };
  }

  /* The one write circle-back triggers (per this session's design
     discussion): the question actually got asked, so it's crossed off
     for good — excluded from future weeks' sampling, not just this
     one's. usedCount advances one at a time, not by however many are
     left, so pick.html's "week's still active" check stays accurate
     after just one question instead of jumping straight to "done." */
  function markQuestionAsked(state, questionId) {
    const askedQuestionIds = (state.askedQuestionIds || []).concat(questionId);
    const usedCount = Math.min(3, (state.weeklyPick.usedCount || 0) + 1);
    return patch({
      askedQuestionIds,
      weeklyPick: Object.assign({}, state.weeklyPick, { usedCount }),
    });
  }

  /* In-progress state for the current question, between the open screen
     and circle-back — sessionStorage, not localStorage: it's scratch for
     tonight's single pass through the loop, not something that should
     outlive the tab or follow the family into next week. */
  const SESSION_KEY = "cfc_current_question";
  function saveCurrentQuestion(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function loadCurrentQuestion() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  /* Circle-back submissions (spec §3d) go to their own sheet tab — same
     spreadsheet as the pick confirmations, different shape of row. */
  function submitCircleBack(state, payload) {
    return postJSON("/api/submit-circleback", {
      sessionId: state.sessionId,
      name: state.name,
      email: state.email,
      ageBand: state.ageBand,
      ...payload,
    }).catch((e) => console.error("submitCircleBack failed (continuing anyway):", e));
  }

  /* ── calendar reminders ──
     No push/email service, no permission prompt — a real Google Calendar
     prefill link plus an .ics download for Apple Calendar, the same
     pair used for "remind me tonight" and now "when should next week
     start." Shared here so both call sites build the exact same way. */
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function toStampDate(date) {
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  }

  function nextEventStart() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(19, 0, 0, 0); // 7pm local — a default, editable in either calendar app
    if (start <= now) start.setDate(start.getDate() + 1);
    return start;
  }

  /* "Anytime after 12pm Sunday" (current working default for when a new
     week should start) — the coming Sunday at noon, or the Sunday after
     if it's already past noon today and today happens to be Sunday. */
  function nextSundayNoon() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(12, 0, 0, 0);
    let daysUntilSunday = (7 - start.getDay()) % 7;
    if (daysUntilSunday === 0 && start <= now) daysUntilSunday = 7;
    start.setDate(start.getDate() + daysUntilSunday);
    return start;
  }

  function wireCalendarButtons(gcalEl, icsBtnEl, { title, description, url, start, durationMinutes = 15, uid }) {
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    if (gcalEl) {
      const gcal = new URL("https://calendar.google.com/calendar/render");
      gcal.searchParams.set("action", "TEMPLATE");
      gcal.searchParams.set("text", title);
      gcal.searchParams.set("dates", `${toStampDate(start)}/${toStampDate(end)}`);
      gcal.searchParams.set("details", description);
      gcalEl.href = gcal.toString();
    }

    if (icsBtnEl) {
      icsBtnEl.addEventListener("click", () => {
        const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Conditions for Curiosity//App//EN",
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${toStampDate(new Date())}`,
          `DTSTART:${toStampDate(start)}`,
          `DTEND:${toStampDate(end)}`,
          `SUMMARY:${esc(title)}`,
          `DESCRIPTION:${esc(description)}`,
          `URL:${url}`,
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          "DESCRIPTION:Reminder",
          "TRIGGER:-PT0M",
          "END:VALARM",
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");

        const blob = new Blob([ics], { type: "text/calendar" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "conditions-for-curiosity-reminder.ics";
        link.click();
        URL.revokeObjectURL(link.href);
      });
    }
  }

  global.CFC = {
    load,
    save,
    patch,
    requireStep,
    requireOnboarding,
    resumeUrl,
    fetchWeeklyCandidates,
    fetchQuestionsByIds,
    fetchReplacementCandidate,
    submitPick,
    nextQuestion,
    markQuestionAsked,
    saveCurrentQuestion,
    loadCurrentQuestion,
    submitCircleBack,
    nextEventStart,
    nextSundayNoon,
    wireCalendarButtons,
  };
})(window);
