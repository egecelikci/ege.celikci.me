// Register Service Worker
declare const process: { env: { MODE: string; }; };

if ("serviceWorker" in navigator) {
  if (process.env.MODE === "production") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js",).catch(
        (registrationError,) => {
          console.error("SW registration failed: ", registrationError,);
        },
      );
    },);
  }
}

// disable PWA install prompt
window.addEventListener("beforeinstallprompt", (e,) => e.preventDefault(),);
