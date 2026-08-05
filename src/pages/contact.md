---
title: contact
description: preferred channels for reaching out to me
templateEngine: [vto, md]
menu:
  group: meta
  label: reach out to me
  order: 1
---

Don't hesitate to reach out to me on any of these!

{{ set signal = author.links.find((l) => l.id === "signal") }}
{{ set matrix = author.links.find((l) => l.id === "matrix") }}
{{ set email = author.links.find((l) => l.id === "email") }}

{{ if signal?.url }}

- [Signal]({{ signal.url }})
  {{ /if }}

{{ if matrix?.url }}

- [Matrix]({{ matrix.url }}) — verify device IDs [first]({{ matrix.keyUrl ?? "/keys#matrix" }})
  {{ /if }}

{{ if email?.url || author.email }}

- [{{ author.email }}]({{ email?.url || "mailto:" + author.email }}) — encrypting sensitive data via my [age key](/keys#age) preferred
  {{ /if }}
