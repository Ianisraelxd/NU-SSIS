export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const COLORS = ['#f5b800', '#1536b0', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#ff7a1a']

// A small confetti burst from the centre of `el` (or a pointer event). Purely decorative.
export function burst(source, count = 28) {
  if (prefersReducedMotion() || typeof document === 'undefined') return
  const rect = source?.getBoundingClientRect
    ? source.getBoundingClientRect()
    : { left: source?.clientX ?? innerWidth / 2, top: source?.clientY ?? innerHeight / 2, width: 0, height: 0 }
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden'
  document.body.appendChild(layer)

  let finished = 0
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i')
    const size = 6 + Math.random() * 7
    piece.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${
      COLORS[i % COLORS.length]
    };border-radius:${Math.random() > 0.6 ? '50%' : '2px'}`
    layer.appendChild(piece)

    const angle = Math.random() * Math.PI * 2
    const power = 80 + Math.random() * 170
    const dx = Math.cos(angle) * power
    const dy = Math.sin(angle) * power - 90
    const spin = (Math.random() - 0.5) * 900
    const anim = piece.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px, ${dy + 220}px) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    )
    anim.onfinish = () => {
      if (++finished === count) layer.remove()
    }
  }
}
