/**
 * map.ts
 * Leaflet integration for venue maps.
 */

import L from "leaflet";

export function initVenueMaps() {
  const mapContainers = document.querySelectorAll(".venue-map");
  if (!mapContainers.length) return;

  mapContainers.forEach((container) => {
    const element = container as HTMLElement;
    const lat = parseFloat(element.dataset.lat || "0");
    const lng = parseFloat(element.dataset.lng || "0");
    const name = element.dataset.name || "Venue";

    if (!lat || !lng) return;

    // Initialize map with a small timeout to ensure container size is stable
    setTimeout(() => {
      const map = L.map(element, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark-mode friendly tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
        },
      ).addTo(map);

      // Custom marker icon
      const icon = L.divIcon({
        className: "custom-venue-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-primary/20 rounded-full animate-ping"></div>
            <div class="relative w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([lat, lng], { icon }).addTo(map);

      // Fix for mobile: ensure map doesn't swallow clicks on our custom popup
      const navGroup = element.parentElement?.querySelector(".group\\/nav");
      if (navGroup) {
        L.DomEvent.disableClickPropagation(navGroup as HTMLElement);
        L.DomEvent.disableScrollPropagation(navGroup as HTMLElement);
      }

      // Force a resize check
      map.invalidateSize();

      // Fade in effect
      element.classList.add("map-ready");
    }, 100);
  });
}
