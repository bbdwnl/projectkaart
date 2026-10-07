import type { Fase, Licht, Project, ProjectDatums, Taak, Uitzondering } from './types'
import { LIJSTEN, UITZONDERINGEN_GROEP, vindStandaardtaak, type DeadlineRegel, type Standaardtaak } from './taken'
import { dagen, dagenTussen, fmt, naarDatum, plusDagen } from './datum'
import { MIJLPAAL } from './fasen'

/** Binnen zoveel dagen voor de deadline wordt een taak oranje. */
export const LET_OP_DAGEN = 14

export function deadlineVan(regel: DeadlineRegel | undefined, p: ProjectDatums): Date | null {
  if (!regel) return null
  switch (regel.type) {
    case 'voorbereiding': {
      const v = naarDatum(p.datum_voorbereiding)
      return v ? plusDagen(v, -regel.dagen) : null
    }
    case 'inkoop': {
      const ink = naarDatum(p.datum_inkoop)
      if (!ink) return null
      const vb = naarDatum(p.datum_voorbereiding)
      const cs = naarDatum(p.datum_casco)
      const basis = regel.casco && cs && vb && cs > vb && cs < ink ? cs : ink
      const d = plusDagen(basis, -7 * regel.weken)
      return vb && d < vb ? vb : d
    }
    case 'afbouw': {
      const a = naarDatum(p.datum_afbouw)
      return a ? plusDagen(a, -regel.dagen) : null
    }
    case 'oplevering': {
      const o = naarDatum(p.datum_oplevering)
      return o ? plusDagen(o, regel.dagen) : null
    }
  }
}

export interface Beoordeling {
  licht: Licht
  /** Het woord op de tab; een stand zit nooit alleen in de kleur. */
  woord: string
  reden: string
  deadline: Date | null
  dagen: number | null
}

type TaakStand = Pick<Taak, 'status' | 'document_url' | 'document_naam' | 'reden_nvt'>

/**
 * Het stoplicht van één taak. Nooit met de hand gezet:
 * - groen: definitief én een document gekoppeld
 * - oranje: definitief zonder document, n.v.t. zonder reden, of deadline binnen 14 dagen
 * - rood: deadline voorbij en nog niet definitief
 * - grijs: n.v.t. (met reden) of volgende fase
 */
export function beoordeel(deadline: Date | null, taak: TaakStand | undefined, nu: Date): Beoordeling {
  const status = taak?.status ?? 'niet_gestart'
  if (status === 'nvt') {
    return taak?.reden_nvt
      ? { licht: 'later', woord: 'N.v.t.', reden: `N.v.t.: ${taak.reden_nvt}`, deadline, dagen: null }
      : { licht: 'letop', woord: 'Let op', reden: 'N.v.t., maar de reden ontbreekt', deadline, dagen: null }
  }
  if (status === 'volgende_fase') return { licht: 'later', woord: 'Later', reden: 'Schuift door naar de volgende fase', deadline, dagen: null }
  if (status === 'definitief') {
    return taak?.document_url || taak?.document_naam
      ? { licht: 'klaar', woord: 'Klaar', reden: 'Definitief', deadline, dagen: null }
      : { licht: 'letop', woord: 'Let op', reden: 'Definitief, maar nog geen document', deadline, dagen: null }
  }
  if (!deadline) return { licht: 'open', woord: 'Open', reden: 'Geen deadline', deadline: null, dagen: null }
  const n = dagenTussen(nu, deadline)
  if (n < 0) return { licht: 'telaat', woord: 'Te laat', reden: `${dagen(-n)} te laat`, deadline, dagen: n }
  if (n <= LET_OP_DAGEN) return { licht: 'letop', woord: 'Let op', reden: n === 0 ? 'Vandaag' : `Nog ${dagen(n)}`, deadline, dagen: n }
  return { licht: 'open', woord: 'Open', reden: `Nog ${dagen(n)}`, deadline, dagen: n }
}

export const ORDE: Record<Licht, number> = { telaat: 0, letop: 1, open: 2, klaar: 3, later: 4 }
export const OPEN_LICHTEN: Licht[] = ['telaat', 'letop', 'open']

/** De stand van een groep: het ergste licht telt, n.v.t. telt niet mee. */
export function samen(lichten: Licht[]): Licht {
  const echt = lichten.filter(l => l !== 'later')
  if (!echt.length) return 'later'
  if (echt.includes('telaat')) return 'telaat'
  if (echt.includes('letop')) return 'letop'
  return echt.every(l => l === 'klaar') ? 'klaar' : 'open'
}

/** Eén regel in de takenlijst: een standaardtaak of een uitzondering, met de stand erbij. */
export interface TaakRegel {
  /** 'std:<lijst>:<sleutel>' of 'uitz:<taak-id>' */
  id: string
  titel: string
  groep: string
  uitleg?: string
  fase: Fase
  standaard?: Standaardtaak
  uitzondering?: Uitzondering
  taak?: Taak
  b: Beoordeling
}

