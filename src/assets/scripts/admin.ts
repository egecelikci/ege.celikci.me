import gsap from "gsap";

/**
 * Owner Admin Utilities
 * High-security WebAuthn (Passkeys) for Android/Bitwarden support.
 */

const CHALLENGE = "ege-celikci-me-secure-challenge";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Intent persistence: store a callback to run after successful verification
let pendingVerificationAction: (() => void) | null = null;

export async function registerPasskey(): Promise<string> {
  const rpId = globalThis.location.hostname.includes("ege.celikci.me",)
    ? "ege.celikci.me"
    : globalThis.location.hostname;
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
    {
      challenge: Uint8Array.from(CHALLENGE, (c,) => c.charCodeAt(0,),),
      rp: { name: "ege.celikci.me", id: rpId, },
      user: {
        id: Uint8Array.from("owner", (c,) => c.charCodeAt(0,),),
        name: "ege@celikci.me",
        displayName: "Ege Celikci",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key", },],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: "none",
    };
  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  },) as PublicKeyCredential;
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKeyBuffer = response.getPublicKey();
  if (!publicKeyBuffer) throw new Error("No public key returned",);

  const config = JSON.stringify({
    id: credential.id,
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer,),),),
  },);

  // Store passkey info locally
  localStorage.setItem("status_passkey_config", config,);
  localStorage.setItem("status_passkey_enrolled", "true",);

  return config;
}

/**
 * Helper to convert base64/url to buffer
 */
function bufferFromBase64(base64: string): Uint8Array {
  const bin = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function signWithPasskey(payload: string,): Promise<any> {
  const rpId = globalThis.location.hostname.includes("ege.celikci.me",)
    ? "ege.celikci.me"
    : globalThis.location.hostname;

  const configStr = localStorage.getItem("status_passkey_config",);
  const allowCredentials: PublicKeyCredentialDescriptor[] = [];
  
  if (configStr) {
    try {
      const config = JSON.parse(configStr,);
      allowCredentials.push({
        id: bufferFromBase64(config.id),
        type: "public-key",
      });
    } catch (e) {
      console.warn("[auth] Failed to parse enrolled key ID", e);
    }
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: Uint8Array.from(payload, (c,) => c.charCodeAt(0,),),
      allowCredentials,
      userVerification: "required",
      rpId: rpId,
    },
  },) as PublicKeyCredential;

  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    id: assertion.id,
    authenticatorData: btoa(
      String.fromCharCode(...new Uint8Array(response.authenticatorData,),),
    ),
    clientDataJSON: btoa(
      String.fromCharCode(...new Uint8Array(response.clientDataJSON,),),
    ),
    signature: btoa(
      String.fromCharCode(...new Uint8Array(response.signature,),),
    ),
  };
}

/**
 * Persistence Logic
 */
function setVerifiedSession(assertion?: any) {
  const expiry = Date.now() + SESSION_DURATION;
  localStorage.setItem("status_owner_verified", "true",);
  localStorage.setItem("status_session_expiry", expiry.toString(),);
  
  // Implicitly recognize the device ID if verified successfully
  if (assertion && assertion.id) {
     const existingConfig = localStorage.getItem("status_passkey_config");
     if (!existingConfig) {
        localStorage.setItem("status_passkey_config", JSON.stringify({ id: assertion.id, publicKey: "" }));
        localStorage.setItem("status_passkey_enrolled", "true");
     }
  }
  
  updatePasskeyInfoUI();
}

function clearSession() {
  localStorage.removeItem("status_owner_verified",);
  localStorage.removeItem("status_session_expiry",);
  updatePasskeyInfoUI();
}

export function isSessionValid(): boolean {
  const verified = localStorage.getItem("status_owner_verified",) === "true";
  const expiryStr = localStorage.getItem("status_session_expiry",);
  if (!expiryStr) return false;
  
  const expiry = parseInt(expiryStr,);
  const isValid = verified && Date.now() < expiry;
  
  if (verified && !isValid) {
    clearSession();
  }
  return isValid;
}

/**
 * Open the auth modal
 */
