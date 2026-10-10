import L from "leaflet";
import { leafletLayer } from "protomaps-leaflet";

/**
 * Bounds of every venue the site has listed, plus a margin: panning and zooming out stop at the province instead of drifting into the world. Çeşme (26.31E) and Bergama (39.12N) are the far corners, so the box is province-wide rather than just the metro area.
 */
const IZMIR_BOUNDS = L.latLngBounds([38.22, 26.21], [39.22, 27.32]);

/**
 * Vector extract covering those bounds, built from OpenStreetMap data. Regenerating it means a new file, since `/assets/*` is cached immutably.
 */
const TILES = "/assets/tiles/izmir-20261007.pmtiles";

export function initVenueMaps() {
  const mapContainers = document.querySelectorAll(".venue-map");
  if (!mapContainers.length) return;

  mapContainers.forEach((container) => {
    const element = container as HTMLElement;
    const lat = parseFloat(element.dataset.lat || "0");
    const lng = parseFloat(element.dataset.lng || "0");

    if (!lat || !lng) return;

    setTimeout(() => {
      const map = L.map(element, {
        center: [lat, lng],
        zoom: 16,
        minZoom: 12,
        maxZoom: 19,
        maxBounds: IZMIR_BOUNDS,
        maxBoundsViscosity: 1,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.attribution({
        position: "topright",
        prefix: false,
      }).addTo(map);

      // The flavor supplies both paint and label rules, and `labelRules` is ignored whenever `flavor` is set. Going fully label-free means dropping `flavor` and passing `paintRules(namedFlavor("grayscale"))` with `labelRules: []` instead.
      leafletLayer({
        url: TILES,
        flavor: "grayscale",
        maxDataZoom: 15,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = L.divIcon({
        className: "custom-venue-marker",
        html: `
          <div class="leaflet-marker-halo"></div>
          <div class="leaflet-marker-dot"></div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([lat, lng], { icon }).addTo(map);

      const navGroup = element.parentElement?.querySelector(".group\\/nav");
      if (navGroup) {
        L.DomEvent.disableClickPropagation(navGroup as HTMLElement);
        L.DomEvent.disableScrollPropagation(navGroup as HTMLElement);
      }

      const invalidate = () => map.invalidateSize();
      invalidate();

      requestAnimationFrame(() => setTimeout(invalidate, 300));
      document.fonts?.ready.then(() => requestAnimationFrame(invalidate));
      self.addEventListener("resize", invalidate);

      element.classList.add("map-ready");
    }, 100);
  });
}