export const regelId = (lijst: Fase, sleutel: string) => `std:${lijst}:${sleutel}`

export function takenVan(fase: Fase, project: ProjectDatums, taken: Taak[], catalogus: Uitzondering[], nu: Date): TaakRegel[] {
  const perSleutel = new Map(taken.filter(t => t.sleutel).map(t => [`${t.lijst}:${t.sleutel}`, t]))
  const regels: TaakRegel[] = []
  for (const g of LIJSTEN[fase]) {
    for (const s of g.taken) {
      const taak = perSleutel.get(`${fase}:${s.sleutel}`)
      regels.push({ id: regelId(fase, s.sleutel), titel: s.titel, groep: g.titel, uitleg: g.uitleg, fase, standaard: s, taak, b: beoordeel(deadlineVan(s.regel, project), taak, nu) })
    }
  }
  for (const taak of taken) {
    if (!taak.uitzondering_id || taak.fase !== fase) continue
    const u = catalogus.find(c => c.id === taak.uitzondering_id)
    regels.push({ id: `uitz:${taak.id}`, titel: u?.titel ?? 'Onbekende uitzondering', groep: UITZONDERINGEN_GROEP, fase, uitzondering: u, taak, b: beoordeel(naarDatum(taak.deadline), taak, nu) })
  }
  return regels
}

export function telling(regels: { b: Beoordeling }[]): Record<Licht, number> {
  const t: Record<Licht, number> = { telaat: 0, letop: 0, open: 0, klaar: 0, later: 0 }
  for (const r of regels) t[r.b.licht]++
  return t
}

/** Te laat eerst, dan let op, dan open; binnen een stand de vroegste deadline eerst. */
export function opUrgentie<T extends { b: Beoordeling }>(regels: T[]): T[] {
  const tijd = (r: T) => r.b.deadline ? r.b.deadline.getTime() : Number.MAX_SAFE_INTEGER
  return [...regels].sort((a, b) => ORDE[a.b.licht] - ORDE[b.b.licht] || tijd(a) - tijd(b))
}

/** De stand van een overdrachtseis, afgeleid uit de gekoppelde taken ('lijst:sleutel'). */
export function eisStand(koppelingen: string[], project: ProjectDatums, taken: Taak[], nu: Date): Licht {
  return samen(koppelingen.map((k) => {
    const [lijst, sleutel] = k.split(':') as [Fase, string]
    const s = vindStandaardtaak(lijst, sleutel)
    const taak = taken.find(t => t.lijst === lijst && t.sleutel === sleutel)
    return beoordeel(deadlineVan(s?.regel, project), taak, nu).licht
  }))
}

export interface Mijlpaal { naam: string, datum: Date, dagen: number }

export function volgendeMijlpaal(project: Pick<Project, 'fase'> & ProjectDatums, nu: Date): Mijlpaal | null {
  const mp = MIJLPAAL[project.fase]
  const d = mp ? naarDatum(project[mp.veld]) : null
  return mp && d ? { naam: mp.naam, datum: d, dagen: dagenTussen(nu, d) } : null
}

export interface ZinDeel { tekst: string, licht?: Licht }

/** De zin die het praten doet, bovenaan de kaart. */
export function standZin(project: Pick<Project, 'fase'> & ProjectDatums, regels: { b: Beoordeling }[]): ZinDeel[] {
  const t = telling(regels)
  const tot = regels.length - t.later
  const mp = MIJLPAAL[project.fase]
  const mpd = mp ? naarDatum(project[mp.veld]) : null
  const naar = mp ? (mpd ? ` voor ${mp.naam} op ${fmt(mpd)}` : ` voor ${mp.naam}`) : ' voor de overdracht'
  const taken = (n: number) => (n === 1 ? 'taak' : 'taken')
  const vragen = (n: number) => (n === 1 ? 'vraagt' : 'vragen')
  if (!tot) return [{ tekst: 'Geen taken in deze fase.' }]
  if (t.telaat) {
    const delen: ZinDeel[] = [{ tekst: `${t.telaat} ${taken(t.telaat)} te laat`, licht: 'telaat' }]
    if (t.letop) delen.push({ tekst: ' en ' }, { tekst: `${t.letop} ${vragen(t.letop)} aandacht`, licht: 'letop' })
    delen.push({ tekst: `${naar}.` })
    return delen
  }
  if (t.letop) return [{ tekst: `${t.letop} ${taken(t.letop)} ${vragen(t.letop)} aandacht`, licht: 'letop' }, { tekst: `${naar}.` }]
  if (t.klaar === tot) return [{ tekst: `Alles${naar} is ` }, { tekst: 'klaar.', licht: 'klaar' }]
  if (!t.klaar) return [{ tekst: `${tot} ${taken(tot)} open${naar}.` }]
  return [{ tekst: 'Op schema: ' }, { tekst: `${t.klaar} van ${tot} klaar`, licht: 'klaar' }, { tekst: `${naar}.` }]
}
