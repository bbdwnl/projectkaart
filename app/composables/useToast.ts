export interface Melding { tekst: string, soort: 'ok' | 'fout', id: number }

let timer: ReturnType<typeof setTimeout> | undefined

export function useToast() {
  const melding = useState<Melding | null>('toast', () => null)
  /** Een langere tekst krijgt meer tijd: geef dan zelf het aantal milliseconden mee. */
  function toon(tekst: string, soort: Melding['soort'] = 'ok', duur?: number) {
    melding.value = { tekst, soort, id: Date.now() }
    clearTimeout(timer)
    timer = setTimeout(() => (melding.value = null), duur ?? (soort === 'fout' ? 5000 : 2400))
  }
  return { melding, toon }
}
