/**
 * Logic for the album collage generator tool.
 */

export function initCollageTool(defaultUsername: string) {
  let canvas = document.getElementById("collage-canvas") as HTMLCanvasElement;
  const previewWrapper = document.getElementById("preview-wrapper");
  const downloadBtn = document.getElementById("download-btn") as
    | HTMLButtonElement
    | null;
  const shareBtn = document.getElementById("share-btn") as
    | HTMLButtonElement
    | null;
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
  /** Bumped on every run, so a slow earlier response cannot replace a newer collage. */
  let generation = 0;
  let latestBlob: Blob | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  const STORAGE_KEY = "collage-settings-v9";

  function updateStatus(text: string) {
    if (statusText) {
      if (statusText.innerText === text) return;
      statusText.innerText = text;
    }
    console.log(`[collage] ${text}`);
  }

  function setActionsEnabled(enabled: boolean) {
    if (downloadBtn) downloadBtn.disabled = !enabled;
    if (shareBtn) shareBtn.disabled = !enabled;
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
    const activeClasses = "collage-tool__source--active";
    const inactiveClasses = "collage-tool__source--inactive";

    if (sourceLb) {
      sourceLb.className = `collage-tool__source ${
        currentSource === "lb" ? activeClasses : inactiveClasses
      }`;
    }
    if (sourceLfm) {
      sourceLfm.className = `collage-tool__source ${
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
      { v: "quarter", l: "Last Quarter" },
      { v: "half_yearly", l: "Last Half Year" },
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
      // A period saved under the other source may not exist here; keep the first option then.
      if (PERIODS[currentSource].some((p) => p.v === settings.period)) {
        periodSelect.value = settings.period;
      }
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

  /** One album as the proxy returns it. */
  interface Album {
    name: string;
    artist: string;
    count: number | string;
    mbid?: string;
    img?: string;
  }

  async function generate() {
    const run = ++generation;
    const user = usernameInput.value.trim();
    if (!user) {
      if (emptyState) emptyState.style.opacity = "1";
      setActionsEnabled(false);
      return;
    }

    if (emptyState) emptyState.style.opacity = "0";
    updateStatus("fetching stats from service");
    previewWrapper?.classList.add("is-loading");
    previewWrapper?.classList.remove("is-ready");
    setActionsEnabled(false);

    try {
      const query = new URLSearchParams({
        source: currentSource,
        user,
        period: periodSelect.value,
      });
      const res = await fetch(`/api/collage-proxy?${query}`);
      const data = await res.json().catch(() => null);
      if (run !== generation) return;
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      let albums: Album[] = data.albums;
      if (!albums?.length) throw new Error("No data found");

      updateStatus(`Retrieved ${albums.length} albums from service`);

      const aliasesRaw = aliasesInput.value;
      if (aliasesRaw.trim()) {
        const aliasMap = new Map();
        aliasesRaw.split("\n").forEach((line) => {
          const [from, to] = line.split("->").map((s) => s.trim());
          if (from && to) aliasMap.set(from.toUpperCase(), to.toUpperCase());
        });
        const merged = new Map<string, Album & { count: number }>();
        albums.forEach((album) => {
          const artist = aliasMap.get(album.artist.toUpperCase()) ||
            album.artist.toUpperCase();
          const name = aliasMap.get(album.name.toUpperCase()) ||
            album.name.toUpperCase();
          const key = `${artist}|${name}`;
          const count = Number(album.count) || 0;

          const existing = merged.get(key);
          if (existing) {
            existing.count += count;
            if (!existing.mbid && album.mbid) existing.mbid = album.mbid;
            if (!existing.img && album.img) existing.img = album.img;
          } else {
            merged.set(key, { ...album, artist, name, count });
          }
        });
        albums = Array.from(merged.values()).sort((a, b) => b.count - a.count);
      }

      if (currentWorker) currentWorker.terminate();
      const newCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(newCanvas);
      canvas = newCanvas;

      currentWorker = new Worker("/assets/scripts/collage-worker.js", {
        type: "module",
      });

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
          setActionsEnabled(true);
        } else if (type === "error") {
          updateStatus(`Error: ${message}`);
          previewWrapper?.classList.remove("is-loading");
          setActionsEnabled(false);
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
    } catch (err) {
      if (run !== generation) return;
      updateStatus(`Error: ${(err as Error).message}`);
      previewWrapper?.classList.remove("is-loading");
      setActionsEnabled(false);
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
    debounceTimeout = globalThis.setTimeout(generate, 1000);
  });

  inputs.forEach((input) => {
    if (input === fontFamilyInput) return;
    input.addEventListener("input", () => {
      saveSettings();
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = globalThis.setTimeout(generate, 600);
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
