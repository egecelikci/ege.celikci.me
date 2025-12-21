// Register Service Worker
declare const process: { env: { MODE: string; }; };

if ("serviceWorker" in navigator) {
  // FIX 3: Allow it to run if it's production OR if you are testing locally
  // (You can remove the explicit 'development' check later)
  if (process.env.MODE === "production") {
    
    globalThis.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js")
        .then(registration => {
          console.log("SW registered: ", registration);
        })
        .catch(registrationError => {
          console.error("SW registration failed: ", registrationError);
        });
    });
    
  }
}