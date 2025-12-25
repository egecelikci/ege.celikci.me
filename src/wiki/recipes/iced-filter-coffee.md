---
title: iced filter coffee
status: evergreen
date: 2025-12-23
updated: 2025-12-25
tags: ["coffee"]
templateEngine: [vto, md]
---

this is the recipe from James Hoffmann

{{ comp.youtube({
id: "PApBycDrPo0",
title: "How to Make Iced Filter Coffee by James Hoffmann"
}) }}

## ingredients

- 65g coffee per litre (or 5 grams more than you usually do)
- 32.5g coffee/500ml
- 40% of water will be ice is which is 200g ice
- 60% of water will be hot water which is 300g hot water

## instructions

- 97g bloom (45 seconds) then stir bloom
- pour remaining water in 2:30 to 3 minutes
- stir once circular motion once in opposite motion
- after drawdown, swirl canister to melt ice
- serve on fresh ice

## calculator

<div class="p-6 bg-surface border border-border rounded-xl my-8 not-prose shadow-sm">
  <div class="flex items-center gap-2 mb-4 text-primary">
    {{ comp.icon({ name: "calculator", type: "lucide", classes: "w-5 h-5" }) }}<h3 class="font-bold text-lg m-0 text-text">Brew Calculator</h3>
  </div>

<div class="flex flex-col gap-6">
    <label class="flex flex-col gap-2">
      <span class="text-xs font-bold uppercase tracking-widest text-text-muted">Target Volume (ml)</span>
      <input
        type="number"
        id="coffee-input"
        value="500"
        step="50"
        class="w-full px-4 py-3 bg-bg border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none font-mono text-lg transition-all"
      >
    </label>
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="p-4 bg-bg/50 rounded-lg border border-border/50 flex flex-col justify-between gap-1">
        <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">Coffee</span>
        <span class="font-mono font-bold text-xl"><span id="out-coffee">32.5</span>g</span>
      </div>
      <div class="p-4 bg-bg/50 rounded-lg border border-border/50 flex flex-col justify-between gap-1">
        <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">Ice (40%)</span>
        <span class="font-mono font-bold text-xl"><span id="out-ice">200</span>g</span>
      </div>
      <div class="p-4 bg-bg/50 rounded-lg border border-border/50 flex flex-col justify-between gap-1">
        <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">Hot Water (60%)</span>
        <span class="font-mono font-bold text-xl"><span id="out-hot">300</span>g</span>
      </div>
      <div class="p-4 bg-bg/50 rounded-lg border border-border/50 flex flex-col justify-between gap-1">
        <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">Bloom Water</span>
        <span class="font-mono font-bold text-xl text-primary"><span id="out-bloom">97</span>g</span>
      </div>
    </div>
  </div>

<script>
    const input = document.getElementById('coffee-input');
    const outCoffee = document.getElementById('out-coffee');
    const outIce = document.getElementById('out-ice');
    const outHot = document.getElementById('out-hot');
    const outBloom = document.getElementById('out-bloom');

    function calculate() {
      const vol = parseFloat(input.value) || 0;
      const coffee = vol * (65/1000);
      const ice = vol * 0.4;
      const hot = vol * 0.6;
      const bloom = coffee * 3;

      outCoffee.textContent = coffee.toFixed(1);
      outIce.textContent = Math.round(ice);
      outHot.textContent = Math.round(hot);
      outBloom.textContent = Math.round(bloom);
    }

    input.addEventListener('input', calculate);
  </script>
</div>
