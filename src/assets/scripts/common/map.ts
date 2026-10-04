import L from "leaflet";

/**
 * Every event the site lists is in the İzmir area, so the map is pinned to the province: panning and zooming out stop at its edges instead of drifting into the world.
 */
const IZMIR_BOUNDS = L.latLngBounds([38.2, 26.8], [38.65, 27.45]);

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
        zoom: 15,
        minZoom: 12,
        maxBounds: IZMIR_BOUNDS,
        maxBoundsViscosity: 1,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.attribution({
        position: "topright",
        prefix: false,
      }).addTo(map);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
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
