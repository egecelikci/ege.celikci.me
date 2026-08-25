#let theme = (
  bg: rgb("#3a2a55"),
  surface: rgb("#4a3a6a"),
  text: rgb("#e8e2f3"),
  muted: rgb("#b8afdc"),
  accent: rgb("#ff8e8c"),
  border: rgb("#52427a"),
)
#let font = (
  mono: ("DM Mono", "monospace"),
)
#let metrics = (
  canvas: (width: 1200pt, height: 630pt),
  image-size: 360pt,
  stroke: 2pt,
)
#let spacing = (
  outer: 64pt,
  gutter: 64pt,
  text-gap: 40pt,
  text-gap-lg: 48pt,
)
#let type-scale = (
  logo: 32pt,
  title-lg: 72pt,
  title-md: 56pt,
  desc-lg: 36pt,
  desc-md: 32pt,
)

#set page(
  width: metrics.canvas.width,
  height: metrics.canvas.height,
  margin: 0pt,
  fill: theme.bg,
)

#set text(
  font: font.mono,
  fill: theme.text,
  size: type-scale.desc-md,
)

#let og-title = sys.inputs.at("og-title", default: "")
#let og-description = sys.inputs.at("og-description", default: "")
#let og-image = sys.inputs.at("og-image-path", default: "")

#let has-image = og-image != ""
#let is-poster = has-image and og-image.contains("/posters/")

#let align-mode = if og-description != "" { bottom } else { horizon }

#let logo-block = text(
  fill: theme.accent,
  weight: 700,
  size: type-scale.logo,
  "ege.celikci.me",
)

#let title-content(t, size) = {
  set text(size: size, weight: 700, tracking: -0.02em)
  set par(leading: 0.25em)
  t
}

#let desc-content(d, size) = {
  set text(size: size, weight: 400, tracking: 0em, fill: theme.muted)
  set par(leading: 0.6em)
  d
}

#let truncate-to-fit(make, words, max-width, max-height) = {
  if words.len() == 0 {
    ""
  } else if measure(make(words.join(" ")), width: max-width).height <= max-height {
    words.join(" ")
  } else {
    let lo = 0
    let hi = words.len()
    let best = 0
    while lo <= hi {
      let mid = calc.floor((lo + hi) / 2)
      let candidate = if mid == 0 { "…" } else {
        words.slice(0, mid).join(" ") + if mid < words.len() { "…" } else { "" }
      }
      if measure(make(candidate), width: max-width).height <= max-height {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if best == 0 { "" } else {
      words.slice(0, best).join(" ") + if best < words.len() { "…" } else { "" }
    }
  }
}

#let fit-content-group(title, desc, size-title, size-desc, gap, max-width, max-height) = context {
  let title-words = title.split()
  let widest-word = calc.max(
    ..title-words.map(w => measure(title-content(w, size-title)).width),
    0pt,
  )
  let fitted-title-size = if widest-word > max-width {
    size-title * (max-width / widest-word)
  } else {
    size-title
  }

  let fitted-title = truncate-to-fit(
    t => title-content(t, fitted-title-size),
    title-words,
    max-width,
    max-height,
  )

  let has-title = fitted-title != ""
  let title-h = if has-title {
    measure(title-content(fitted-title, fitted-title-size), width: max-width).height
  } else {
    0pt
  }

  let fitted-desc = if desc == "" { "" } else {
    let avail = max-height - title-h - if has-title { gap } else { 0pt }
    if avail <= 0pt { "" } else {
      truncate-to-fit(
        d => desc-content(d, size-desc),
        desc.split(),
        max-width,
        avail,
      )
    }
  }

  if has-title {
    title-content(fitted-title, fitted-title-size)
  }
  if fitted-desc != "" {
    if has-title {
      v(gap)
    }
    desc-content(fitted-desc, size-desc)
  }
}

#if is-poster [
  #place(top + right)[
    #image(og-image, height: 100%)
  ]
]

#pad(spacing.outer)[
  #layout(size => {
    let logo-h = measure(logo-block).height
    let row2-h = size.height - logo-h - spacing.gutter

    let text-max-w = size.width
    if is-poster {
      let poster-w = measure(image(og-image, height: metrics.canvas.height)).width
      text-max-w = calc.max(
        size.width - poster-w - spacing.gutter,
        size.width * 0.4,
      )
    }

    grid(
      columns: 1fr,
      rows: (auto, 1fr),
      gutter: spacing.gutter,
      logo-block,
      block(width: 100%, height: 100%)[
        #if is-poster [
          #align(bottom + left)[
            #block(width: text-max-w)[
              #fit-content-group(
                og-title,
                og-description,
                type-scale.title-lg,
                type-scale.desc-md,
                spacing.text-gap,
                text-max-w,
                row2-h,
              )
            ]
          ]
        ] else if has-image [
          #let text-col-w = size.width - metrics.image-size - spacing.gutter
          #let text-col-h = calc.min(metrics.image-size, row2-h)

          #align(bottom)[
            #grid(
              columns: (metrics.image-size, 1fr),
              gutter: spacing.gutter,
              box(
                width: metrics.image-size,
                height: metrics.image-size,
                stroke: metrics.stroke + theme.border,
                clip: true,
                image(og-image, fit: "cover", width: 100%, height: 100%),
              ),
              block(height: text-col-h, width: 100%)[
                #align(align-mode)[
                  #fit-content-group(
                    og-title,
                    og-description,
                    type-scale.title-md,
                    type-scale.desc-md,
                    spacing.text-gap,
                    text-col-w,
                    text-col-h,
                  )
                ]
              ],
            )
          ]
        ] else [
          #align(horizon)[
            #fit-content-group(
              og-title,
              og-description,
              type-scale.title-lg,
              type-scale.desc-lg,
              spacing.text-gap-lg,
              size.width,
              row2-h,
            )
          ]
        ]
      ]
    )
  })
]
