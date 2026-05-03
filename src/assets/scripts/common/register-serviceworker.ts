/**
 * Service Worker Registration
 * Handles lifecycle registration with a readyState failsafe to prevent
 * race conditions when dynamically imported.
 */

function register() {
  navigator.serviceWorker.register("/sw.js")
    .then((registration) => {
      console.log("[SW] Registered successfully:", registration.scope);
    })
    .catch((error) => {
      console.error("[SW] Registration failed:", error);
    });
}

if ("serviceWorker" in navigator) {
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }
}
