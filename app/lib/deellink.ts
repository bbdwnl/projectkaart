import type { Controlepunt, Deellink, DeellinkReden, Leverancier, PlekVeld, Project, Tekening } from './types'
import { nummerPerProject } from './controle'
import { fmt } from './datum'

// Delen met een leverancier: een link naar een eigen pagina met alleen zijn open aandachtspunten, achter een code
// van vijf cijfers. Dezelfde regels voor de server (echt, server/api/punten) en de proefversie (bron-demo.ts).
// Relatieve imports: dit draait ook op de server.

export const MAX_POGINGEN = 10
export const TOKEN_VORM = /^[0-9a-f]{64}$/
/** Vijf cijfers, alleen 2 tot en met 9: geen 0 en 1, die lijken op O en I of l. */
export const CODE_VORM = /^[2-9]{5}$/

export type LinkStand = 'open' | 'verlopen' | DeellinkReden

export function standVan(link: Pick<Deellink, 'geldig_tot' | 'gesloten_reden'>, nu: Date): LinkStand {
  if (link.gesloten_reden) return link.gesloten_reden
  return Date.parse(link.geldig_tot) <= nu.getTime() ? 'verlopen' : 'open'
}

/** Wat medewerkers zien bij een link. */
export const STAND_TEKST: Record<LinkStand, string> = {
  open: 'Actief',
  verlopen: 'Verlopen',
  opgelost: 'Dicht: alles opgelost',
  ingetrokken: 'Ingetrokken',
  geblokkeerd: 'Dicht: te vaak een verkeerde code',
}

const nieuwsteEerst = (a: Deellink, b: Deellink) => Date.parse(b.aangemaakt_op) - Date.parse(a.aangemaakt_op)

/** De link die nu openstaat voor deze leverancier (de nieuwste), of null. */
export function actieveLink(links: Deellink[], leverancierId: string, nu: Date): Deellink | null {
  return links.filter(l => l.leverancier_id === leverancierId && standVan(l, nu) === 'open').sort(nieuwsteEerst)[0] ?? null
}

/** De laatste link voor deze leverancier, ook als hij dicht is. */
export function laatsteLink(links: Deellink[], leverancierId: string): Deellink | null {
  return links.filter(l => l.leverancier_id === leverancierId).sort(nieuwsteEerst)[0] ?? null
}

export const linkAdres = (origin: string, token: string) => `${origin}/punten/${token}`

/** Een token van 64 tekens uit 32 willekeurige bytes. */
export const nieuwToken = (bytes: Uint8Array) => [...bytes.slice(0, 32)].map(b => b.toString(16).padStart(2, '0')).join('')
/** Een code van vijf cijfers van 2 tot 9 uit vijf willekeurige bytes (256 is deelbaar door 8: elk cijfer even vaak). */
export const nieuweCode = (bytes: Uint8Array) => [...bytes.slice(0, 5)].map(b => String((b % 8) + 2)).join('')

/** Het bericht bij de link, voor de mail of om te delen. De code staat er bewust niet in: die gaat apart. */
export function deelTekst(a: { leverancier: string, adres: string, geldigTot: string, door: string | null }): { onderwerp: string, tekst: string } {
  return {
    onderwerp: 'Open aandachtspunten BbDW',
    tekst: [
      `Beste ${a.leverancier},`,
      '',
      'Op deze pagina staan de aandachtspunten van BbDW die voor jullie nog open staan, met foto\'s en de plek op de tekening:',
      a.adres,
      '',
      `De code om de pagina te openen krijg je apart. De link is geldig tot ${fmt(new Date(a.geldigTot))} en sluit vanzelf zodra alles is opgelost.`,
      '',
      'Met vriendelijke groet,',
      a.door ?? 'BbDW',
    ].join('\n'),
  }
}

// ---------- de pagina van de leverancier ----------

export type ExternPunt = Pick<Controlepunt, 'id' | 'project_id' | 'notitie' | 'aangemaakt_op' | PlekVeld> & {
  /** Zoals op de tekening en in de lijsten bij BbDW. */
  nummer: number
  /** Een tijdelijk adres van de foto. */
  foto: string | null
}
export type ExternProject = Pick<Project, 'id' | 'naam' | 'plaats' | 'adres'>
export type ExternTekening = Pick<Tekening, 'id' | 'project_id' | 'naam'>

export interface ExternInhoud {
  leverancier: Pick<Leverancier, 'naam' | 'vak'>
  geldig_tot: string
  /** Wie de link maakte: het aanspreekpunt bij BbDW. */
  gedeeld_door: string | null
  projecten: ExternProject[]
  punten: ExternPunt[]
  tekeningen: ExternTekening[]
}

export type DichtStand = Exclude<LinkStand, 'open'>
export type ExternAntwoord =
  | { stand: 'onbekend' }
  | { stand: 'code', fout: boolean, over: number }
  | { stand: DichtStand, op: string }
  | { stand: 'open', inhoud: ExternInhoud }

