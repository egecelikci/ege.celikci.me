export interface CollectionConfig {
  name: string;
  filter: string;
  sort: string;
  layout: string;
}

export const collections: Record<string, CollectionConfig> = {
  posts: {
    name: "blog",
    filter: "type=post",
    sort: "date=desc",
    layout: "layouts/content.vto",
  },
  notes: {
    name: "notes",
    filter: "type=note",
    sort: "date=desc",
    layout: "layouts/note.vto",
  },
  wiki: {
    name: "wiki",
    filter: "type=entry !meta",
    sort: "updated=desc",
    layout: "layouts/content.vto",
  },
};

export function getCollection(site: any, name: keyof typeof collections,) {
  const config = collections[name];
  return site.search.pages(config.filter, config.sort,);
}
