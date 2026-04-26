/**
 * src/_data/theme.ts
 *
 * The Single Source of Truth for the project's design system.
 * Establish semantic tokens for all visual elements.
 */

export const spacing = {
  section: "py-12 md:py-20",
  container: "px-4 md:px-0",
  gap: {
    xs: "gap-2",
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
    xl: "gap-12",
  },
  flow: {
    base: "var(--flow-space, 1.5em)",
    tight: "0.75em",
    loose: "2.5em",
  },
};

export const typography = {
  // Fluid Type Scale (Utopia-inspired clamps)
  size: {
    step_0: "clamp(1rem, 0.96rem + 0.22vw, 1.13rem)",
    step_1: "clamp(1.25rem, 1.16rem + 0.43vw, 1.5rem)",
    step_2: "clamp(1.56rem, 1.41rem + 0.76vw, 2rem)",
    step_3: "clamp(1.95rem, 1.71rem + 1.24vw, 2.66rem)",
    step_4: "clamp(2.44rem, 2.05rem + 1.93vw, 3.55rem)",
    step_5: "clamp(3.05rem, 2.46rem + 2.96vw, 4.74rem)",
  },

  heading: {
    h1:
      "text-[length:var(--size-step-4)] font-display font-bold tracking-tight text-text leading-[1.1] text-balance",
    h2:
      "text-[length:var(--size-step-3)] font-display font-bold tracking-tight text-text leading-[1.1] text-balance",
    h3:
      "text-[length:var(--size-step-2)] font-display font-bold tracking-tight text-text leading-[1.1] text-balance",
    h4:
      "text-[length:var(--size-step-1)] font-semibold tracking-tight text-text leading-[1.2]",
  },

  body: {
    base:
      "text-[length:var(--size-step-0)] leading-[1.7] text-text/90 max-w-[65ch]",
    large:
      "text-[length:var(--size-step-1)] leading-[1.7] text-text/90 max-w-[60ch]",
    small: "text-sm text-text/80",
    serif: "font-serif leading-[1.7]",
  },

  mono: "font-mono text-[length:var(--size-step-0)] tracking-tight",
  label: "text-[10px] font-mono uppercase tracking-[0.3em] font-bold",

  // Semantic Text Colors
  colors: {
    primary: "text-text",
    muted: "text-text-muted/70",
    subtle: "text-text-muted/60",
    dim: "text-text-muted/40",
    accent: "text-primary/70",
  },
};

