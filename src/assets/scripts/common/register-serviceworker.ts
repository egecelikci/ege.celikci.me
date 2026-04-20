// Register Service Worker
if ("serviceWorker" in navigator) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js",)
      .then(registration => {
        console.log("SW registered: ", registration,);
      },)
      .catch(registrationError => {
        console.error("SW registration failed: ", registrationError,);
      },);
  },);
}
