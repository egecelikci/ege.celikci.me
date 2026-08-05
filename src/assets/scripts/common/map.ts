import L from "leaflet";

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
        zoomControl: false,
        attributionControl: false,
      });

      L.control.attribution({
        position: "topright",
        prefix: false,
      }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);

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