export function openAuthModal(onSuccess?: () => void) {
  const modal = document.getElementById("status-auth-modal",);
  const innerCard = modal?.querySelector("#status-auth-card",);
  if (!modal || !innerCard) return;

  // Store intent
  if (onSuccess) {
    pendingVerificationAction = onSuccess;
  }

  modal.classList.remove("hidden",);
  modal.classList.add("flex",);
  void (innerCard as HTMLElement).offsetHeight; // Force reflow
  modal.classList.add("opened",);

  // Initialize UI state
  const initialView = document.getElementById("status-auth-initial",);
  const detailsView = document.getElementById("status-passkey-details",);
  if (initialView && detailsView) {
    initialView.classList.remove("hidden");
    initialView.style.opacity = "1";
    initialView.style.transform = "none";
    detailsView.classList.add("hidden",);
  }

  updatePasskeyInfoUI();
}

function updatePasskeyInfoUI() {
  const passkeyInfo = document.getElementById("status-passkey-info",);
  const passkeyLabel = document.getElementById("status-passkey-label",);
  const registerBtn = document.getElementById("status-passkey-register",);
  const verifiedBadge = document.getElementById("status-verified-badge",);
  
  const isEnrolled = localStorage.getItem("status_passkey_enrolled",) === "true";
  const verified = isSessionValid();

  if (verifiedBadge) {
    verifiedBadge.classList.toggle("flex", verified,);
    verifiedBadge.classList.toggle("hidden", !verified,);
  }

  if (isEnrolled || verified) {
    passkeyInfo?.classList.remove("hidden",);
    registerBtn?.classList.add("hidden",);
    if (passkeyLabel) {
      const statusText = verified ? "Active Session" : "Device Recognized";
      passkeyLabel.textContent = `eg • ${statusText}`;
    }
  } else {
    passkeyInfo?.classList.add("hidden",);
    registerBtn?.classList.remove("hidden",);
  }
}

/**
 * Animated view switching
 */
function switchModalView(to: "initial" | "details",) {
  const initial = document.getElementById("status-auth-initial",);
  const details = document.getElementById("status-passkey-details",);
  if (!initial || !details) return;

  const isGoingToDetails = to === "details";
  const incoming = isGoingToDetails ? details : initial;
  const outgoing = isGoingToDetails ? initial : details;

  const tl = gsap.timeline();

  tl.to(outgoing, {
    opacity: 0,
    x: isGoingToDetails ? -15 : 15,
    duration: 0.2,
    ease: "power2.in",
    onComplete: () => {
      outgoing.classList.add("hidden",);
      incoming.classList.remove("hidden",);
      gsap.set(incoming, {
        opacity: 0,
        x: isGoingToDetails ? 15 : -15,
      },);
    },
  },);

  tl.to(incoming, {
    opacity: 1,
    x: 0,
    duration: 0.3,
    ease: "power2.out",
  },);
}

/**
 * Close the auth modal
 */
export function closeAuthModal() {
  const modal = document.getElementById("status-auth-modal",);
  if (!modal) return;

  // Clear intent on close
  pendingVerificationAction = null;

  modal.classList.remove("opened",);
  setTimeout(() => {
    if (modal.classList.contains("opened",)) return;
    modal.classList.remove("flex",);
    modal.classList.add("hidden",);
  }, 700,);
}