export const components = {
  // Shared patterns for EntryCard, Note, etc.
  listing: {
    container:
      "group relative flex flex-col gap-8 md:gap-12 px-4 -mx-4 py-16 md:py-24 border-b border-border/10 last:border-b-0 transition-all duration-500 hover:bg-surface/2 active:bg-surface/5",
    containerCompact:
      "group relative flex flex-col gap-4 md:gap-6 px-4 -mx-4 py-8 md:py-12 border-b border-border/10 last:border-b-0 transition-all duration-500 hover:bg-surface/2 active:bg-surface/5",
    row:
      "group relative flex flex-col md:flex-row md:items-baseline gap-2 md:gap-6 py-6 border-b border-border/10 last:border-b-0 transition-all hover:bg-surface/2 no-underline",
    accentBar:
      "absolute -left-[1px] top-16 md:top-24 bottom-16 md:bottom-24 w-0.5 bg-primary/0 group-hover:bg-primary/40 transition-all duration-500 z-20",
    accentBarCompact:
      "absolute -left-[1px] top-8 md:top-12 bottom-8 md:bottom-12 w-0.5 bg-primary/0 group-hover:bg-primary/40 transition-all duration-500 z-20",
    metaRow:
      "relative z-20 flex items-center gap-4 opacity-80 md:opacity-40 group-hover:opacity-100 group-[.is-active]:opacity-100 transition-opacity",
    title:
      "text-3xl md:text-4xl font-bold tracking-tighter text-text group-hover:text-primary group-[.is-active]:text-primary transition-colors leading-tight m-0 relative z-20",
    description:
      "text-lg md:text-xl text-text-muted/70 group-hover:text-text group-[.is-active]:text-text transition-colors leading-relaxed relative z-20",
    footer:
      "relative z-10 flex items-center justify-between pt-8 border-t border-border/5 opacity-60 md:opacity-40 group-hover:opacity-100 group-[.is-active]:opacity-100 transition-opacity duration-500",
  },

  media: {
    container:
      "grid gap-1 w-full rounded-xl overflow-hidden border border-border/10 my-2 bg-surface/20",
    item:
      "media relative block w-full h-full overflow-hidden bg-surface/20 decoration-none color-inherit cursor-zoom-in group/media",
    image:
      "w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover/media:scale-105 group-active/media:scale-95 block",
    grids: {
      eq1: "grid-cols-1",
      eq2: "grid-cols-2 aspect-[2/1]",
      eq3: "grid-cols-2 grid-rows-2 aspect-[2/1]",
      eq4: "grid-cols-2 grid-rows-2 aspect-[2/1]",
    },
    altBadge:
      "alt-badge absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/10 opacity-90 shadow-sm pointer-events-none",
  },

  litebox: {
    modal:
      "media-modal-container fixed inset-0 z-[1000] flex flex-col w-full h-full max-w-full max-h-full overflow-hidden bg-black",
    carousel:
      "carousel flex w-full h-full overflow-hidden select-none touch-pan-x",
    item:
      "carousel-item flex-[0_0_100%] w-full h-full flex items-center justify-center p-0",
    image:
      "max-w-full max-h-full object-contain transition-transform duration-300 vertical-middle",
    controls:
      "carousel-top-controls absolute top-0 left-0 right-0 p-6 md:p-10 flex justify-between items-center z-10 pointer-events-auto pt-[max(1.5rem,env(safe-area-inset-top))] px-[max(1.5rem,env(safe-area-inset-right,1.5rem))] pl-[max(1.5rem,env(safe-area-inset-left,1.5rem))] transition-opacity duration-500",
    button:
      "carousel-button pointer-events-auto bg-white/10 backdrop-blur-md border border-white/10 text-white w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/20 active:scale-90 shadow-lg shrink-0",
    dots:
      "carousel-dots pointer-events-auto bg-white/10 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-0.5 px-2 py-0.5 shadow-lg mx-4 min-w-0 overflow-hidden",
    dot:
      "carousel-dot w-6 h-6 flex items-center justify-center text-white/30 text-lg transition-all data-[active=true]:text-white data-[active=true]:scale-125 disabled:pointer-events-none hover:text-white/60",
    indicator: "carousel-indicator flex items-center gap-2",
    counter:
      "carousel-counter text-white/80 text-[10px] font-mono font-bold bg-white/10 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full shadow-lg",

    alt:
      "media-alt absolute bottom-[max(24px,env(safe-area-inset-bottom,24px))] left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-3 rounded-xl max-w-[min(600px,90vw)] text-sm leading-relaxed text-center z-10 border border-white/10 transition-all duration-300 pointer-events-auto shadow-2xl",
    altDesc: "media-alt-desc inline-block text-left",
    sheet: {
      backdrop:
        "fixed inset-0 bg-black/40 backdrop-blur-sm z-[1100] transition-opacity duration-300",
      container:
        "fixed bottom-0 left-0 right-0 z-[1200] bg-surface border-t border-border rounded-t-3xl p-6 md:p-8 transform transition-transform duration-300 flex flex-col gap-6 max-h-[80vh] overflow-y-auto shadow-2xl md:max-w-2xl md:mx-auto md:mb-8 md:rounded-3xl md:border",
      header: "flex items-center justify-between gap-4",
      title: "text-xl font-bold tracking-tight text-text",
      close: "p-2 rounded-full hover:bg-black/5 transition-colors",
      content:
        "text-base leading-relaxed text-text/90 whitespace-pre-wrap text-pretty",
    },
    menu: {
      container:
        "absolute top-full right-0 mt-2 min-w-[200px] bg-surface border border-border rounded-xl shadow-xl z-[1300] overflow-hidden transform origin-top-right transition-all",
      item:
        "flex items-center gap-3 px-4 py-3 text-sm font-medium text-text hover:bg-black/5 transition-colors w-full text-left",
    },
  },

  gallery: {
    container: "mb-4",
    item:
      "note-gallery__link group/img relative block overflow-hidden rounded-2xl border border-border/10 bg-surface/10 cursor-zoom-in transition-all duration-700 [&_picture]:contents",
    image:
      "absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out group-hover/img:scale-105 group-[.is-active]/img:scale-105",
    overlay:
      "absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-bg/80 backdrop-blur-md border border-border/10 text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted/60 opacity-100 md:opacity-0 md:group-hover/img:opacity-100 md:group-[.is-active]/img:opacity-100 transition-all duration-500 pointer-events-none z-20",
  },

  album: {
    card:
      "album-item group flex flex-col gap-3 relative no-underline transition-all duration-500",
    coverWrapper:
      "w-full aspect-square block relative z-10 rounded-xl overflow-hidden bg-white/80 dark:bg-white/5 transition-all duration-700 ease-out group-hover:scale-105 group-[.is-active]:scale-105",
    meta:
      "flex flex-col gap-0.5 opacity-60 md:opacity-40 group-hover:opacity-100 group-[.is-active]:opacity-100 transition-opacity duration-500",
    title: "block text-[11px] font-bold text-text truncate tracking-tight",
    artist:
      "block text-[9px] font-mono uppercase tracking-[0.1em] text-text-muted/60 truncate",
  },

  card: {
    base: "rounded-xl border border-border bg-surface/30 transition-all",
    hover: "hover:bg-surface hover:border-primary/50 hover:-translate-y-0.5",
    padding: "p-5",
  },

  button: {
    base:
      "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all",
    primary: "bg-primary text-white hover:bg-primary-offset",
    secondary: "border border-border hover:border-primary",
  },

  badge: {
    base:
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest",
    status: "border shadow-sm",
    variants: {
      default: "bg-surface text-text-muted border-border",
      primary: "bg-primary/10 text-primary border-primary/20",
      success:
        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      warning:
        "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
      error: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
      info:
        "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    },
  },

  input: {
    base:
      "w-full px-4 py-3 bg-surface border border-border rounded-lg transition-all",
    focus: "focus:border-primary focus:ring-1 focus:ring-primary outline-none",
  },

  tag: {
    base:
      "inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 border",
    default:
      "bg-primary/5 text-primary/70 border-primary/10 hover:bg-primary/10 hover:text-primary hover:border-primary/20",
    active: "bg-primary text-white border-primary",
  },

  callout: {
    base: "flex gap-3 px-3 py-2 rounded-md border text-sm my-4",
    variants: {
      info:
        "bg-blue-50/50 text-blue-900 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800",
      warning:
        "bg-yellow-50/50 text-yellow-900 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:border-yellow-800",
      danger:
        "bg-red-50/50 text-red-900 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800",
      success:
        "bg-green-50/50 text-green-900 border-green-200 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800",
      action:
        "bg-purple-50/50 text-purple-900 border-purple-200 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800",
    },
  },
};

export const layout = {
  container: {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-screen-2xl",
    full: "max-w-full",
  },
  grid: {
    auto: "grid grid-cols-1 md:grid-cols-2",
    wiki: "grid grid-cols-1 md:grid-cols-2 gap-4",
  },
};

export const utilities = {
  transition: "transition-all duration-300 ease-out",
  focusRing:
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  truncate: "truncate overflow-hidden",
  link: "no-underline transition-colors hover:text-primary",
  navLink:
    "relative inline-block py-2 lg:py-1 text-xs lg:text-sm uppercase font-semibold tracking-wider text-text transition-colors hover:text-text-muted data-[active=true]:text-primary",
  navUnderline:
    "lg:after:absolute lg:after:bottom-0 lg:after:left-0 lg:after:h-[2px] lg:after:w-full lg:after:bg-primary lg:after:transition-transform lg:after:duration-300 lg:after:origin-right lg:after:scale-x-0 hover:lg:after:origin-left hover:lg:after:scale-x-100 data-[active=true]:lg:after:scale-x-100",
};

// Helper function to merge classes
export function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean,).join(" ",);
}

export default {
  spacing,
  typography,
  components,
  layout,
  utilities,
  cx,
};
