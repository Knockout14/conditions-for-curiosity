import crypto from "node:crypto";

// Google Sheets access via a service account, signed by hand (RS256 JWT →
// OAuth token → Sheets API) rather than pulling in the `googleapis`
// package — keeps Functions small and dependency-free. Credentials live
// only in Netlify env vars (see conditions-for-curiosity-private/ for how
// they're loaded); nothing here is a secret itself. Shared by
// submit-pick.mjs and submit-circleback.mjs, which each append to a
// different tab of the same spreadsheet.

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Google service account env vars not set");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function appendRow(sheetTab, row) {
  const accessToken = await getAccessToken();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID not set");

  const range = encodeURIComponent(`${sheetTab}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) throw new Error(`sheets append failed: ${res.status} ${await res.text()}`);
}
