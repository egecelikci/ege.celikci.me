import { gsap, } from "gsap";
import { DateTime, } from "luxon";

interface Webmention {
  "wm-id": number;
  "wm-property": "like-of" | "repost-of" | "mention-of" | "in-reply-to";
  "wm-source"?: string;
  "wm-received"?: string;
  author: {
    name: string;
    url: string;
    photo: string;
  };
  url: string;
  published?: string;
  content?: {
    value: string;
    html?: string;
    text?: string;
  };
}

export default class WebmentionManager {
  container: HTMLElement;
  url: string;
  lastFetched: string;
  feedUrl: string;

  constructor(container: HTMLElement,) {
    this.container = container;
    this.url = container.dataset.url || window.location.href;
    this.lastFetched = container.dataset.lastFetched || "";
    // Adjust this to your actual production feed URL or proxy
    this.feedUrl =
      `https://webmention.io/api/mentions.jf2?target=${this.url}&per-page=100`;
  }

  init() {
    this.fetchData();
  }

  async fetchData() {
    try {
      const res = await fetch(this.feedUrl,);
      if (!res.ok) throw new Error("Failed to fetch webmentions",);
      const data = await res.json();

      if (data && data.children && data.children.length > 0) {
        this.processUpdates(data.children,);
      }
    } catch (e) {
      console.error("Webmention error:", e,);
    }
  }

  processUpdates(webmentions: Webmention[],) {
    // Filter out existing mentions to avoid duplicates
    const existingIds = new Set(
      Array.from(this.container.querySelectorAll("[id^='webmention-']",),)
        .map(el => Number(el.id.replace("webmention-", "",),)),
    );

    const newMentions = webmentions.filter(wm =>
      !existingIds.has(wm["wm-id"],)
    );
    if (newMentions.length === 0) return;

    // Separate interactions (likes/reposts) from comments
    const interactions = newMentions.filter(
      wm =>
        wm["wm-property"] === "like-of" || wm["wm-property"] === "repost-of",
    );
    const comments = newMentions.filter(
      wm =>
        wm["wm-property"] !== "like-of" && wm["wm-property"] !== "repost-of",
    );

    if (interactions.length > 0) {
      this.renderFacepile(interactions,);
    }

    if (comments.length > 0) {
      this.renderComments(comments,);
    }
  }

