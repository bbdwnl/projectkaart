/** Telt een getal op naar zijn waarde (ease-out), en opnieuw als de waarde verandert. */
export function useTeller(doel: () => number, opties: { duur?: number, vertraging?: number } = {}) {
  const waarde = ref(0)
  let frame = 0
  function animeer(naar: number) {
    cancelAnimationFrame(frame)
    const van = waarde.value
    const duur = minderBeweging() ? 0 : opties.duur ?? 700
    if (!duur) {
      waarde.value = naar
      return
    }
    const t0 = performance.now()
    const stap = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - t0) / duur))
      waarde.value = van + (naar - van) * (1 - (1 - p) ** 3)
      if (p < 1) frame = requestAnimationFrame(stap)
    }
    frame = requestAnimationFrame(stap)
  }
  onMounted(() => setTimeout(() => animeer(doel()), minderBeweging() ? 0 : opties.vertraging ?? 0))
  watch(doel, n => animeer(n))
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return computed(() => Math.round(waarde.value))
}
