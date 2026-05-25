/**
 * search.ts
 * Pagefind-powered search functionality for Lume.
 */

export async function initSearch() {
  const containers = document.querySelectorAll("[data-search-id]");
  if (!containers.length) return;

  const pagefindPath = "/pagefind/pagefind.js";
  let pagefind: any = null;

  async function ensurePagefind() {
    if (pagefind) return pagefind;
    try {
      pagefind = await import(pagefindPath);
      await pagefind.init({});
      return pagefind;
    } catch (e) {
      console.error("Pagefind failed to load:", e);
      return null;
    }
  }

  containers.forEach(async (root) => {
    const id = root.getAttribute("data-search-id");
    const mode = root.getAttribute("data-search-mode") || "pagefind";
    const filtersStr = root.getAttribute("data-search-filters");
    const filters = filtersStr ? JSON.parse(filtersStr) : null;

    const input = root.querySelector(
      `#site-search-input-${id}`,
    ) as HTMLInputElement;
    const resultsContainer = root.querySelector(
      `#search-results-${id}`,
    ) as HTMLElement;
    const noResults = root.querySelector(
      `#search-no-results-${id}`,
    ) as HTMLElement;
    const spinner = root.querySelector(`#search-spinner-${id}`) as HTMLElement;
    const clearBtn = root.querySelector(`#search-clear-${id}`) as HTMLElement;

    if (!input || !resultsContainer) return;

    let localIndex: any[] = [];
    let activeIndex = -1;

    function normalize(str: string) {
      return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s\-_.]/g, "");
    }

    async function ensureLocalIndex() {
      const items = document.querySelectorAll("[data-search-item]");
      const currentHash = `${items.length}-${items[0]?.id || ""}`;

      if (localIndex.length > 0 && root.dataset.indexHash === currentHash) {
        return;
      }

      root.dataset.indexHash = currentHash;
      localIndex = Array.from(items).map((el) => {
        const item = el as HTMLElement;
        const title =
          item.querySelector("h3, .p-name, font-bold")?.textContent?.trim() ||
          "Untitled";
        const desc = item.querySelector(".markdown, p, .text-sm")?.textContent
          ?.trim() || "";
        return {
          id: item.id,
          title,
          desc,
          haystack: normalize(item.dataset.searchData || ""),
        };
      });
    }

    async function handleSearch(term: string) {
      if (!term || term.trim() === "") {
        clearSearch();
        return;
      }

      if (mode === "filter") {
        const items = document.querySelectorAll("[data-search-item]");
        const q = normalize(term.trim());
        let visibleCount = 0;

        items.forEach((el) => {
          const item = el as HTMLElement;
          const haystack = normalize(item.dataset.searchData || "");
          const isMatch = haystack.includes(q);
          item.style.display = isMatch ? "" : "none";
          if (isMatch) visibleCount++;
        });

        if (noResults) {
          noResults.classList.toggle("hidden", visibleCount > 0);
        }

        clearBtn?.classList.add("search-action-active");
        return;
      }

      if (mode === "local") {
        await ensureLocalIndex();
        const q = normalize(term.trim());
        const results = localIndex
          .filter((item) => item.haystack.includes(q))
          .slice(0, 10)
          .map((item) => ({
            url: `#${item.id}`,
            meta: { title: item.title },
            excerpt: item.desc,
          }));

        renderResults(results);
        clearBtn?.classList.add("search-action-active");
        return;
      }

      const pf = await ensurePagefind();
      if (!pf) return;

      clearBtn?.classList.remove("search-action-active");
      spinner?.classList.add("search-action-active");

      pf.preload(term);

      const search = await pf.debouncedSearch(
        term,
        filters ? { filters } : {},
        150,
      );
      if (search === null) return;

      const results = await Promise.all(
        search.results.slice(0, 5).map((r: any) => r.data()),
      );

      spinner?.classList.remove("search-action-active");
      clearBtn?.classList.add("search-action-active");
      renderResults(results);
    }

    function clearSearch() {
      input.value = "";
      resultsContainer.innerHTML = "";
      resultsContainer.classList.add(
        "opacity-0",
        "-translate-y-2",
        "pointer-events-none",
      );
      clearBtn?.classList.remove("search-action-active");
      spinner?.classList.remove("search-action-active");
      if (noResults) noResults.classList.add("hidden");

      if (mode === "filter") {
        const items = document.querySelectorAll("[data-search-item]");
        items.forEach((el) => ((el as HTMLElement).style.display = ""));
      }

      activeIndex = -1;
    }

    function renderResults(results: any[]) {
      if (noResults) {
        noResults.classList.toggle("hidden", results.length > 0);
      }

      if (results.length === 0) {
        resultsContainer.innerHTML = "";
      } else {
        resultsContainer.innerHTML = results
          .map((item, index) => {
            const isAnchor = item.url.startsWith("#");
            return `
          <a href="${item.url}"
             class="search-result-item group block py-4 px-6 rounded-xl bg-surface-subtle border border-border-subtle transition-all no-underline
                    hover:bg-surface-hover hover:border-primary-muted focus:outline-none focus:ring-1 focus:ring-primary-muted hover:translate-x-1"
             data-index="${index}"
             ${isAnchor ? 'data-anchor-jump="true"' : ""}>
            <div class="flex flex-col gap-2">
              <div class="flex justify-between items-center gap-4">
                <h3 class="text-base font-bold text-primary transition-colors m-0 tracking-tight flex items-center gap-2">
                  <span>${item.meta.title || "Untitled"}</span>
                  ${
              isAnchor
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-0 group-hover:opacity-50 transition-opacity"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'
                : ""
            }
                </h3>
                ${
              item.meta.date
                ? `<time class="typography-label text-[10px] text-text-muted/50">${item.meta.date}</time>`
                : ""
            }
              </div>
              <p class="text-xs text-text-muted/70 leading-relaxed m-0 font-mono italic line-clamp-2">
                ${item.excerpt || ""}
              </p>
            </div>
          </a>
        `;
          }).join("");
      }

      resultsContainer.classList.remove(
        "opacity-0",
        "-translate-y-2",
        "pointer-events-none",
      );

      // Handle anchor jumps manually for smooth UX
      resultsContainer.querySelectorAll('[data-anchor-jump="true"]').forEach(
        (el) => {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = (el as HTMLAnchorElement).getAttribute("href")
              ?.slice(1);
            const target = document.getElementById(targetId || "");
            if (target) {
              clearSearch();
              target.scrollIntoView({ behavior: "smooth", block: "center" });

              // Visual Flash highlight
              target.classList.add(
                "reveal:bg-primary-muted/20",
                "reveal:border-primary-muted",
              );
              setTimeout(() => {
                target.classList.remove(
                  "reveal:bg-primary-muted/20",
                  "reveal:border-primary-muted",
                );
              }, 1500);
            }
          });
        },
      );

      activeIndex = -1;
    }
    input.addEventListener(
      "input",
      (e) => handleSearch((e.target as HTMLInputElement).value),
    );
    clearBtn?.addEventListener("click", clearSearch);

    const handleKeyNav = (e: KeyboardEvent) => {
      const results = resultsContainer.querySelectorAll(
        ".search-result-item",
      ) as NodeListOf<HTMLElement>;
      if (!results.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        results[activeIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        if (activeIndex >= 0) results[activeIndex]?.focus();
        else input.focus();
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        results[activeIndex].click();
      } else if (e.key === "Escape") {
        clearSearch();
        input.blur();
      }
    };

    input.addEventListener("keydown", handleKeyNav);
    resultsContainer.addEventListener("keydown", handleKeyNav);

    // Handle clicks outside to close results
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target as Node)) {
        resultsContainer.classList.add(
          "opacity-0",
          "-translate-y-2",
          "pointer-events-none",
        );
      } else if (input.value.trim() !== "") {
        resultsContainer.classList.remove(
          "opacity-0",
          "-translate-y-2",
          "pointer-events-none",
        );
      }
    });
  });

  // Global Keyboard (/)
  document.addEventListener("keydown", (e) => {
    // If multiple search boxes exist, we just focus the first one for the "/" shortcut
    // unless one is specifically targeted (e.g. by being in the viewport).
    const mainInput = document.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;

    if (
      e.key === "/" && document.activeElement !== mainInput &&
      !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "")
    ) {
      e.preventDefault();
      mainInput?.focus();
    }
  });
}
