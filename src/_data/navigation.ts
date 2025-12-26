export interface NavItem {
  title: string;
  href: string;
  order: number;
  visible: boolean;
  icon?: string;
}

export const navigation: NavItem[] = [
  { title: "home", href: "/", order: 1, visible: true, },
  { title: "music", href: "/music/", order: 2, visible: true, icon: "music", },
  {
    title: "notes",
    href: "/notes/",
    order: 3,
    visible: true,
    icon: "sticky-note",
  },
  { title: "wiki", href: "/wiki/", order: 4, visible: true, icon: "library", },
];
