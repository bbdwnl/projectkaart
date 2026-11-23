/**
 * De vormgeving van de hele app, te wisselen bovenin de balk (beslissing 45). Per apparaat bewaard in een cookie.
 * - kaarten: de kaartenbak (ruim, 2px zwarte rand, de tab boven de kaart). De standaard.
 * - zakelijk: sober en compact. Rustige kleuren, dunne lijnen, kleinere letters en meer informatie per regel.
 */
export const THEMAS = [
  { id: 'kaarten', naam: 'Kaarten', uitleg: 'Ruim en overzichtelijk' },
  { id: 'zakelijk', naam: 'Zakelijk', uitleg: 'Sober en compact, met meer informatie per regel' },
] as const

export type Thema = typeof THEMAS[number]['id']

/** Een oude of onbekende waarde in de cookie wordt gewoon weer de standaard. */
export const leesThema = (v: unknown): Thema => THEMAS.find(t => t.id === v)?.id ?? 'kaarten'
