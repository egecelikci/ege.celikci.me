---
layout: page
title: "blogroll"
description: "a list "
permalink: /blogroll/
---

a [slash page](https://slashpages.net/#blogroll), listing the websites and feeds that I read as soon as they appear in my feed reader (in random order)

[follow them via your feed reader](/blogroll.xml)

## people

{% for item in blogroll|shuffle %}

- [{{ item.title }}]({{ item.url }})
  {% endfor %}
