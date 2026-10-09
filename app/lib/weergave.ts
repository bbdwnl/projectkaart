/** Wat iemand op de projectkaart wil zien. Per apparaat bewaard in een cookie. */

export const TABS = ['taken', 'proces', 'controle', 'details'] as const
export type Tab = typeof TABS[number]

export interface Weergave {
  tab: Tab
  kop: { stoplicht: boolean, planningstrook: boolean }
  taken: {
    eerstDit: boolean
    compact: boolean
    kolommen: { eigenaar: boolean, deadline: boolean, akkoord: boolean, document: boolean }
  }
  proces: { flow: boolean, tijdlijn: boolean, datums: boolean }
  details: { gegevens: boolean, leveranciers: boolean, geld: boolean, logboek: boolean }
}

export const WEERGAVE_STANDAARD: Weergave = {
  tab: 'taken',
  kop: { stoplicht: true, planningstrook: true },
  taken: { eerstDit: false, compact: false, kolommen: { eigenaar: true, deadline: true, akkoord: true, document: true } },
  proces: { flow: true, tijdlijn: true, datums: true },
  details: { gegevens: true, leveranciers: true, geld: true, logboek: true },
}

const kopie = <T>(o: T): T => JSON.parse(JSON.stringify(o))

/** Neemt alleen bekende sleutels met het juiste type over: een oude of kapotte cookie breekt niets. */
function samenvoegen(basis: Record<string, unknown>, extra: unknown): void {
  if (!extra || typeof extra !== 'object') return
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (!(k in basis)) continue
    const b = basis[k]
    if (b && typeof b === 'object' && v && typeof v === 'object') samenvoegen(b as Record<string, unknown>, v)
    else if (typeof b === typeof v) basis[k] = v
  }
}

export function leesWeergave(bewaard: unknown): Weergave {
  const w = kopie(WEERGAVE_STANDAARD)
  let bron = bewaard
  if (typeof bron === 'string') {
    try { bron = JSON.parse(bron) } catch { bron = null }
  }
  samenvoegen(w as unknown as Record<string, unknown>, bron)
  if (!TABS.includes(w.tab)) w.tab = 'taken'
  return w
}

export const standaardWeergave = (tab: Tab = 'taken'): Weergave => ({ ...kopie(WEERGAVE_STANDAARD), tab })

/** Kolommen van de takenlijst, in volgorde, met hun breedte. */
export const KOLOMMEN: { id: string, breedte: string, schakelbaar?: keyof Weergave['taken']['kolommen'] }[] = [
  { id: 'stand', breedte: '86px' },
  { id: 'taak', breedte: 'minmax(0,1fr)' },
  { id: 'eigenaar', breedte: '104px', schakelbaar: 'eigenaar' },
  { id: 'deadline', breedte: '116px', schakelbaar: 'deadline' },
  { id: 'akkoord', breedte: '62px', schakelbaar: 'akkoord' },
  { id: 'document', breedte: '186px', schakelbaar: 'document' },
  { id: 'status', breedte: '128px' },
  { id: 'knop', breedte: '32px' },
]

export function kolomSjabloon(w: Weergave): string {
  return KOLOMMEN.filter(k => !k.schakelbaar || w.taken.kolommen[k.schakelbaar]).map(k => k.breedte).join(' ')
}
