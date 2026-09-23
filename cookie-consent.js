/* Conditions for Curiosity — cookie consent + gated GA4 loading.
   Shared across the marketing site only (index/model/privacy/terms/404) —
   the app deliberately isn't tracked, see app/status-2026-09-01.md.

   The one rule this file exists to enforce: the GA4 script tag never
   touches the page until someone clicks Accept. Not loaded-quietly-then-
   hidden-behind-a-banner — not requested at all. Decline (or never
   answering) means zero analytics network requests, full stop. */
(function () {
  "use strict";

  var CONSENT_KEY = "cfc_analytics_consent"; // "granted" | "denied"
  var GA_ID = "G-NM3Z3L0YVV";

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null; // storage disabled/private browsing — treat as unanswered, never as granted
    }
  }
  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      /* nothing to do — consent just won't be remembered next visit */
    }
  }

  function loadGA() {
    if (window.__cfcGaLoaded) return;
    window.__cfcGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  var STYLE =
    ".cfc-cc{position:fixed;left:0;right:0;bottom:0;z-index:9999;" +
    "background:#0A1523;border-top:1px solid rgba(237,193,96,.22);" +
    "padding:16px 20px calc(16px + env(safe-area-inset-bottom));" +
    "display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;" +
    'font-family:"Karla",system-ui,sans-serif;box-shadow:0 -8px 24px rgba(0,0,0,.3)}' +
    ".cfc-cc p{margin:0;font-size:13px;line-height:1.55;color:rgba(246,245,242,.75);flex:1 1 280px;min-width:0}" +
    ".cfc-cc a{color:#EDC160}" +
    ".cfc-cc-actions{display:flex;gap:10px;flex:none}" +
    ".cfc-cc button{font-family:inherit;font-size:13px;font-weight:600;border-radius:3px;" +
    "padding:9px 18px;cursor:pointer;border:1px solid rgba(246,245,242,.24);background:transparent;color:#F6F5F2}" +
    ".cfc-cc button:hover{border-color:#F6F5F2}" +
    ".cfc-cc button.cfc-cc-accept{background:#EDC160;border-color:#EDC160;color:#050C16}" +
    ".cfc-cc button.cfc-cc-accept:hover{background:#FDD284;border-color:#FDD284}" +
    ".cfc-cc button:focus-visible{outline:2px solid #EDC160;outline-offset:2px}" +
    "@media (max-width:480px){.cfc-cc{flex-direction:column;align-items:stretch;" +
    "padding:12px 16px calc(12px + env(safe-area-inset-bottom));gap:10px}" +
    // `.cfc-cc p{flex:1 1 280px}` sets a 280px *width* basis for the row
    // layout above — harmless there, but flex-basis controls the main axis,
    // and flipping to flex-direction:column makes that axis vertical. Left
    // unset here, the paragraph was being told to claim up to 280px of
    // *height* on a phone, which is the actual banner-too-tall bug.
    ".cfc-cc p{flex-basis:auto}" +
    ".cfc-cc-actions{justify-content:stretch}.cfc-cc button{flex:1}}";

  function ensureStyle() {
    if (document.getElementById("cfc-cc-style")) return;
    var style = document.createElement("style");
    style.id = "cfc-cc-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function removeBanner() {
    var el = document.getElementById("cfc-cc-banner");
    if (el) el.remove();
  }

  function showBanner() {
    ensureStyle();
    removeBanner();
    var el = document.createElement("div");
    el.id = "cfc-cc-banner";
    el.className = "cfc-cc";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Cookie consent");
    el.innerHTML =
      "<p>I use Google Analytics to see which pages and episodes people are finding — " +
      'nothing loads until you click Accept. <a href="privacy.html">Privacy policy</a></p>' +
      '<div class="cfc-cc-actions">' +
      '<button type="button" class="cfc-cc-decline">Decline</button>' +
      '<button type="button" class="cfc-cc-accept">Accept</button>' +
      "</div>";
    document.body.appendChild(el);
    el.querySelector(".cfc-cc-accept").addEventListener("click", function () {
      setConsent("granted");
      loadGA();
      removeBanner();
    });
    el.querySelector(".cfc-cc-decline").addEventListener("click", function () {
      setConsent("denied");
      removeBanner();
    });
  }

  // Lets anyone change their mind later — appended to whichever footer
  // paragraph the page has, regardless of its class name (model.html uses
  // .site-footer, the rest use .bay; <footer><p> is the one thing common
  // to all five marketing pages).
  function wireFooterLink() {
    var p = document.querySelector("footer p");
    if (!p || document.getElementById("cfc-cc-link")) return;
    var link = document.createElement("a");
    link.id = "cfc-cc-link";
    link.href = "#";
    link.textContent = "Cookie preferences";
    link.addEventListener("click", function (e) {
      e.preventDefault();
      showBanner();
    });
    p.appendChild(document.createTextNode(" · "));
    p.appendChild(link);
  }

  var consent = getConsent();
  if (consent === "granted") {
    loadGA();
  } else if (consent !== "denied") {
    showBanner();
  }
  wireFooterLink();
})();
