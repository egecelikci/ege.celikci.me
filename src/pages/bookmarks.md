---
layout: layouts/page.vto
title: bookmarks
description: "A collection of 88x31 badges and my blogroll."
url: /bookmarks/
templateEngine: [vto, md]
---

gotta list everything

{{# Create a randomized copy of the bookmarks data #}}
{{ set shuffled = bookmarks.slice().sort(() => 0.5 - Math.random()) }}

## people

[follow them via your feed reader](/blogroll.xml)

{{ for item of shuffled }}
{{ if item.category == "person" && item.url }}

- [{{ item.title }}]({{ item.url }})
  {{ /if }}
  {{ /for }}

## tools & projects

{{ for item of shuffled }}
{{ if item.category == "tool" && item.url }}

- [{{ item.title }}]({{ item.url }})
  {{ /if }}
  {{ /for }}

## 88x31

<div class="
  flex flex-wrap
  gap-[var(--space-sm)]
  justify-start items-start
  my-[var(--space-xl)]">
  {{ for item of shuffled }}
    {{ if item.img }}
      {{ if item.url }}
        <a
          href="{{ item.url }}"
          class="block flex-none
        transition-all
        duration-[var(--animation-speed-fast)]
        ease-[var(--animation-curve-default)]
        rounded-none
        leading-none
        m-0 p-0
        hover:scale-105
        hover:brightness-110
        hover:z-[var(--z-content-overlay)]
        hover:relative"
          title="{{ item.title }}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="{{ item.img |> url }}"
            alt="{{ item.title }}"
            width="88"
            height="31"
            loading="lazy"
            class="block w-[88px] h-[31px] [image-rendering:pixelated] max-w-none border-none shadow-none"
          />
        </a>
      {{ else }}
        <span class="block flex-none transition-[transform,filter] duration-150 ease-[var(--animation-curve-default)] rounded-none leading-none m-0 p-0 hover:scale-105 hover:brightness-110 hover:z-[var(--z-index-content-overlay)] hover:relative" title="{{ item.title }}">
          <img
            src="{{ item.img |> url }}"
            alt="{{ item.title }}"
            width="88"
            height="31"
            loading="lazy"
            class="
            block
            w-[88px] h-[31px]
            [image-rendering:pixelated]
            max-w-none
            border-none
            shadow-none"
          />
        </span>
      {{ /if }}
    {{ /if }}
  {{ /for }}
</div>
