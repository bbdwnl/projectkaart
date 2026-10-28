import type { Controlepunt, Deellink, DeellinkReden, Leverancier, PlekVeld, Project, Tekening } from './types'
import { nummerPerProject } from './controle'
import { fmt } from './datum'
import { adresRegel, type AdresVelden } from './adres'

// Delen met een leverancier: een link naar een eigen pagina met alleen zijn open aandachtspunten, achter een code
// van vijf cijfers. De server (server/api/punten) en de app gebruiken dezelfde regels.
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

/** Een open punt zoals de leverancier het ziet: met zijn eigen melding, en een afkeuring van BbDW met de reden. */
export type ExternPunt = Pick<Controlepunt, 'id' | 'project_id' | 'notitie' | 'aangemaakt_op' | PlekVeld | 'gereed_op' | 'afgekeurd_op' | 'afgekeurd_reden'> & {
  /** Zoals op de tekening en in de lijsten bij BbDW. */
  nummer: number
  /** Een tijdelijk adres van de foto. */
  foto: string | null
}
/** adres: de hele regel, zie adresRegel. */
export type ExternProject = Pick<Project, 'id' | 'naam' | 'plaats'> & { adres: string | null }
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
  projecten: (Pick<Project, 'id' | 'naam'> & AdresVelden)[]
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
      .map(p => ({ id: p.id, naam: p.naam, plaats: p.plaats, adres: adresRegel(p) }))
      .sort((x, y) => x.naam.localeCompare(y.naam, 'nl')),
    punten: eigen.map(p => ({
      id: p.id, project_id: p.project_id, nummer: nummers.get(p.id)!, notitie: p.notitie, aangemaakt_op: p.aangemaakt_op, foto: a.fotoUrl(p.foto),
      tekening_id: p.tekening_id, tekening_blad: p.tekening_blad, tekening_x: p.tekening_x, tekening_y: p.tekening_y,
      gereed_op: p.gereed_op ?? null, afgekeurd_op: p.afgekeurd_op ?? null, afgekeurd_reden: p.afgekeurd_reden ?? null,
    })).sort((x, y) => x.nummer - y.nummer),
    tekeningen: a.tekeningen.filter(t => tekeningIds.has(t.id)).map(t => ({ id: t.id, project_id: t.project_id, naam: t.naam })),
  }
}
