#let bg-color = rgb("#2b1e42")
#let text-main = rgb("#e8e2f3")
#let text-muted = rgb("#b8afdc")
#let accent = rgb("#ff8e8c")

#set page(width: 1200pt, height: 630pt, margin: 0pt, fill: bg-color)
#set text(font: ("DM Mono", "monospace"), fill: text-main, size: 32pt)
#set par(leading: 0.6em)

#let is-poster = type(og-image) == str and og-image.contains("/posters/")

#place(dx: 64pt, dy: 64pt)[
  #text(fill: accent, weight: 700, "ege.celikci.me")
]

#if is-poster [
  #place(right + top)[
    #image(og-image, height: 100%)
  ]

  #place(dx: 64pt, dy: 160pt)[
    // Expanded height to 460pt to protect descenders from clipping
    #block(width: 680pt, height: 460pt, clip: true)[
      #text(size: 56pt, weight: 700, og-title)
      #if og-description != "" [
        #v(40pt)
        #text(size: 32pt, fill: text-muted, og-description)
      ]
    ]
  ]
] else [
  #place(dx: 64pt, dy: 160pt)[
    // Expanded height to 460pt to protect descenders from clipping
    #block(width: 1072pt, height: 460pt, clip: true)[
      #if type(og-image) == str and og-image != "" [
        #grid(
          columns: (360pt, 1fr),
          gutter: 64pt,
          [
            #box(
              width: 360pt,
              height: 360pt,
              stroke: 4pt + text-main,
              clip: true,
            )[
              #image(og-image, fit: "cover", width: 100%, height: 100%)
            ]
          ],
          [
            #text(size: 56pt, weight: 700, og-title)
            #if og-description != "" [
              #v(40pt)
              #text(size: 32pt, fill: text-muted, og-description)
            ]
          ],
        )
      ] else [
        #text(size: 72pt, weight: 700, og-title)
        #if og-description != "" [
          #v(48pt)
          #text(size: 36pt, fill: text-muted, og-description)
        ]
      ]
    ]
  ]
]
