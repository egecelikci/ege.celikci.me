---
layout: page
title: "Miniflux Rules"
description: "Rules for Miniflux feed reader."
subtitle: >-
  custom <a href="https://miniflux.app/docs/rules.html">filter, rewrite, and scraper rules</a> I made For <a href="https://miniflux.app">Miniflux</a>.
permalink: /miniflux/
---

<div class="table-wrapper">

| Title | Feed | Scraper Rules | Rewrite Rules |
| :---- | :--- | :------------ | :------------ |

{%- for item in miniflux %}
| [{{ item.title }}]({{ item.url }}) | `{{ item.feed }}` | {% if item.scraper_rules %}`{{ item.scraper_rules | safe }}`{% else %}{% endif %} | {% if item.content_rewrite_rules %}`{{ item.content_rewrite_rules | safe }}`{% else %}{% endif %} |
{%- endfor %}

</div>