/** Een link die dicht is: sinds wanneer. Meer niet, ook niet voor wie hij was. */
export const dichtAntwoord = (link: Pick<Deellink, 'geldig_tot' | 'gesloten_op'>, stand: DichtStand): ExternAntwoord =>
  ({ stand, op: stand === 'verlopen' ? link.geldig_tot : link.gesloten_op ?? new Date().toISOString() })

/**
 * De code bij een open link: wat er in de link verandert, en het antwoord als de pagina niet open mag.
 * Zonder code telt het niet als poging. Na tien verkeerde codes op rij gaat de link dicht.
 */
export function controleerCode(link: Pick<Deellink, 'foute_pogingen'>, code: string, klopt: boolean, nu: Date): { wijziging: Partial<Deellink> | null, antwoord: ExternAntwoord | null } {
  if (!code) return { wijziging: null, antwoord: { stand: 'code', fout: false, over: MAX_POGINGEN - link.foute_pogingen } }
  if (klopt) return { wijziging: { foute_pogingen: 0, bekeken_op: nu.toISOString() }, antwoord: null }
  const pogingen = link.foute_pogingen + 1
  if (pogingen >= MAX_POGINGEN) {
    return { wijziging: { foute_pogingen: pogingen, gesloten_reden: 'geblokkeerd', gesloten_op: nu.toISOString() }, antwoord: { stand: 'geblokkeerd', op: nu.toISOString() } }
  }
  return { wijziging: { foute_pogingen: pogingen }, antwoord: { stand: 'code', fout: true, over: MAX_POGINGEN - pogingen } }
}

/** De open punten van één leverancier. */
export const openPuntenVan = (leverancierId: string, punten: Controlepunt[]) => punten.filter(p => p.leverancier_id === leverancierId && !p.opgelost)

/**
 * Wat de leverancier te zien krijgt: alleen zijn open punten, de projecten waarop die staan en de tekeningen
 * met een plek van zo'n punt. `punten` zijn alle punten van die projecten, voor de nummers zoals bij BbDW.
 */
export function externeInhoud(a: {
  link: Pick<Deellink, 'leverancier_id' | 'geldig_tot' | 'aangemaakt_door'>
  leverancier: Pick<Leverancier, 'naam' | 'vak'>
  punten: Controlepunt[]
  projecten: ExternProject[]
  tekeningen: ExternTekening[]
  fotoUrl: (pad: string) => string | null
}): ExternInhoud {
  const nummers = nummerPerProject(a.punten)
  const eigen = openPuntenVan(a.link.leverancier_id, a.punten)
  const projectIds = new Set(eigen.map(p => p.project_id))
  const tekeningIds = new Set(eigen.map(p => p.tekening_id).filter(Boolean))
  return {
    leverancier: { naam: a.leverancier.naam, vak: a.leverancier.vak },
    geldig_tot: a.link.geldig_tot,
    gedeeld_door: a.link.aangemaakt_door,
    projecten: a.projecten.filter(p => projectIds.has(p.id))
      .map(p => ({ id: p.id, naam: p.naam, plaats: p.plaats, adres: p.adres }))
      .sort((x, y) => x.naam.localeCompare(y.naam, 'nl')),
    punten: eigen.map(p => ({
      id: p.id, project_id: p.project_id, nummer: nummers.get(p.id)!, notitie: p.notitie, aangemaakt_op: p.aangemaakt_op, foto: a.fotoUrl(p.foto),
      tekening_id: p.tekening_id, tekening_blad: p.tekening_blad, tekening_x: p.tekening_x, tekening_y: p.tekening_y,
    })).sort((x, y) => x.nummer - y.nummer),
    tekeningen: a.tekeningen.filter(t => tekeningIds.has(t.id)).map(t => ({ id: t.id, project_id: t.project_id, naam: t.naam })),
  }
}

// ---------- proefversie: een kopie op de server, zodat de link ook op een ander apparaat werkt ----------
// In de proefversie staan de gegevens in de browser van de tester. Bij een link stuurt die browser een kopie van wat
// de leverancier mag zien naar de server (tabel proef_deellinks), en werkt hem bij als er iets verandert. De server
// controleert de code en houdt bij wanneer er is gekeken; dat komt terug naar de tester.

export const VOORBEELDFOTO_URL = '/voorbeeld-aandachtspunt.jpg'
export const VOORBEELDTEKENING_URL = '/voorbeeld-tekening.pdf'
/** Een tekening-id komt in een pad in de opslag: alleen letters, cijfers, - en _. */
export const TEKENING_ID_VORM = /^[\w-]{1,100}$/

/** Wat de browser van een tester naar de server stuurt. inhoud null: alleen de stand bijwerken en ophalen. */
export interface ProefLink {
  token: string
  code: string
  geldig_tot: string
  gesloten_reden: DeellinkReden | null
  gesloten_op: string | null
  inhoud: ExternInhoud | null
  /** De tekeningen die de openbare voorbeeldtekening zijn; de rest uploadt de tester. */
  voorbeeld_tekeningen: string[]
}
/** Wat alleen de server weet: of er is gekeken, verkeerde codes, en of hij daar dicht ging. */
export type ProefStand = Pick<Deellink, 'token' | 'gesloten_reden' | 'gesloten_op' | 'foute_pogingen' | 'bekeken_op'>

