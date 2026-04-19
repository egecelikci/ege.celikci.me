import gsap from "gsap";

/**
 * Owner Admin Utilities
 * High-security WebAuthn (Passkeys) for Android/Bitwarden support.
 */

const CHALLENGE = "ege-celikci-me-secure-challenge"; 

export async function registerPasskey(): Promise<string> {
  const rpId = window.location.hostname.includes("ege.celikci.me") ? "ege.celikci.me" : window.location.hostname;
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: Uint8Array.from(CHALLENGE, c => c.charCodeAt(0)),
    rp: { name: "ege.celikci.me", id: rpId },
    user: { id: Uint8Array.from("owner", c => c.charCodeAt(0)), name: "ege@celikci.me", displayName: "Ege Celikci" },
    pubKeyCredParams: [{alg: -7, type: "public-key"}], 
    authenticatorSelection: { userVerification: "required", residentKey: "preferred", requireResidentKey: false },
    timeout: 60000,
    attestation: "none",
  };
  const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions }) as PublicKeyCredential;
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKeyBuffer = response.getPublicKey();
  if (!publicKeyBuffer) throw new Error("No public key returned");
  return JSON.stringify({ id: credential.id, publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))) });
}

export async function signWithPasskey(payload: string): Promise<any> {
  const rpId = window.location.hostname.includes("ege.celikci.me") ? "ege.celikci.me" : window.location.hostname;
  const assertion = await navigator.credentials.get({
    publicKey: { challenge: Uint8Array.from(payload, c => c.charCodeAt(0)), allowCredentials: [], userVerification: "required", rpId: rpId }
  }) as PublicKeyCredential;
  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    id: assertion.id,
    authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
    clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
    signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
  };
}

export function initAuthModal() {
  const trigger = document.getElementById("status-auth-trigger");
  const modal = document.getElementById("status-auth-modal");
  const close = document.getElementById("status-auth-close");
  const loginBtn = document.getElementById("status-passkey-login") as HTMLButtonElement;
  const registerBtn = document.getElementById("status-passkey-register") as HTMLButtonElement;
  const label = document.getElementById("status-auth-label");
  const initialView = document.getElementById("status-auth-initial");
  const successView = document.getElementById("status-auth-success");
  const configOutput = document.getElementById("status-config-output") as HTMLInputElement;
  const copyBtn = document.getElementById("status-config-copy");

  if (!trigger || !modal || !initialView || !successView) return;

  if (localStorage.getItem("status_owner_verified") === "true") trigger.classList.add("text-primary", "opacity-100");

  trigger.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    gsap.fromTo(modal, { xPercent: 100, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.4, ease: "power4.out" });
  };

  const closeModal = (delay = 0) => {
    const run = () => {
      gsap.to(modal, { xPercent: 100, opacity: 0, duration: 0.3, ease: "power4.in", onComplete: () => {
        modal.classList.add("hidden"); modal.classList.remove("flex");
        loginBtn.innerText = "Authorize"; loginBtn.disabled = false;
        initialView.classList.remove("hidden"); successView.classList.add("hidden");
        if (label) label.innerText = "Security";
      }});
    };
    if (delay > 0) setTimeout(run, delay); else run();
  };

  close!.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };

  loginBtn!.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    loginBtn.disabled = true; loginBtn.innerText = "...";
    try {
      if (await signWithPasskey("verify-session")) {
        localStorage.setItem("status_owner_verified", "true");
        trigger.classList.add("text-primary", "opacity-100");
        loginBtn.innerText = "Authorized";
        closeModal(800);
      }
    } catch (err) {
      console.error(err); loginBtn.innerText = "Error";
      setTimeout(() => { loginBtn.innerText = "Authorize"; loginBtn.disabled = false; }, 2000);
    }
  };

  registerBtn!.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    registerBtn.disabled = true;
    try {
      const config = await registerPasskey();
      gsap.to(initialView, { opacity: 0, y: -5, duration: 0.2, onComplete: () => {
        initialView.classList.add("hidden"); successView.classList.remove("hidden");
        if (label) label.innerText = "Success";
        if (configOutput) configOutput.value = config;
        gsap.fromTo(successView, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.3 });
      }});
    } catch (err) { console.error(err); } finally { registerBtn.disabled = false; }
  };

  if (copyBtn && configOutput) {
    copyBtn.onclick = (e) => {
      e.preventDefault(); configOutput.select(); navigator.clipboard.writeText(configOutput.value);
      copyBtn.innerText = "OK"; setTimeout(() => { copyBtn.innerText = "Copy"; }, 1500);
    };
  }

  document.addEventListener("click", (e) => {
    if (!modal.classList.contains("hidden") && !modal.contains(e.target as Node) && e.target !== trigger) closeModal();
  });
}
