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
#let sys = (
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
  width: sys.canvas.width,
  height: sys.canvas.height,
  margin: 0pt,
  fill: theme.bg,
)

#set text(
  font: font.mono,
  fill: theme.text,
  size: type-scale.desc-md,
)

#let has-image = type(og-image) == str and og-image != ""
#let is-poster = has-image and og-image.contains("/posters/")

#let align-mode = if og-description != "" { bottom } else { horizon }

#let logo-block = text(
  fill: theme.accent,
  weight: 700,
  size: type-scale.logo,
  "ege.celikci.me",
)

#let content-group(title, desc, size-title, size-desc, gap) = {
  set text(size: size-title, weight: 700, tracking: -0.02em)
  set par(leading: 0.25em)
  title
  if desc != "" {
    v(gap)
    set text(size: size-desc, weight: 400, tracking: 0em, fill: theme.muted)
    set par(leading: 0.6em)
    desc
  }
}

#let fit-content-group(title, desc, size-title, size-desc, gap, max-width, max-height) = context {
  let full = content-group(title, desc, size-title, size-desc, gap)

  if desc == "" or measure(full, width: max-width).height <= max-height {
    full
  } else {
    let words = desc.split()
    if words.len() == 0 {
      content-group(title, "", size-title, size-desc, gap)
    } else {
      let lo = 0
      let hi = words.len()
      let best = 0
      while lo <= hi {
        let mid = calc.floor((lo + hi) / 2)
        let prefix = if mid == 0 { "" } else { words.slice(0, mid).join(" ") }
        let trimmed = prefix + if mid < words.len() { "…" } else { "" }
        let candidate = content-group(title, trimmed, size-title, size-desc, gap)
        if measure(candidate, width: max-width).height <= max-height {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      let final-prefix = if best == 0 { "" } else { words.slice(0, best).join(" ") }
      let final-desc = final-prefix + if best < words.len() { "…" } else { "" }
      content-group(title, final-desc, size-title, size-desc, gap)
    }
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

    grid(
      columns: 1fr,
      rows: (auto, 1fr),
      gutter: spacing.gutter,
      logo-block,
      block(width: 100%, height: 100%)[
        #if is-poster [
          #align(bottom)[
            #fit-content-group(
              og-title,
              og-description,
              type-scale.title-lg,
              type-scale.desc-md,
              spacing.text-gap,
              size.width,
              row2-h,
            )
          ]
        ] else if has-image [
          #let text-col-w = size.width - sys.image-size - spacing.gutter
          #let text-col-h = calc.min(sys.image-size, row2-h)

          #align(bottom)[
            #grid(
              columns: (sys.image-size, 1fr),
              gutter: spacing.gutter,
              box(
                width: sys.image-size,
                height: sys.image-size,
                stroke: sys.stroke + theme.border,
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
