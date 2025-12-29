---
title: "feeds"
date: 2025-11-23
updated: 2025-12-29
icon: rss
description: "a list of all Atom and JSON feeds available on this website."
tags: ["feeds"]
templateEngine: [vto, md]
---

## site-wide feeds

the combined feeds containing blog posts and notes. (wiki entries are to do)

{{ set cardContent }}

<div class="flex flex-col gap-3">
  <div class="flex items-center gap-3">
    {{ comp.ui.Icon({ name: "file-code-2", classes: "text-primary" }) }} <a href="{{ site.url }}/feed.xml" class="font-mono text-sm">{{ site.url }}/feed.xml</a>
  </div>
  <div class="flex items-center gap-3">
    {{ comp.ui.Icon({ name: "file-json-2", classes: "text-secondary" }) }} <a href="{{ site.url }}/feed.json" class="font-mono text-sm">{{ site.url }}/feed.json</a>
  </div>
</div>
{{ /set }}

{{ comp.ui.Card({ classes: "p-4 mb-8", content: cardContent }) }}

---

## specific categories

### [wiki changes](/wiki)

<div class="flex flex-col gap-2 mb-6">
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-code-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/wiki.xml">XML Feed</a>
  </div>
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-json-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/wiki.json">JSON Feed</a>
  </div>
</div>

### [notes](/notes)

<div class="flex flex-col gap-2 mb-6">
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-code-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/notes.xml">XML Feed</a>
  </div>
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-json-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/notes.json">JSON Feed</a>
  </div>
</div>

### [blog posts](/blog)

<div class="flex flex-col gap-2 mb-6">
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-code-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/blog.xml">XML Feed</a>
  </div>
  <div class="flex items-center gap-2">
    {{ comp.ui.Icon({ name: "file-json-2", classes: "w-4 h-4" }) }} <a href="{{ site.url }}/blog.json">JSON Feed</a>
  </div>
</div>
