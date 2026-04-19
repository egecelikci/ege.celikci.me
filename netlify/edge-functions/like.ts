import { decode as base64Decode } from "https://deno.land/std@0.203.0/encoding/base64.ts";
import { ListenBrainzClient } from "https://esm.sh/jsr/@kellnerd/listenbrainz@0.9.2";

const LISTENBRAINZ_TOKEN = Deno.env.get("LISTENBRAINZ_TOKEN");
const OWNER_TOKEN = Deno.env.get("OWNER_TOKEN");
const OWNER_PASSKEY_CONFIG = Deno.env.get("OWNER_PASSKEY_CONFIG"); // JSON: { id, publicKey }

/**
 * Converts a DER-encoded ECDSA signature (WebAuthn default) to a raw 64-byte format (R + S).
 * Required for Deno's crypto.subtle.verify.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 2;
  if (der[offset] !== 0x02) throw new Error("Invalid DER: Expected marker 0x02 for R");
  const rLen = der[offset + 1];
  offset += 2;
  let r = der.slice(offset, offset + rLen);
  if (r.length === 33 && r[0] === 0x00) r = r.slice(1);
  if (r.length < 32) {
    const paddedR = new Uint8Array(32);
    paddedR.set(r, 32 - r.length);
    r = paddedR;
  }
  offset += rLen;
  if (der[offset] !== 0x02) throw new Error("Invalid DER: Expected marker 0x02 for S");
  const sLen = der[offset + 1];
  offset += 2;
  let s = der.slice(offset, offset + sLen);
  if (s.length === 33 && s[0] === 0x00) s = s.slice(1);
  if (s.length < 32) {
    const paddedS = new Uint8Array(32);
    paddedS.set(s, 32 - s.length);
    s = paddedS;
  }
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

async function verifyPasskey(assertionJson: string, expectedChallenge: string): Promise<boolean> {
  if (!OWNER_PASSKEY_CONFIG) return false;
  try {
    const config = JSON.parse(OWNER_PASSKEY_CONFIG);
    const assertion = JSON.parse(assertionJson);
    if (assertion.id !== config.id) return false;
    const clientDataJSON = JSON.parse(new TextDecoder().decode(base64Decode(assertion.clientDataJSON)));
    const receivedChallenge = clientDataJSON.challenge.replace(/-/g, "+").replace(/_/g, "/");
    const expectedChallengeB64 = btoa(expectedChallenge).replace(/=/g, "");
    if (receivedChallenge !== expectedChallengeB64) return false;
    const origin = clientDataJSON.origin;
    if (!origin.includes("ege.celikci.me") && !origin.includes("localhost") && !origin.includes(".ts.net")) return false;
    const authData = base64Decode(assertion.authenticatorData);
    const clientDataHash = await crypto.subtle.digest("SHA-256", base64Decode(assertion.clientDataJSON));
    const signedData = new Uint8Array(authData.length + clientDataHash.byteLength);
    signedData.set(authData);
    signedData.set(new Uint8Array(clientDataHash), authData.length);
    const signatureDer = base64Decode(assertion.signature);
    const signatureRaw = derToRaw(signatureDer);
    const key = await crypto.subtle.importKey("spki", base64Decode(config.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: { name: "SHA-256" } }, key, signatureRaw, signedData);
  } catch { return false; }
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  const passkeyHeader = req.headers.get("X-Passkey-Assertion");
  const bodyText = await req.text();
  let isAuthorized = false;
  if (OWNER_TOKEN && authHeader === `Bearer ${OWNER_TOKEN}`) isAuthorized = true;
  else if (passkeyHeader) {
    const { mbid } = JSON.parse(bodyText);
    isAuthorized = await verifyPasskey(passkeyHeader, "authorize-like-" + mbid);
  }
  if (!isAuthorized) return new Response("Unauthorized", { status: 401 });
  try {
    const { mbid, liked, isMsid } = JSON.parse(bodyText);
    const score = liked ? 1 : 0;
    if (!LISTENBRAINZ_TOKEN) return new Response("Server config error", { status: 500 });
    const client = new ListenBrainzClient({ userToken: LISTENBRAINZ_TOKEN });
    const feedbackBody: Record<string, any> = { score };
    if (isMsid) feedbackBody.recording_msid = mbid;
    else feedbackBody.recording_mbid = mbid;
    await client.post("1/feedback/recording-feedback", feedbackBody);
    return new Response(JSON.stringify({ success: true, score }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: err.statusCode || 500 });
  }
};
