/**
 * collage-tool.ts
 * Logic for the album collage generator tool.
 */

export function initCollageTool(defaultUsername: string) {
  let canvas = document.getElementById("collage-canvas") as HTMLCanvasElement;
  const previewWrapper = document.getElementById("preview-wrapper");
  const downloadBtn = document.getElementById("download-btn");
  const shareBtn = document.getElementById("share-btn");
  const statusText = document.getElementById("status-text");
  const emptyState = document.getElementById("empty-state");
  const usernameInput = document.getElementById("username") as HTMLInputElement;
  const periodSelect = document.getElementById("period") as HTMLSelectElement;
  const gridSizeSelect = document.getElementById(
    "grid-size",
  ) as HTMLSelectElement;
  const footerAuto = document.getElementById("footer-auto") as HTMLInputElement;
  const footerText = document.getElementById("footer-text") as HTMLInputElement;
  const fontFamilyInput = document.getElementById(
    "font-family",
  ) as HTMLInputElement;
  const aliasesInput = document.getElementById(
    "aliases",
  ) as HTMLTextAreaElement;
  const bgModeSelect = document.getElementById("bg-mode") as HTMLSelectElement;
  const textCaseSelect = document.getElementById(
    "text-case",
  ) as HTMLSelectElement;
  const grainCheckbox = document.getElementById("grain") as HTMLInputElement;
  const glassCheckbox = document.getElementById("glass") as HTMLInputElement;
  const darkenBottomCheckbox = document.getElementById(
    "darken-bottom",
  ) as HTMLInputElement;
  const skipMissingCheckbox = document.getElementById(
    "skip-missing",
  ) as HTMLInputElement;
  const showCountsCheckbox = document.getElementById(
    "show-counts",
  ) as HTMLInputElement;
  const showSiteCheckbox = document.getElementById(
    "show-site",
  ) as HTMLInputElement;

  if (!canvas || !usernameInput) return;

  const inputs = [
    usernameInput,
    periodSelect,
    gridSizeSelect,
    bgModeSelect,
    textCaseSelect,
    grainCheckbox,
    glassCheckbox,
    darkenBottomCheckbox,
    skipMissingCheckbox,
    showCountsCheckbox,
    showSiteCheckbox,
    footerAuto,
    footerText,
    fontFamilyInput,
    aliasesInput,
  ];

  const sourceLb = document.getElementById("source-lb");
  const sourceLfm = document.getElementById("source-lfm");

  let currentSource = "lb";
  let currentWorker: Worker | null = null;
  let latestBlob: Blob | null = null;
  let debounceTimeout: number | null = null;

  const STORAGE_KEY = "collage-settings-v9";

  function updateStatus(text: string) {
    if (statusText) {
      if (statusText.innerText === text) return;
      statusText.innerText = text;
    }
    console.log(`[collage] ${text}`);
  }

  function saveSettings() {
    const settings = {
      source: currentSource,
      user: usernameInput.value,
      period: periodSelect.value,
      gridSize: gridSizeSelect.value,
      bgMode: bgModeSelect.value,
      textCase: textCaseSelect.value,
      grain: grainCheckbox.checked,
      glass: glassCheckbox.checked,
      darkenBottom: darkenBottomCheckbox.checked,
      skipMissing: skipMissingCheckbox.checked,
      showCounts: showCountsCheckbox.checked,
      showSite: showSiteCheckbox.checked,
      footerAuto: footerAuto.checked,
      footer: footerText.value,
      fontFamily: fontFamilyInput.value,
      aliases: aliasesInput.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function applySourceStyles() {
    const activeClasses = "bg-primary text-white shadow-md";
    const inactiveClasses =
      "text-text-dim hover:text-text-muted hover:bg-surface-hover";

    if (sourceLb) {
      sourceLb.className =
        `flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all haptic ${
          currentSource === "lb" ? activeClasses : inactiveClasses
        }`;
    }
    if (sourceLfm) {
      sourceLfm.className =
        `flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all haptic ${
          currentSource === "lfm" ? activeClasses : inactiveClasses
        }`;
    }
  }

  const PERIODS: Record<string, { v: string; l: string }[]> = {
    lb: [
      { v: "this_week", l: "This Week" },
      { v: "this_month", l: "This Month" },
      { v: "this_year", l: "This Year" },
      { v: "week", l: "Last Week" },
      { v: "month", l: "Last Month" },
      { v: "year", l: "Last Year" },
      { v: "all_time", l: "All Time" },
    ],
    lfm: [
      { v: "week", l: "7 Days" },
      { v: "month", l: "1 Month" },
      { v: "quarter", l: "3 Months" },
      { v: "half_year", l: "6 Months" },
      { v: "year", l: "12 Months" },
      { v: "all_time", l: "Overall" },
    ],
  };

  function updatePeriods() {
    const list = PERIODS[currentSource];
    periodSelect.innerHTML = list.map((p) =>
      `<option value="${p.v}">${p.l}</option>`
    ).join("");
  }

  function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      usernameInput.value = defaultUsername;
      return;
    }
    try {
      const settings = JSON.parse(saved);
      currentSource = settings.source || "lb";
      usernameInput.value = settings.user || defaultUsername;
      applySourceStyles();
      updatePeriods();
      if (settings.period) periodSelect.value = settings.period;
      if (settings.gridSize) gridSizeSelect.value = settings.gridSize;
      if (settings.bgMode) bgModeSelect.value = settings.bgMode;
      if (settings.textCase) textCaseSelect.value = settings.textCase;

      grainCheckbox.checked = settings.grain !== undefined
        ? settings.grain
        : true;
      glassCheckbox.checked = !!settings.glass;
      darkenBottomCheckbox.checked = !!settings.darkenBottom;
      skipMissingCheckbox.checked = settings.skipMissing !== undefined
        ? settings.skipMissing
        : true;
      showCountsCheckbox.checked = !!settings.showCounts;
      showSiteCheckbox.checked = settings.showSite !== undefined
        ? settings.showSite
        : true;

      footerAuto.checked = settings.footerAuto !== undefined
        ? settings.footerAuto
        : true;
      footerText.value = settings.footer || "";
      footerText.disabled = footerAuto.checked;
      fontFamilyInput.value = settings.fontFamily || "";
      aliasesInput.value = settings.aliases || "";
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  async function generate() {
    const user = usernameInput.value.trim();
    if (!user) {
      if (emptyState) emptyState.style.opacity = "1";
      return;
    }

    if (emptyState) emptyState.style.opacity = "0";
    updateStatus("fetching stats from service");
    previewWrapper?.classList.add("is-loading");
    previewWrapper?.classList.remove("is-ready");

    try {
      const proxyUrl =
        `/api/collage-proxy?source=${currentSource}&user=${user}&period=${periodSelect.value}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      let albums = data.albums;
      if (!albums?.length) throw new Error("No data found");

      updateStatus(`Retrieved ${albums.length} albums from service`);

      const aliasesRaw = aliasesInput.value;
      if (aliasesRaw.trim()) {
        const aliasMap = new Map();
        aliasesRaw.split("\n").forEach((line) => {
          const [from, to] = line.split("->").map((s) => s.trim());
          if (from && to) aliasMap.set(from.toUpperCase(), to.toUpperCase());
        });
        const merged = new Map();
        albums.forEach((album: any) => {
          const artist = aliasMap.get(album.artist.toUpperCase()) ||
            album.artist.toUpperCase();
          const name = aliasMap.get(album.name.toUpperCase()) ||
            album.name.toUpperCase();
          const key = `${artist}|${name}`;
          const count = parseInt(album.count) || 0;

          if (merged.has(key)) {
            const existing = merged.get(key);
            existing.count += count;
            if (!existing.mbid && album.mbid) existing.mbid = album.mbid;
            if (!existing.img && album.img) existing.img = album.img;
          } else {
            merged.set(key, { ...album, artist, name, count });
          }
        });
        albums = Array.from(merged.values()).sort((a: any, b: any) =>
          b.count - a.count
        );
      }

      if (currentWorker) currentWorker.terminate();
      const newCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(newCanvas);
      canvas = newCanvas;

      currentWorker = new Worker("/assets/scripts/collage-worker.js", {
        type: "module",
      });

      // @ts-ignore
      const offscreen = canvas.transferControlToOffscreen();

      currentWorker.onmessage = (e) => {
        const { type, text, blob, message } = e.data;
        if (type === "status") {
          updateStatus(text);
        } else if (type === "done") {
          latestBlob = blob;
          updateStatus("Complete");
          previewWrapper?.classList.remove("is-loading");
          previewWrapper?.classList.add("is-ready");
        } else if (type === "error") {
          updateStatus(`Error: ${message}`);
          previewWrapper?.classList.remove("is-loading");
        }
      };

      const [cols, rows] = gridSizeSelect.value.split("x").map(Number);

      currentWorker.postMessage({
        type: "generate",
        canvas: offscreen,
        albums,
        options: {
          bgMode: bgModeSelect.value,
          textCase: textCaseSelect.value,
          applyGrain: grainCheckbox.checked,
          applyGlass: glassCheckbox.checked,
          darkenBottom: darkenBottomCheckbox.checked,
          skipMissing: skipMissingCheckbox.checked,
          showCounts: showCountsCheckbox.checked,
          showSite: showSiteCheckbox.checked,
          footer: footerAuto.checked ? "" : footerText.value,
          fontFamily: fontFamilyInput.value,
          user,
          period: periodSelect.value,
          cols,
          rows,
        },
      }, [offscreen]);
    } catch (err: any) {
      updateStatus(`Error: ${err.message}`);
      previewWrapper?.classList.remove("is-loading");
    }
  }

  function setSource(src: string) {
    if (currentSource === src) return;
    currentSource = src;
    applySourceStyles();
    updatePeriods();
    saveSettings();
    generate();
  }

  sourceLb?.addEventListener("click", () => setSource("lb"));
  sourceLfm?.addEventListener("click", () => setSource("lfm"));

  footerAuto.addEventListener("change", () => {
    footerText.disabled = footerAuto.checked;
    saveSettings();
    generate();
  });

  fontFamilyInput.addEventListener("input", () => {
    if (fontFamilyInput.value.trim()) {
      const linkId = "dynamic-google-font";
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${
        fontFamilyInput.value.trim().replace(/ /g, "+")
      }&display=swap`;
    }
    saveSettings();
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = window.setTimeout(generate, 1000);
  });

  inputs.forEach((input) => {
    if (input === fontFamilyInput) return;
    input.addEventListener("input", () => {
      saveSettings();
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = window.setTimeout(generate, 600);
    });
  });

  downloadBtn?.addEventListener("click", () => {
    if (!latestBlob) return;
    const link = document.createElement("a");
    link.download = `collage-${currentSource}-${usernameInput.value}.jpg`;
    link.href = URL.createObjectURL(latestBlob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  });

  shareBtn?.addEventListener("click", async () => {
    if (!latestBlob || !navigator.share) return;
    const file = new File([latestBlob], `collage-${usernameInput.value}.jpg`, {
      type: "image/jpeg",
    });
    try {
      await navigator.share({
        files: [file],
        title: "My Music Collage",
        text: "Generated on ege.celikci.me",
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  });

  updatePeriods();
  loadSettings();
  applySourceStyles();
  if (usernameInput.value) generate();

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
