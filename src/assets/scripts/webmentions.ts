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

/**
 * WebmentionManager
 * Handles fetching, processing, rendering, and animating webmentions.
 */
class WebmentionManager {
  container: HTMLElement;
  apiOrigin: string;
  ownDomains: string[];
  processedIds: Set<number>;
  isExpanded: boolean;
  statsLikes: HTMLElement | null;
  statsReposts: HTMLElement | null;

  constructor(container: HTMLElement,) {
    this.container = container;
    this.apiOrigin = "/api/webmention";
    this.ownDomains = ["https://ege.celikci.me", "https://ieji.de/@eg",];

    // State
    this.processedIds = new Set();
    this.isExpanded = false;

    // Cache selectors
    this.statsLikes = document.querySelector(".note__stats__item--likes",);
    this.statsReposts = document.querySelector(".note__stats__item--reposts",);

    this.init();
  }

  init() {
    this.harvestExistingIds();

    this.container.addEventListener(
      "error",
      (e,) => this.handleImageError(e,),
      true,
    );

    this.container.addEventListener(
      "load",
      (e,) => this.handleImageLoad(e,),
      true,
    );

    this.setupInteractions();
    this.fetchData();
  }

  harvestExistingIds() {
    this.container.querySelectorAll("[id^=\"webmention-\"]",).forEach((el,) => {
      const id = el.id.replace("webmention-", "",);
      if (id) this.processedIds.add(Number(id,),);
    },);
  }

  handleImageError(e: Event,) {
    const target = e.target as HTMLImageElement;
    if (
      target.tagName === "IMG"
      && (target.classList.contains("webmention__author__photo",)
        || target.closest(".webmentions__face-item",))
    ) {
      const size = target.getAttribute("width",) || "32";
      const svgHtml = this.createDefaultSvgAvatar(size,);

      const tempDiv = document.createElement("div",);
      tempDiv.innerHTML = svgHtml;
      const svgElement = tempDiv.firstElementChild;

      if (svgElement) {
        svgElement.classList.add("avatar-initial-hide",);
        target.replaceWith(svgElement,);
        gsap.to(svgElement, {
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
        },);
      }
    }
  }

