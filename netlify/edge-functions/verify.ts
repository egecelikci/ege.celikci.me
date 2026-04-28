import { decode as base64Decode } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const OWNER_PASSKEY_CONFIG = Deno.env.get("OWNER_PASSKEY_CONFIG");

/**
 * Converts a DER-encoded ECDSA signature (WebAuthn default) to a raw 64-byte format (R + S).
 */
function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 2;
  if (der[offset] !== 0x02) {
    throw new Error("Invalid DER: Expected marker 0x02 for R");
  }
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
  if (der[offset] !== 0x02) {
    throw new Error("Invalid DER: Expected marker 0x02 for S");
  }
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

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=/g,
    "",
  );
}

async function verifyPasskeySignature(
  assertion: any,
  expectedChallenge: string,
): Promise<boolean> {
  if (!OWNER_PASSKEY_CONFIG) {
    console.error("[verify] OWNER_PASSKEY_CONFIG missing");
    return false;
  }

  try {
    const config = JSON.parse(OWNER_PASSKEY_CONFIG);

    if (assertion.id !== config.id) {
      console.error("[verify] ID mismatch", {
        received: assertion.id,
        expected: config.id,
      });
      return false;
    }

    const clientDataJSONStr = new TextDecoder().decode(
      base64Decode(assertion.clientDataJSON),
    );
    const clientDataJSON = JSON.parse(clientDataJSONStr);

    const expectedChallengeBytes = Uint8Array.from(
      expectedChallenge,
      (c) => c.charCodeAt(0),
    );
    const expectedChallengeB64Url = toBase64Url(
      String.fromCharCode(...expectedChallengeBytes),
    );

    if (clientDataJSON.challenge !== expectedChallengeB64Url) {
      console.error("[verify] Challenge mismatch", {
        received: clientDataJSON.challenge,
        expected: expectedChallengeB64Url,
      });
      return false;
    }

    const origin = clientDataJSON.origin;
    const isAllowedOrigin = origin.includes("ege.celikci.me") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes(".ts.net") ||
      origin.includes("netlify.app");

    if (!isAllowedOrigin) {
      console.error("[verify] Origin not allowed:", origin);
      return false;
    }

    const authData = base64Decode(assertion.authenticatorData);
    const clientDataHash = await crypto.subtle.digest(
      "SHA-256",
      base64Decode(assertion.clientDataJSON),
    );

    const signedData = new Uint8Array(
      authData.length + clientDataHash.byteLength,
    );
    signedData.set(authData);
    signedData.set(new Uint8Array(clientDataHash), authData.length);

    const signatureRaw = derToRaw(base64Decode(assertion.signature));
    const key = await crypto.subtle.importKey(
      "spki",
      base64Decode(config.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      signatureRaw,
      signedData,
    );

    if (!isValid) {
      console.error("[verify] Cryptographic signature is invalid!");
    }

    return isValid;
  } catch (err) {
    console.error("[verify] Crypto verification error:", err);
    return false;
  }
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { assertion } = await req.json();

    if (!assertion || !OWNER_PASSKEY_CONFIG) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing config or assertion",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const isValid = await verifyPasskeySignature(assertion, "verify-session");

    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid signature or device mismatch",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[verify] Internal error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