  /**
   * Renders Likes and Reposts as overlapping avatars (Facepile)
   * Matches logic in src/_components/webmentions.vto
   */
  renderFacepile(interactions: Webmention[],) {
    // Check if we already have a facepile container
    let facepileContainer = this.container.querySelector(".js-facepile",);

    if (!facepileContainer) {
      const wrapper = document.createElement("div",);
      wrapper.className =
        "mb-8 pb-4 border-b border-border js-facepile-wrapper";
      wrapper.innerHTML =
        `<div class="flex flex-wrap items-center mt-4 pl-1 js-facepile"></div>`;

      // Insert before comments list or at top
      const root = this.container.querySelector("[data-render-root]",);
      if (root) {
        root.prepend(wrapper,);
        facepileContainer = wrapper.querySelector(".js-facepile",);
      }
    }

    if (!facepileContainer) return;

    // Append new faces
    interactions.forEach((mention, index,) => {
      // Basic z-index handling (simple decrement strategy or stacking)
      const zIndex = 50 - index;

      const link = document.createElement("a",);
      link.className = `
        group/face peer relative block w-8 h-8 rounded-full -ml-2 first:ml-0
        bg-surface shadow-[0_0_0_2px_var(--color-bg)] 
        overflow-visible transition-all duration-200 ease-default
        hover:z-50 hover:scale-135 hover:-translate-y-1 hover:shadow-lg
        focus-visible:z-50 focus-visible:scale-135 focus-visible:-translate-y-1
        peer-hover:translate-x-3 peer-focus-visible:translate-x-3
        opacity-0 scale-90
      `;
      link.href = mention.author.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = mention.author.name;
      link.style.zIndex = zIndex.toString();
      link.id = `webmention-${mention["wm-id"]}`;

      // Avatar
      const imgHtml = mention.author.photo
        ? `<img src="${mention.author.photo}" alt="${mention.author.name}" width="64" height="64" loading="lazy" class="block w-full h-full rounded-full object-cover" />`
        : `<span class="flex w-full h-full items-center justify-center text-xs">${
          this.createIcon("user", "lucide",)
        }</span>`;

      // Icon Badge (Heart/Repost)
      let iconName = "";
      if (mention["wm-property"] === "like-of") iconName = "heart";
      if (mention["wm-property"] === "repost-of") iconName = "repeat-2";

      const badgeHtml = iconName
        ? `<span class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 bg-bg rounded-full shadow-[0_0_0_2px_var(--color-bg)] text-primary z-20 transition-transform duration-200 group-hover/face:scale-110">
            ${this.createIcon(iconName, "lucide", "w-2.5 h-2.5",)}
           </span>`
        : "";

      link.innerHTML = imgHtml + badgeHtml;
      facepileContainer!.appendChild(link,);

      // Animation
      gsap.to(link, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        delay: index * 0.05,
      },);
    },);
  }

  /**
   * Renders replies/mentions as a list
   * Matches logic in src/_components/webmention.vto
   */
  renderComments(comments: Webmention[],) {
    let list = this.container.querySelector("ol.list-none",);

    // Create list if it doesn't exist
    if (!list) {
      const wrapper = document.createElement("div",);
      wrapper.className = "relative";
      wrapper.innerHTML = `<ol class="list-none p-0 m-0"></ol>`;

      const root = this.container.querySelector("[data-render-root]",);
      if (root) root.appendChild(wrapper,);
      list = wrapper.querySelector("ol",);
    }

    if (!list) return;

    comments.forEach((mention,) => {
      const li = document.createElement("li",);
      li.className = "mb-0 opacity-0 translate-y-2";
      li.innerHTML = this.createWebmentionHTML(mention,);
      list!.appendChild(li,);

      // Animate in
      gsap.to(li, { opacity: 1, y: 0, duration: 0.4, },);
    },);
  }

  createWebmentionHTML(mention: Webmention,): string {
    const isOwn = false;
    const dateStr = mention.published
      ? DateTime.fromISO(mention.published,).toFormat("dd LLL yyyy",)
      : "";

    const content = mention.content?.html || mention.content?.text || "";

    return `
      <div
        class="
          relative flex flex-col py-4 pr-0 
          pl-[calc(3rem+0.75rem)] 
          border-b border-border 
          transition-colors duration-150 ease-default 
          last:border-b-0
          ${isOwn ? "bg-surface rounded-md mb-4 border-b-0 pr-4" : ""}
        "
        id="webmention-${mention["wm-id"]}"
      >
        <div class="order-[-1] mb-2 flex flex-wrap items-center text-sm leading-[1.4]">
          <a
            class="group flex items-center font-semibold text-text no-underline hover:text-primary hover:underline h-card u-url"
            href="${mention.author.url}"
            target="_blank"
            rel="ugc nofollow"
          >
            <span class="absolute top-4 left-0 h-12 w-12 rounded-full overflow-hidden bg-surface shadow-[0_0_0_1px_var(--color-border)] flex items-center justify-center u-photo">
              ${
      mention.author.photo
        ? `<img class="h-full w-full object-cover" src="${mention.author.photo}" alt="${mention.author.name}" width="48" height="48" loading="lazy" />`
        : this.createIcon("user", "lucide",)
    }
            </span>
            <strong class="p-name">${mention.author.name}</strong>
          </a>

          <span class="inline-block px-1 text-text-muted" aria-hidden="true">&sdot;</span>
          <time class="text-text-muted text-xs dt-published" datetime="${mention.published}">
            ${dateStr}
          </time>
        </div>

        <div class="markdown text-base leading-relaxed p-content break-words overflow-hidden w-full">
          ${content}
        </div>
      </div>
    `;
  }

  createIcon(
    name: string,
    type: "lucide" | "simpleicons" = "lucide",
    classes = "",
  ): string {
    // Basic inline SVG map or fetching logic.
    // Since we are client-side, we might not have access to the full 'comp.icon' helper.
    // For now, providing minimal SVG paths for critical icons used above.

    if (name === "heart") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart ${classes}"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    }
    if (name === "repeat-2") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-repeat-2 ${classes}"><path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/></svg>`;
    }
    if (name === "user") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user ${classes}"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }

    return "";
  }
}

// Auto-init logic
const container = document.querySelector("#webmentions",);
if (container) {
  const manager = new WebmentionManager(container as HTMLElement,);
  manager.init();
}