  handleImageLoad(e: Event,) {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "IMG"
      && target.classList.contains("avatar-initial-hide",)
    ) {
      target.classList.remove("avatar-initial-hide",);
      gsap.to(target, { opacity: 1, duration: 0.3, ease: "power2.out", },);
    }
  }

  setupInteractions() {
    this.bindShowAllButton(this.container,);
  }

  bindShowAllButton(scope: Element,) {
    const showAllBtn = scope.querySelector(
      ".webmentions__showall",
    ) as HTMLElement;
    const contentDiv = scope.querySelector(
      ".webmentions__content",
    ) as HTMLElement;

    if (showAllBtn && contentDiv) {
      showAllBtn.addEventListener("click", (e,) => {
        e.preventDefault();
        this.container.classList.remove("webmentions--truncated",);
        this.container.classList.add("webmentions--expanded",);
        this.isExpanded = true;

        contentDiv.style.display = "block";
        showAllBtn.style.display = "none";

        gsap.fromTo(
          contentDiv.querySelectorAll(".webmentions__item",),
          { opacity: 0, y: 20, },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.05,
            clearProps: "all",
          },
        );
      },);
    }
  }

  async fetchData() {
    const path = window.location.pathname;
    const url = `${this.apiOrigin}?path=${
      encodeURIComponent(
        path,
      )
    }`;

    try {
      const res = await fetch(url,);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`,);
      const data = await res.json();
      this.processUpdates(data,);
    } catch (err) {
      console.warn("Webmentions fetch failed:", err,);
    }
  }

  processUpdates(webmentions: Webmention[],) {
    if (!webmentions || !webmentions.length) return;

    const comments: Webmention[] = [];
    const interactions: Webmention[] = [];
    let likeCount = 0;
    let repostCount = 0;

    webmentions.forEach((item,) => {
      const type = item["wm-property"];
      if (type === "like-of") {
        likeCount++;
        interactions.push(item,);
      } else if (type === "repost-of") {
        repostCount++;
        interactions.push(item,);
      } else {
        comments.push(item,);
      }
    },);

    if (this.statsLikes) this.updateStatCounter(this.statsLikes, likeCount,);
    if (this.statsReposts) {
      this.updateStatCounter(this.statsReposts, repostCount,);
    }

    this.renderFacepile(interactions,);
    this.renderComments(comments,);
  }

  updateStatCounter(el: HTMLElement, newCount: number,) {
    const textNode = Array.from(el.childNodes,).find(
      (n,) =>
        n.nodeType === Node.TEXT_NODE
        && (n.textContent?.trim().length || 0) > 0,
    );
    if (!textNode) return;

    const currentCount = parseInt(textNode.textContent?.trim() || "0", 10,)
      || 0;
    if (newCount <= currentCount) return;

    const counter = { val: currentCount, };
    gsap.to(counter, {
      val: newCount,
      duration: 1.5,
      ease: "power4.out",
      roundProps: "val",
      onUpdate: () => {
        textNode.textContent = String(counter.val,);
      },
    },);

    gsap.fromTo(
      el,
      { scale: 1, },
      {
        scale: 1.2,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      },
    );
  }

  renderFacepile(interactions: Webmention[],) {
    if (!interactions.length) return;

    const facepileContainer = this.container.querySelector(
      ".webmentions__facepile",
    );
    if (!facepileContainer) return;

    const avatarSizeSm = "32";
    const html = interactions
      .map((item, index,) => {
        const { author, url, "wm-property": type, } = item;
        const label = `${author.name} ${
          type === "like-of" ? "liked" : "reposted"
        }`;

        let avatarInner;
        if (author.photo) {
          avatarInner =
            `<img src="${author.photo}" alt="${author.name}" width="64" height="64" loading="lazy" class="avatar-initial-hide">`;
        } else {
          avatarInner = `<span class="avatar-initial-hide">${
            this.createDefaultSvgAvatar(
              avatarSizeSm,
            )
          }</span>`;
        }

        let actionIconSvg = "";
        if (type === "like-of") actionIconSvg = this.createIcon("heart",);
        else if (type === "repost-of") {
          actionIconSvg = this.createIcon("repeat",);
        }

        const zIndex = interactions.length - index;

        return `
            <a class="webmentions__face-item" href="${
          url || author.url
        }" target="_blank" rel="noopener noreferrer" title="${label}" style="z-index: ${zIndex}">
                ${avatarInner}
                ${
          actionIconSvg
            ? `<span class="webmentions__face-action-icon">${actionIconSvg}</span>`
            : ""
        }
            </a>
        `;
      },)
      .join("",);

    if (facepileContainer.innerHTML !== html) {
      facepileContainer.innerHTML = html;

      const items = facepileContainer.querySelectorAll(
        ".webmentions__face-item",
      );
      gsap.fromTo(
        items,
        { scale: 0, opacity: 0, },
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          stagger: 0.05,
          ease: "back.out(1.7)",
          clearProps: "scale,opacity,transform",
        },
      );
    }
  }

  renderComments(comments: any[],) {
    if (!comments.length) return;

    const existingCommentIds = new Set(
      Array.from(this.container.querySelectorAll("[id^=\"webmention-\"]",),)
        .map(
          (el,) => Number(el.id.replace("webmention-", "",),),
        ),
    );

    const newItems = comments.filter(
      (c,) => !existingCommentIds.has(c["wm-id"],),
    );

    const listHtml = (items: Webmention[],) =>
      `<ol class="webmentions__list">${
        items
          .map((i,) => this.createWebmentionHTML(i,))
          .join("",)
      }</ol>`;
    const previewItems = comments.slice(0, 5,);
    const restItems = comments.slice(5,);
    const isTruncated = restItems.length > 0;

    const commentsHtml = `
      <div class="webmentions__preview">
        ${listHtml(previewItems,)}
      </div>
      ${
      isTruncated
        ? `
        <div>
          <a class="webmentions__showall" href="#webmentions" style="${
          this.isExpanded ? "display: none;" : ""
        }">
            ${this.createIcon("message",)}
            Show All Webmentions (${comments.length})
          </a>
          <div class="webmentions__content" style="${
          this.isExpanded ? "display: block;" : "display: none;"
        }">
            ${listHtml(restItems,)}
          </div>
        </div>
      `
        : ""
    }
    `;

    const root = this.container.querySelector("[data-render-root]",);
    if (!root) return;

    const existingCommentsWrapper = root.querySelector(
      ".webmentions__preview, .webmentions__content-wrapper, .webmentions__empty",
    );
    if (existingCommentsWrapper) {
      existingCommentsWrapper.remove();
    }

    root.insertAdjacentHTML("beforeend", commentsHtml,);

    this.bindShowAllButton(root,);

    newItems.forEach((item,) => {
      const el = document.getElementById(`webmention-${item["wm-id"]}`,);
      if (el) {
        el.classList.add("avatar-initial-hide",);
        gsap.to(el, { opacity: 1, y: 0, duration: 0.5, clearProps: "all", },);
        this.processedIds.add(item["wm-id"],);
      }
    },);

    this.processedIds.clear();
    comments.forEach((c,) => this.processedIds.add(c["wm-id"],));
  }

  createWebmentionHTML(item: Webmention,) {
    const {
      "wm-id": id,
      url,
      author,
      published,
      "wm-received": received,
      content,
      "wm-property": type,
    } = item;
    const isOwn = this.ownDomains.includes(author?.url,);
    const displayDate = this.readableDate(published || received || "",);
    const contentHtml = content?.value || "";

    const avatarSizeLg = "48";

    let avatarHtml;
    if (author?.photo) {
      avatarHtml =
        `<img src="${author.photo}" alt="${author.name}" width="64" height="64" loading="lazy" class="avatar-initial-hide webmention__author__photo u-photo">`;
    } else {
      avatarHtml = `
        <span class="avatar-initial-hide">
          <svg class="webmention__author__photo" role="img" aria-hidden="true" width="${avatarSizeLg}" height="${avatarSizeLg}">
              <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/assets/icons/icons.sprite.svg#svg-avatar"></use>
          </svg>
        </span>
      `;
    }

    const authorHtml = author
      ? `<a class="webmentions__author h-card u-url" href="${url}" target="_blank" rel="ugc nofollow">
          ${avatarHtml}
          <strong class="p-name">${author.name}</strong>
        </a>`
      : `<span class="webmentions__author">
          ${avatarHtml}
          <strong>Anonymous</strong>
        </span>`;

    return `
      <li class="webmentions__item" id="webmention-${id}">
        <div class="webmention ${
      isOwn ? "webmention--own" : ""
    } webmention--${type}">
          <div class="webmention__meta">
            ${authorHtml}
            <span class="webmention__meta__divider" aria-hidden="true">&sdot;</span>
            <time class="webmention__pubdate dt-published" datetime="${displayDate}">
              ${displayDate}
            </time>
          </div>
          <div class="webmention__content p-content">
            ${contentHtml}
          </div>
        </div>
      </li>
    `;
  }

  createIcon(name: string,) {
    return `
      <svg class="icon icon--${name}" role="img" aria-hidden="true">
        <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/assets/icons/icons.sprite.svg#svg-${name}"></use>
      </svg>
    `;
  }

  createDefaultSvgAvatar(size: string,) {
    return `
      <svg class="webmention__avatar-fallback" role="img" aria-hidden="true" width="${size}" height="${size}" style="width:100%; height:100%; display:block; color: #888; background: #eee;">
        <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/assets/icons/icons.sprite.svg#svg-avatar"></use>
      </svg>
    `;
  }

  readableDate(iso: string,) {
    if (!iso) return "";
    return DateTime.fromISO(iso,).toFormat("dd LLL yyyy",);
  }
}

const webmentionsElement = document.getElementById("webmentions",);
if (webmentionsElement) {
  new WebmentionManager(webmentionsElement,);
}
