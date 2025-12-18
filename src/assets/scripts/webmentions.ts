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
  private container: HTMLElement;
  private currentUrl: string;
  private lastFetched: string | null;
  private existingIds: Set<number>;

  constructor(container: HTMLElement,) {
    this.container = container;
    this.currentUrl = container.dataset.url || "";
    this.lastFetched = container.dataset.lastFetched || null;
    this.existingIds = new Set();

    // Collect existing webmention IDs to prevent duplicates
    this.collectExistingIds();
  }

  private collectExistingIds() {
    // Find all existing webmentions and store their IDs
    const existingMentions = this.container.querySelectorAll(
      "[id^=\"webmention-\"]",
    );
    existingMentions.forEach(el => {
      const id = el.id.replace("webmention-", "",);
      if (id) {
        this.existingIds.add(parseInt(id, 10,),);
      }
    },);
  }

  async init() {
    // Only fetch if we have a URL and enough time has passed
    if (!this.currentUrl) return;

    // Check if last fetch was recent (e.g., within 5 minutes)
    if (this.lastFetched) {
      const lastFetchTime = new Date(this.lastFetched,).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (now - lastFetchTime < fiveMinutes) {
        console.log("Webmentions recently fetched, skipping update",);
        return;
      }
    }

    await this.fetchData();
  }

  async fetchData() {
    try {
      const params = new URLSearchParams({
        target: this.currentUrl,
        "per-page": "100",
      },);

      if (this.lastFetched) {
        params.set("since", this.lastFetched,);
      }

      const response = await fetch(
        `/.netlify/edge-functions/webmentions?${params}`,
      );

      if (!response.ok) throw new Error("Failed to fetch webmentions",);

      const data = await response.json();

      // Only process if we have new mentions
      if (data.children && data.children.length > 0) {
        this.processUpdates(data.children,);
      }
    } catch (err) {
      console.error("Error fetching webmentions:", err,);
    }
  }

  processUpdates(webmentions: Webmention[],) {
    // Filter out duplicates
    const newMentions = webmentions.filter(wm =>
      !this.existingIds.has(wm["wm-id"],)
    );

    if (newMentions.length === 0) {
      console.log("No new webmentions to display",);
      return;
    }

    const interactions = newMentions.filter(
      (m,) =>
        m["wm-property"] === "like-of" || m["wm-property"] === "repost-of",
    );
    const comments = newMentions.filter(
      (m,) =>
        m["wm-property"] !== "like-of" && m["wm-property"] !== "repost-of",
    );

    if (interactions.length > 0) {
      this.renderFacepile(interactions,);
    }

    if (comments.length > 0) {
      this.renderComments(comments,);
    }

    // Add new IDs to existing set
    newMentions.forEach(wm => this.existingIds.add(wm["wm-id"],));
  }

  renderFacepile(interactions: Webmention[],) {
    let facepileWrapper = this.container.querySelector(".js-facepile-wrapper",);

    if (!facepileWrapper) {
      // Create wrapper if it doesn't exist
      const noMentionsMsg = this.container.querySelector("p.text-text-muted",);
      if (noMentionsMsg) {
        noMentionsMsg.remove();
      }

      facepileWrapper = document.createElement("div",);
      facepileWrapper.className =
        "mb-8 pb-4 border-b border-border js-facepile-wrapper";
      facepileWrapper.innerHTML =
        "<div class=\"flex flex-wrap items-center mt-4 pl-1 js-facepile\"></div>";
      this.container.firstElementChild?.prepend(facepileWrapper,);
    }

    const facepile = facepileWrapper.querySelector(".js-facepile",);
    if (!facepile) return;

    // Get current highest z-index
    const existingAvatars = facepile.querySelectorAll("a",);
    let zIndex = existingAvatars.length + interactions.length;

    interactions.forEach((mention,) => {
      // Check if already exists
      if (facepile.querySelector(`#webmention-${mention["wm-id"]}`,)) {
        return;
      }

      const avatar = document.createElement("a",);
      avatar.className =
        "group/face peer relative block w-8 h-8 rounded-full -ml-2 first:ml-0 bg-surface shadow-[0_0_0_2px_var(--color-bg)] overflow-visible transition-all duration-200 ease-default hover:z-50 hover:scale-135 hover:-translate-y-1 hover:shadow-lg focus-visible:z-50 focus-visible:scale-135 focus-visible:-translate-y-1 peer-hover:translate-x-3 peer-focus-visible:translate-x-3 opacity-0 scale-90";
      avatar.href = mention.author.url;
      avatar.target = "_blank";
      avatar.rel = "noopener noreferrer";
      avatar.title = mention.author.name;
      avatar.id = `webmention-${mention["wm-id"]}`;
      avatar.style.zIndex = String(zIndex--,);

      const img = document.createElement("img",);
      img.src = mention.author.photo;
      img.alt = mention.author.name;
      img.width = 64;
      img.height = 64;
      img.loading = "lazy";
      img.className = "block w-full h-full rounded-full object-cover";

      const icon = document.createElement("span",);
      icon.className =
        "absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 bg-bg rounded-full shadow-[0_0_0_2px_var(--color-bg)] text-primary z-20 transition-transform duration-200 group-hover/face:scale-110";
      icon.innerHTML = this.createIcon(
        mention["wm-property"] === "like-of" ? "heart" : "repeat-2",
        "lucide",
        "w-2.5 h-2.5",
      );

      avatar.appendChild(img,);
      avatar.appendChild(icon,);
      facepile.appendChild(avatar,);

      // Animate in
      gsap.to(avatar, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "back.out(1.7)",
      },);
    },);
  }

  renderComments(comments: Webmention[],) {
    let commentsList = this.container.querySelector("ol.list-none",);

    if (!commentsList) {
      // Create comments section if it doesn't exist
      const noMentionsMsg = this.container.querySelector("p.text-text-muted",);
      if (noMentionsMsg) {
        noMentionsMsg.remove();
      }

      const wrapper = document.createElement("div",);
      wrapper.className = "relative";
      commentsList = document.createElement("ol",);
      commentsList.className = "list-none p-0 m-0";
      wrapper.appendChild(commentsList,);
      this.container.firstElementChild?.appendChild(wrapper,);
    }

    comments.forEach((mention,) => {
      // Check if already exists
      if (commentsList!.querySelector(`#webmention-${mention["wm-id"]}`,)) {
        return;
      }

      const li = document.createElement("li",);
      li.className = "mb-0";
      li.innerHTML = this.createWebmentionHTML(mention,);
      commentsList!.appendChild(li,);

      // Animate in
      const newElement = li.firstElementChild as HTMLElement;
      if (newElement) {
        gsap.from(newElement, {
          opacity: 0,
          y: 20,
          duration: 0.4,
          ease: "power2.out",
        },);
      }
    },);
  }

  createWebmentionHTML(mention: Webmention,): string {
    const publishedDate = mention.published
      ? DateTime.fromISO(mention.published,).toFormat("dd LLL yyyy",)
      : "";

    return `
      <div
        id="webmention-${mention["wm-id"]}"
        class="relative flex flex-col py-4 pr-0 pl-[calc(3rem+0.75rem)] border-b border-border transition-colors duration-150 ease-default last:border-b-0"
      >
        <div class="order-[-1] mb-2 flex flex-wrap items-center text-sm leading-[1.4]">
          <a
            class="group flex items-center font-semibold text-text no-underline hover:text-primary hover:underline h-card u-url"
            href="${mention.url}"
            target="_blank"
            rel="ugc nofollow"
          >
            <span class="absolute top-4 left-0 h-12 w-12 rounded-full overflow-hidden bg-surface shadow-[0_0_0_1px_var(--color-border)] flex items-center justify-center u-photo">
              <img
                class="h-full w-full object-cover"
                src="${mention.author.photo}"
                alt="${mention.author.name}"
                width="48"
                height="48"
                loading="lazy"
                decoding="async"
              />
            </span>
            <strong class="p-name">${mention.author.name}</strong>
          </a>
          ${
      publishedDate
        ? `
          <span class="inline-block px-1 text-text-muted" aria-hidden="true">⋅</span>
          <time class="text-text-muted text-xs dt-published" datetime="${mention.published}">
            ${publishedDate}
          </time>
          `
        : ""
    }
        </div>
        <div class="markdown text-base leading-relaxed p-content break-words overflow-hidden w-full">
          ${
      mention.content?.value || mention.content?.html || mention.content?.text
      || ""
    }
        </div>
      </div>
    `;
  }

  createIcon(
    name: string,
    type: "lucide" | "simpleicons" = "lucide",
    classes = "",
  ): string {
    const iconMap: Record<string, string> = {
      heart:
        "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"></path>",
      "repeat-2":
        "<path d=\"m2 9 3-3 3 3\"></path><path d=\"M13 18H7a2 2 0 0 1-2-2V6\"></path><path d=\"m22 15-3 3-3-3\"></path><path d=\"M11 6h6a2 2 0 0 1 2 2v10\"></path>",
      user:
        "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"></path><circle cx=\"12\" cy=\"7\" r=\"4\"></circle>",
    };

    const path = iconMap[name] || "";
    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-${name} ${classes}"
      >
        ${path}
      </svg>
    `;
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("webmentions",);
    if (container) {
      const manager = new WebmentionManager(container,);
      manager.init();
    }
  },);
}
