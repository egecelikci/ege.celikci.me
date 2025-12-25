---
title: "feeds"
date: 2025-11-23
updated: 2025-12-18
icon: rss
description: "a list of all Atom feeds available on this website."
tags: ["meta", "feeds"]
url: /feeds/
templateEngine: [vto, md]
---

## combined feed

<ul>
<li>{{ comp.icon({ name: "file-code-2" }) }}<a href="{{ site.url }}/feed.xml"><code>{{ site.url }}/feed.xml</code></a></li>
<li>{{ comp.icon({ name: "file-json-2" }) }}<a href="{{ site.url }}/feed.json"><code>{{ site.url }}/feed.json</code></a></li>
</ul>

## [blog entries](/blog)

<ul>
<li>{{ comp.icon({ name: "file-code-2" }) }}<a href="{{ site.url }}/blog.xml"><code>{{ site.url }}/blog.xml</code></a></li>
<li>{{ comp.icon({ name: "file-json-2" }) }}<a href="{{ site.url }}/blog.json"><code>{{ site.url }}/blog.json</code></a></li>
</ul>

## [notes](/notes)

<ul>
<li>{{ comp.icon({ name: "file-code-2" }) }}<a href="{{ site.url }}/notes.xml"><code>{{ site.url }}/notes.xml</code></a></li>
<li>{{ comp.icon({ name: "file-json-2" }) }}<a href="{{ site.url }}/notes.json"><code>{{ site.url }}/notes.json</code></a></li>
</ul>
