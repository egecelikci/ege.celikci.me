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
};

export const typography = {
  heading: {
    h1: "text-4xl md:text-5xl font-display font-bold",
    h2: "text-3xl md:text-4xl font-display font-bold",
    h3: "text-2xl md:text-3xl font-display font-bold",
    h4: "text-xl md:text-2xl font-semibold",
  },
  body: {
    base: "text-base leading-relaxed",
    large: "text-lg leading-relaxed",
    small: "text-sm",
  },
  mono: "font-mono text-sm",
  label: "text-xs uppercase tracking-widest font-bold",
};

export const components = {
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
      success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
      error:   "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
      info:    "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    }
  },
  input: {
    base:
      "w-full px-4 py-3 bg-surface border border-border rounded-lg transition-all",
    focus: "focus:border-primary focus:ring-1 focus:ring-primary outline-none",
  },
  tag: {
    base: "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors duration-200 border border-border",
    default: "bg-surface text-text-muted hover:text-primary hover:border-primary",
    active: "bg-primary text-white border-primary",
  },
  callout: {
    base: "flex gap-3 px-3 py-2 rounded-md border text-sm my-4",
    variants: {
      info: "bg-blue-50/50 text-blue-900 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800",
      warning: "bg-yellow-50/50 text-yellow-900 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:border-yellow-800",
      danger: "bg-red-50/50 text-red-900 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800",
      success: "bg-green-50/50 text-green-900 border-green-200 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800",
      action: "bg-purple-50/50 text-purple-900 border-purple-200 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800",
    }
  }
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
  navLink: "relative inline-block py-2 lg:py-1 text-xs lg:text-sm uppercase font-semibold tracking-wider text-text transition-colors hover:text-text-muted data-[active=true]:text-primary",
  navUnderline: "lg:after:absolute lg:after:bottom-0 lg:after:left-0 lg:after:h-[2px] lg:after:w-full lg:after:bg-primary lg:after:transition-transform lg:after:duration-300 lg:after:origin-right lg:after:scale-x-0 hover:lg:after:origin-left hover:lg:after:scale-x-100 data-[active=true]:lg:after:scale-x-100"
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