type Los = Record<string, unknown>
const isLos = (v: unknown): v is Los => !!v && typeof v === 'object' && !Array.isArray(v)
const tekst = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null)
const moment = (v: unknown) => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null)
const fractie = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : null)
const foto = (v: unknown) => (v === VOORBEELDFOTO_URL || (typeof v === 'string' && v.length < 2_000_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(v)) ? v : null)
const REDENEN: DeellinkReden[] = ['opgelost', 'ingetrokken', 'geblokkeerd']

/** De inhoud zoals een tester hem stuurt, nagelopen en zonder extra velden; null als er iets niet klopt. */
export function schoneInhoud(x: unknown): ExternInhoud | null {
  if (!isLos(x) || !isLos(x.leverancier) || !Array.isArray(x.projecten) || !Array.isArray(x.punten) || !Array.isArray(x.tekeningen)) return null
  if (x.projecten.length > 100 || x.punten.length > 300 || x.tekeningen.length > 50) return null
  const naam = tekst(x.leverancier.naam, 200)
  const geldig = moment(x.geldig_tot)
  if (!naam || !geldig) return null
  const projecten: ExternProject[] = []
  for (const p of x.projecten) {
    if (!isLos(p) || !tekst(p.id, 100) || !tekst(p.naam, 200)) return null
    projecten.push({ id: p.id as string, naam: p.naam as string, plaats: tekst(p.plaats, 200), adres: tekst(p.adres, 300) })
  }
  const tekeningen: ExternTekening[] = []
  for (const t of x.tekeningen) {
    if (!isLos(t) || typeof t.id !== 'string' || !TEKENING_ID_VORM.test(t.id) || !projecten.some(p => p.id === t.project_id) || !tekst(t.naam, 200)) return null
    tekeningen.push({ id: t.id, project_id: t.project_id as string, naam: t.naam as string })
  }
  const punten: ExternPunt[] = []
  for (const p of x.punten) {
    if (!isLos(p) || !tekst(p.id, 100) || !projecten.some(q => q.id === p.project_id) || !tekst(p.notitie, 4000) || !moment(p.aangemaakt_op)) return null
    if (typeof p.nummer !== 'number' || !Number.isInteger(p.nummer) || p.nummer < 1) return null
    const t = tekeningen.find(t => t.id === p.tekening_id && t.project_id === p.project_id)
    const blad = typeof p.tekening_blad === 'number' && Number.isInteger(p.tekening_blad) && p.tekening_blad >= 1 ? p.tekening_blad : null
    const tx = fractie(p.tekening_x), ty = fractie(p.tekening_y)
    const plek = t && blad && tx !== null && ty !== null
    punten.push({
      id: p.id as string, project_id: p.project_id as string, nummer: p.nummer, notitie: p.notitie as string, aangemaakt_op: p.aangemaakt_op as string, foto: foto(p.foto),
      tekening_id: plek ? t.id : null, tekening_blad: plek ? blad : null, tekening_x: plek ? tx : null, tekening_y: plek ? ty : null,
    })
  }
  return {
    leverancier: { naam, vak: tekst(x.leverancier.vak, 200) },
    geldig_tot: geldig,
    gedeeld_door: tekst(x.gedeeld_door, 200),
    projecten, punten, tekeningen,
  }
}

/** Een link zoals een tester hem stuurt, nagelopen; null als er iets niet klopt. */
export function schoneProefLink(x: unknown): ProefLink | null {
  if (!isLos(x) || typeof x.token !== 'string' || !TOKEN_VORM.test(x.token) || typeof x.code !== 'string' || !CODE_VORM.test(x.code)) return null
  const geldig = moment(x.geldig_tot)
  const reden = x.gesloten_reden == null ? null : REDENEN.find(r => r === x.gesloten_reden)
  if (!geldig || reden === undefined) return null
  const inhoud = x.inhoud == null ? null : schoneInhoud(x.inhoud)
  if (x.inhoud != null && !inhoud) return null
  const voorbeeld = Array.isArray(x.voorbeeld_tekeningen) ? x.voorbeeld_tekeningen.filter((v): v is string => typeof v === 'string' && TEKENING_ID_VORM.test(v)).slice(0, 50) : []
  return { token: x.token, code: x.code, geldig_tot: geldig, gesloten_reden: reden, gesloten_op: reden ? moment(x.gesloten_op) ?? new Date().toISOString() : null, inhoud, voorbeeld_tekeningen: voorbeeld }
}

/** De stand van de server bij de link van de tester: gekeken en pogingen van de server; dicht blijft dicht, aan beide kanten. */
export function metProefStand(link: Deellink, s: ProefStand): Deellink {
  const dicht = !link.gesloten_reden && s.gesloten_reden ? { gesloten_reden: s.gesloten_reden, gesloten_op: s.gesloten_op, gesloten_door: 'systeem' } : {}
  return { ...link, foute_pogingen: s.foute_pogingen, bekeken_op: s.bekeken_op, ...dicht, op_server: true }
}
