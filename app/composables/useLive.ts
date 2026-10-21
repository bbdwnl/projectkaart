import type { Luister } from '~/data/bron'

/**
 * Live bijwerken: wijzigt iemand anders iets in deze tabellen, dan roept hij na een korte pauze bij aan (meestal: stil
 * opnieuw laden). wat mag van de stand afhangen (bijvoorbeeld het project); null = niet luisteren. Stopt vanzelf.
 */
export function useLive(wat: () => Luister[] | null, bij: () => void, pauze = 600) {
  const bron = useBron()
  let stop: (() => void) | null = null
  let wekker: ReturnType<typeof setTimeout> | undefined
  watch(() => JSON.stringify(wat()), () => {
    stop?.()
    stop = null
    const w = wat()
    if (!w) return
    stop = bron.luister(w, () => {
      clearTimeout(wekker)
      wekker = setTimeout(bij, pauze)
    })
  }, { immediate: true })
  onScopeDispose(() => {
    stop?.()
    clearTimeout(wekker)
  })
}
