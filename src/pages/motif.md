---
title: motif
description: "Motif is a color palette I created for my own use, as well as the project I use to automatically apply it to various software."
tags:
  - meta
prose: true
templateEngine: [vto, md]
---

well, the color scheme itself is originated from this exact website, the one currently you presumably are on… but I liked it so much I ported the palette to my [Forgejo](https://{{ git.host }}) and [Navidrome](https://music.celikci.me) instances. the source code itself for the palette spec and the tools I use for generating the palette for varied software is available at [{{ git.host }}/{{ author.username }}/motif](https://{{ git.host }}/{{ author.username }}/motif).

{{ await comp.base.Callout({ variant: "warning", content: `**${it.motif.accessibility.standard}**. Every text/background pair a target ships must meet **${it.motif.accessibility.normalText}:1**, and UI borders and non-text indicators **${it.motif.accessibility.largeTextAndUI}:1**. Legibility comes first when the two conflict.` }) |> safe }}

## palette

{{ await comp.features.Palette({ schemes: it.motif.schemes }) |> safe }}