export function initAuthModal() {
  const modal = document.getElementById("status-auth-modal",);
  const closeBtn = document.getElementById("status-auth-close",);
  const loginBtn = document.getElementById("status-passkey-login",) as HTMLButtonElement;
  const registerBtn = document.getElementById("status-passkey-register",) as HTMLButtonElement;
  const viewDetailsBtn = document.getElementById("-status-view-passkey",);
  const backToMainBtn = document.getElementById("-status-back-to-main",);
  const copyBtn = document.getElementById("-status-details-copy",);
  const removeBtn = document.getElementById("-status-details-remove",);
  const statusText = document.getElementById("status-auth-status-text",);
  const detailJson = document.getElementById("-status-passkey-detail-json",) as HTMLTextAreaElement;

  if (!modal) return;
  const innerCard = modal.querySelector("#status-auth-card",) as HTMLElement;

  updatePasskeyInfoUI();

  // Navigation listeners
  closeBtn?.addEventListener("click", () => closeAuthModal(),);
  viewDetailsBtn?.addEventListener("click", () => {
    const config = localStorage.getItem("status_passkey_config",);
    if (detailJson && config) detailJson.value = config;
    switchModalView("details",);
  },);
  backToMainBtn?.addEventListener("click", () => switchModalView("initial",),);

  copyBtn?.addEventListener("click", () => {
    const config = localStorage.getItem("status_passkey_config",);
    if (config) {
      navigator.clipboard.writeText(config,).then(() => {
        const originalText = copyBtn.querySelector("span",)?.textContent;
        copyBtn.querySelector("span",)!.textContent = "JSON Copied";
        setTimeout(() => {
          copyBtn.querySelector("span",)!.textContent = originalText || "Copy JSON";
        }, 1500,);
      },);
    }
  },);

  removeBtn?.addEventListener("click", () => {
    if (confirm("Delete hardware key from browser cache? Identity will no longer be confirmed.",)) {
      localStorage.removeItem("status_passkey_config",);
      localStorage.removeItem("status_passkey_enrolled",);
      clearSession();
      switchModalView("initial",);
    }
  },);

  // Verification Logic
  loginBtn?.addEventListener("click", async () => {
    loginBtn.disabled = true;
    if (statusText) {
      statusText.innerText = "Synchronizing...";
      statusText.classList.remove("text-primary", "text-status-error");
      statusText.classList.add("opacity-100");
    }

    try {
      const assertion = await signWithPasskey("verify-session",);
      if (assertion) {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assertion }),
        });

        if (res.ok) {
          setVerifiedSession(assertion);
          if (statusText) {
            statusText.innerText = "Identity Confirmed";
            statusText.classList.add("text-primary");
          }
          
          // Execute pending action if any
          if (pendingVerificationAction) {
            const action = pendingVerificationAction;
            pendingVerificationAction = null;
            setTimeout(() => {
              action();
              closeAuthModal();
            }, 600);
          } else {
            setTimeout(closeAuthModal, 1000,);
          }
        } else {
          throw new Error("SERVER_REJECTED");
        }
      }
    } catch (err: any) {
      console.error("[auth] Verification failed:", err,);
      
      let message = "Verification Failed";
      if (err.message === "SERVER_REJECTED") message = "Invalid Key";
      if (err.name === "NotAllowedError") message = "Verification Cancelled";

      if (statusText) {
        statusText.innerText = message;
        statusText.classList.add("text-status-error");
      }

      gsap.to(innerCard, { x: 8, duration: 0.05, repeat: 5, yoyo: true, onComplete: () => gsap.set(innerCard, { x: 0 }), },);
      
      setTimeout(() => {
        if (statusText) {
          statusText.innerText = "Identity not confirmed";
          statusText.classList.remove("text-status-error", "opacity-100");
        }
        loginBtn.disabled = false;
      }, 2000,);

      clearSession();
    }
  },);

  registerBtn?.addEventListener("click", async () => {
    registerBtn.disabled = true;
    if (statusText) {
      statusText.innerText = "Provisioning Key...";
      statusText.classList.remove("text-primary", "text-status-error");
      statusText.classList.add("opacity-100");
    }

    try {
      const config = await registerPasskey();
      if (statusText) {
        statusText.innerText = "Token Provisioned";
        statusText.classList.add("text-primary");
      }
      if (detailJson) detailJson.value = config;
      updatePasskeyInfoUI();
      setTimeout(() => switchModalView("details",), 800,);
    } catch (err) {
      console.error("[auth] Registration failed:", err,);
      if (statusText) {
        statusText.innerText = "Provisioning Failed";
        statusText.classList.add("text-status-error");
        gsap.to(innerCard, { x: 8, duration: 0.05, repeat: 5, yoyo: true, onComplete: () => gsap.set(innerCard, { x: 0 }), },);
      }
      setTimeout(() => {
        if (statusText) statusText.classList.remove("text-status-error", "opacity-100");
      }, 2000,);
    } finally {
      registerBtn.disabled = false;
    }
  },);

  // Outside click logic
  document.addEventListener("click", (e) => {
    if (modal.classList.contains("opened",) && !innerCard.contains(e.target as Node,)) {
      closeAuthModal();
    }
  },);
}
