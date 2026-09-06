export function initAperture(
  aperture: HTMLElement,
  labels: string[],
): (idx: number, progress: number) => void {
  const drum = aperture.querySelector<HTMLElement>(".breadcrumb__drum");
  const faces = Array.from(
    aperture.querySelectorAll<HTMLElement>(".breadcrumb__letter-face"),
  );
  const wheel = !!drum && faces.length === 2 &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (drum) drum.style.transition = "none";

  return (idx, progress) => {
    if (!wheel) {
      for (const face of faces) face.textContent = labels[idx];
      if (drum) drum.style.transform = "translateY(0)";
      return;
    }
    if (faces[0].textContent !== labels[idx]) {
      faces[0].textContent = labels[idx];
    }
    if (idx + 1 < labels.length) {
      if (faces[1].textContent !== labels[idx + 1]) {
        faces[1].textContent = labels[idx + 1];
      }
      drum!.style.transform = `translateY(-${(progress * 100).toFixed(2)}%)`;
    } else {
      drum!.style.transform = "translateY(0)";
    }
  };
}
