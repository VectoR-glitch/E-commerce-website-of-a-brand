// Flies a clone of a product image in an arc into the header cart link, then
// fires `klen:cart-bump` so the cart pops on arrival. No-ops under reduced
// motion (still fires the event so the count updates without animation).
// Shared by the PDP add-to-cart and the kit "Add kit to cart" buttons.
export function flyToCart(source: HTMLElement | null, imageSrc?: string) {
  if (typeof window === "undefined") return;
  const fire = () => window.dispatchEvent(new Event("klen:cart-bump"));
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const target = document.getElementById("cart-link");
  if (reduce || !source || !target || !imageSrc) {
    fire();
    return;
  }

  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const size = Math.min(150, s.width * 0.55);
  const startX = s.left + s.width / 2 - size / 2;
  const startY = s.top + s.height / 2 - size / 2;

  const clone = document.createElement("img");
  clone.src = imageSrc;
  Object.assign(clone.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: "60",
    filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.18))",
  });
  document.body.appendChild(clone);

  const dx = t.left + t.width / 2 - (startX + size / 2);
  const dy = t.top + t.height / 2 - (startY + size / 2);

  const anim = clone.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(0.78) rotate(-6deg)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2, offset: 1 },
    ],
    { duration: 720, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
  );
  anim.onfinish = () => {
    clone.remove();
    fire();
  };
  anim.oncancel = () => clone.remove();
}
