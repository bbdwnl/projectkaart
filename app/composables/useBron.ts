import type { Bron } from '~/data/bron'

export const useBron = (): Bron => useNuxtApp().$bron

export const foutTekst = (e: unknown) => e instanceof Error ? e.message : 'Er ging iets mis. Probeer het nog eens.'
