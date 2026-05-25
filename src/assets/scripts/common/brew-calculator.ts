/**
 * brew-calculator.ts
 * Simple coffee brewing calculator logic.
 */

export function initBrewCalculator() {
  const input = document.getElementById("coffee-input") as HTMLInputElement;
  const outCoffee = document.getElementById("out-coffee");
  const outIce = document.getElementById("out-ice");
  const outHot = document.getElementById("out-hot");
  const outBloom = document.getElementById("out-bloom");

  if (!input || !outCoffee || !outIce || !outHot || !outBloom) return;

  function calculate() {
    const vol = parseFloat(input.value) || 0;
    const coffee = vol * (65 / 1000);

    outCoffee!.textContent = coffee.toFixed(1);
    outIce!.textContent = Math.round(vol * 0.4).toString();
    outHot!.textContent = Math.round(vol * 0.6).toString();
    outBloom!.textContent = Math.round(coffee * 3).toString();
  }

  input.addEventListener("input", calculate);
}
