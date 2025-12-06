---
layout: page
title: "bookmarks"
description: "A collection of 88x31 badges and my blogroll."
permalink: /bookmarks/
---

gotta list everything

## people

[follow them via your feed reader](/blogroll.xml)

{% for item in bookmarks | shuffle %}
{% if item.category == "person" and item.url %}

- [{{ item.title }}]({{ item.url }})
  {% endif %}
  {% endfor %}

## tools & projects

{% for item in bookmarks | shuffle %}
{% if item.category == "tool" and item.url %}

- [{{ item.title }}]({{ item.url }})
  {% endif %}
  {% endfor %}

## 88x31

<div class="badges-grid">
  {% for item in bookmarks | shuffle %}
    {% if item.img %}
      {% if item.url %}
        <a
          href="{{ item.url }}"
          class="badge-item"
          title="{{ item.title }}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="{{ item.img | url }}"
            alt="{{ item.title }}"
            width="88"
            height="31"
            eleventy:ignore
          />
        </a>
      {% else %}
        <span class="badge-item" title="{{ item.title }}">
          <img
            src="{{ item.img | url }}"
            alt="{{ item.title }}"
            width="88"
            height="31"
            eleventy:ignore
          />
        </span>
      {% endif %}
    {% endif %}
  {% endfor %}
</div>
