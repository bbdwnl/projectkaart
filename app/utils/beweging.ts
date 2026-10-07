/** prefers-reduced-motion: dan staat alle beweging uit. */
export const minderBeweging = (): boolean => import.meta.client && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Wacht tot de browser het volgende beeld tekent (voor een overgang die vanaf 0 moet starten). */
export const volgendBeeld = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
