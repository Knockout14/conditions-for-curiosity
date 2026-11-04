// The app's front door, kept so links to /app/ and /app/index.html still work.
// The episode 5 gate that used to live here is now a line on the details
// screen (KO, 2026-11-03), so everyone goes straight to wherever they're up to:
// details for a new visitor, otherwise their pick or this week's three.
location.replace(CFC.resumeUrl(CFC.load()));
