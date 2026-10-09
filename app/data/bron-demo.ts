import type { Bron, NieuwControlepunt, NieuweUitzondering } from './bron'
import { BronFout } from './bron'
import { LEGE_GEGEVENS, type DemoGegevens } from './demo'
import { leegTaak } from '~/lib/taak'
import { leegProject } from '~/lib/leads'
import type { Controlepunt, Fase, LogRegel, Project, ProjectWijziging, Taak, TaakWijziging } from '~/lib/types'
import { fotoPad } from '~/lib/controle'
import { naarDataUrl, verkleinFoto } from '~/utils/foto'

// Dezelfde velden als de logboektriggers in de migratie.
const PROJECT_VELDEN = ['fase', 'prio', 'nummer', 'afas_nummer', 'naam', 'adres', 'm2', 'soort', 'slagingskans', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie'] as const
const TAAK_VELDEN = ['status', 'eigenaar', 'klantakkoord', 'document_url', 'document_naam', 'reden_nvt', 'deadline', 'notitie', 'aanleiding'] as const

const kopie = <T>(o: T): T => JSON.parse(JSON.stringify(o))
const alsTekst = (v: unknown): string | null => v === null || v === undefined ? null : Array.isArray(v) ? `{${v.join(',')}}` : String(v)
const wacht = () => new Promise(r => setTimeout(r, 120)) // voelt als een echte opslag

function laad(opslag: string): DemoGegevens | null {
  try {
    const s = localStorage.getItem(opslag)
    const d = s ? JSON.parse(s) as DemoGegevens : null
    return d && Array.isArray(d.projecten) && Array.isArray(d.taken) && Array.isArray(d.controlepunten) ? d : null
  } catch {
    return null
  }
}

/** Waar de proefversie de gegevens van een tester bewaart. Verhoog de versie als de vorm verandert. */
export const PROEF_OPSLAG = 'projectkaart_proefgegevens_v2'

export function wisProefgegevens() {
  try { localStorage.removeItem(PROEF_OPSLAG) } catch { /* niets te wissen */ }
}

/** Gooit de gegevens van oudere versies weg: de foto's onder Controle hebben de ruimte nodig. */
function ruimOudeVersiesOp() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('projectkaart_proefgegevens_') && k !== PROEF_OPSLAG) localStorage.removeItem(k)
  } catch { /* geen opslag */ }
}

/**
 * Voorbeeldgegevens in het geheugen. `gegevens` komen van de server (alleen met toegang).
 * Met `opslag` blijven de wijzigingen van een tester bewaard in zijn eigen browser
 * (localStorage); anderen zien ze niet. Zonder toegang: een lege bron.
 */
export function maakDemoBron({ door = 'Demo', opslag, gegevens }: { door?: string, opslag?: string, gegevens: DemoGegevens | null }): Bron {
  if (opslag) ruimOudeVersiesOp()
  const db = gegevens ? (opslag && laad(opslag)) || gegevens : LEGE_GEGEVENS()
  let teller = 0
  const nieuwId = (soort: string) => `${soort}-demo-${Date.now().toString(36)}-${++teller}`
  /** false: de opslag van de browser is vol of geblokkeerd; dan staat het alleen in het geheugen. */
  function bewaar(): boolean {
    if (!opslag) return true
    try {
      localStorage.setItem(opslag, JSON.stringify(db))
      return true
    } catch {
      return false
    }
  }

  function log(regel: Omit<LogRegel, 'id' | 'op' | 'door'>) {
    db.logboek.unshift({ ...regel, id: nieuwId('l'), op: new Date().toISOString(), door })
  }
  function logTaak(oud: Partial<Taak>, nieuw: Taak) {
    for (const v of TAAK_VELDEN) {
      const a = alsTekst(oud[v]), b = alsTekst(nieuw[v])
      if (a === b) continue
      if (!oud.id && (b === null || b === 'false' || b === 'niet_gestart')) continue
      log({ project_id: nieuw.project_id, tabel: 'taken', taak_id: nieuw.id, lijst: nieuw.lijst, sleutel: nieuw.sleutel, uitzondering_id: nieuw.uitzondering_id, veld: v, oud: a, nieuw: b })
    }
  }
  function pasToe(t: Taak, w: TaakWijziging) {
    const oud = kopie(t)
    Object.assign(t, w)
    const nu = new Date().toISOString()
    if (t.status === 'definitief' && oud.status !== 'definitief') { t.afgetekend_door = door; t.afgetekend_op = nu }
    if (t.status !== 'definitief') { t.afgetekend_door = null; t.afgetekend_op = null }
    if (t.klantakkoord && !oud.klantakkoord) { t.klantakkoord_door = door; t.klantakkoord_op = nu }
    if (!t.klantakkoord) { t.klantakkoord_door = null; t.klantakkoord_op = null }
    t.gewijzigd_op = nu
    t.gewijzigd_door = door
    return oud
  }
  const projectVan = (id: string) => {
    const p = db.projecten.find(x => x.id === id)
    if (!p) throw new BronFout('Dit project bestaat niet (meer).')
    return p
  }

  return {
    modus: 'demo',
    async projecten() { return kopie(db.projecten) },
    async project(slug) { return kopie(db.projecten.find(p => p.slug === slug) ?? null) },
    async taken(projectId) { return kopie(projectId ? db.taken.filter(t => t.project_id === projectId) : db.taken) },
    async uitzonderingen() { return kopie(db.uitzonderingen) },
    async financien(projectId) { return kopie(db.financien.find(f => f.project_id === projectId) ?? null) },
    async logboek(projectId, limiet = 40) { return kopie(db.logboek.filter(l => l.project_id === projectId).slice(0, limiet)) },

    async bewaarProject(id, wijziging: ProjectWijziging) {
      await wacht()
      const p = projectVan(id)
      const oud = kopie(p)
      Object.assign(p, wijziging, { gewijzigd_op: new Date().toISOString() })
      for (const v of PROJECT_VELDEN) {
        const a = alsTekst(oud[v as keyof Project]), b = alsTekst(p[v as keyof Project])
        if (a !== b) log({ project_id: id, tabel: 'projecten', taak_id: null, lijst: null, sleutel: null, uitzondering_id: null, veld: v, oud: a, nieuw: b })
      }
      bewaar()
      return kopie(p)
    },

    async nieuweLead(invoer) {
      await wacht()
      if (db.projecten.some(p => p.slug === invoer.slug)) throw new BronFout('Er bestaat al een project met deze naam. Kies een andere naam.')
      const p = leegProject({ ...invoer, id: nieuwId('p'), fase: 'lead', gewijzigd_op: new Date().toISOString() })
      db.projecten.push(p)
      bewaar()
      return kopie(p)
    },

    async bewaarStandaardtaak(projectId, lijst: Fase, sleutel, wijziging) {
      await wacht()
      let t = db.taken.find(x => x.project_id === projectId && x.lijst === lijst && x.sleutel === sleutel)
      if (!t) {
        t = leegTaak({ id: nieuwId('t'), project_id: projectId, fase: lijst, lijst, sleutel })
        db.taken.push(t)
        pasToe(t, wijziging)
        logTaak({}, t)
      } else {
        logTaak(pasToe(t, wijziging), t)
      }
      bewaar()
      return kopie(t)
    },

    async bewaarTaak(taakId, wijziging) {
      await wacht()
      const t = db.taken.find(x => x.id === taakId)
      if (!t) throw new BronFout('Deze taak bestaat niet (meer).')
      logTaak(pasToe(t, wijziging), t)
      bewaar()
      return kopie(t)
    },

    async voegUitzonderingToe(projectId, invoer: NieuweUitzondering) {
      await wacht()
      let u = invoer.uitzonderingId ? db.uitzonderingen.find(x => x.id === invoer.uitzonderingId) : undefined
      if (!u && invoer.nieuweTitel) {
        const titel = invoer.nieuweTitel.trim()
        u = db.uitzonderingen.find(x => x.titel.toLowerCase() === titel.toLowerCase())
        if (!u) {
          u = { id: nieuwId('u'), titel, fase: invoer.fase, status: 'uitzondering', aangemaakt_op: new Date().toISOString() }
          db.uitzonderingen.push(u)
        }
      }
      if (!u) throw new BronFout('Kies een uitzondering of typ een nieuwe.')
      if (db.taken.some(t => t.project_id === projectId && t.uitzondering_id === u!.id)) throw new BronFout('Deze uitzondering staat al in dit project.')
      const t = leegTaak({ id: nieuwId('t'), project_id: projectId, fase: invoer.fase, uitzondering_id: u.id, deadline: invoer.deadline })
      db.taken.push(t)
      log({ project_id: projectId, tabel: 'taken', taak_id: t.id, lijst: null, sleutel: null, uitzondering_id: u.id, veld: 'toegevoegd', oud: null, nieuw: null })
      bewaar()
      return { taak: kopie(t), uitzondering: kopie(u) }
    },

    async verwijderTaak(taakId) {
      await wacht()
      const i = db.taken.findIndex(t => t.id === taakId)
      if (i < 0) return
      const [t] = db.taken.splice(i, 1)
      if (t!.uitzondering_id) log({ project_id: t!.project_id, tabel: 'taken', taak_id: t!.id, lijst: null, sleutel: null, uitzondering_id: t!.uitzondering_id, veld: 'verwijderd', oud: null, nieuw: null })
      bewaar()
    },

    async zetUitzonderingStatus(id, status) {
      await wacht()
      const u = db.uitzonderingen.find(x => x.id === id)
      if (u) u.status = status
      bewaar()
    },

    async leveranciers(projectId) {
      return kopie(db.leveranciers.filter(l => l.project_id === projectId).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))
    },
    async voegLeverancierToe(projectId, invoer) {
      await wacht()
      const naam = invoer.naam.trim()
      if (naam.length < 2) throw new BronFout('Geef de leverancier een naam van minstens twee letters.')
      if (db.leveranciers.some(l => l.project_id === projectId && l.naam.toLowerCase() === naam.toLowerCase())) throw new BronFout(`${naam} staat al bij de leveranciers.`)
      const l = { id: nieuwId('lev'), project_id: projectId, naam, vak: invoer.vak }
      db.leveranciers.push(l)
      bewaar()
      return kopie(l)
    },
    async verwijderLeverancier(id) {
      await wacht()
      if (db.controlepunten.some(p => p.leverancier_id === id)) throw new BronFout('Deze leverancier heeft aandachtspunten onder Controle. Haal die eerst weg.')
      db.leveranciers = db.leveranciers.filter(l => l.id !== id)
      bewaar()
    },
    async controlepunten(projectId) {
      return kopie(db.controlepunten.filter(p => p.project_id === projectId))
    },
    async fotoUrls(paden) {
      return Object.fromEntries(paden.filter(p => db.fotos[p]).map(p => [p, db.fotos[p]!]))
    },
    async voegControlepuntToe(projectId, invoer: NieuwControlepunt) {
      if (!db.leveranciers.some(l => l.id === invoer.leverancierId && l.project_id === projectId)) throw new BronFout('Kies een leverancier van dit project.')
      const id = nieuwId('c')
      const foto = fotoPad(projectId, id)
      // Kleiner dan in het echt: alles staat in de opslag van de browser, en die is maar een paar MB.
      db.fotos[foto] = await naarDataUrl(await verkleinFoto(invoer.foto, 1024, 0.7))
      const p: Controlepunt = {
        id, project_id: projectId, leverancier_id: invoer.leverancierId, notitie: invoer.notitie, foto, opgelost: false,
        opgelost_door: null, opgelost_op: null, aangemaakt_door: door, aangemaakt_op: new Date().toISOString(),
      }
      db.controlepunten.push(p)
      if (!bewaar()) {
        db.controlepunten.pop()
        delete db.fotos[foto]
        throw new BronFout('De opslag van deze browser is vol. Haal een paar aandachtspunten weg, of begin opnieuw met de voorbeeldgegevens.')
      }
      return kopie(p)
    },
    async zetOpgelost(id, opgelost) {
      await wacht()
      const p = db.controlepunten.find(x => x.id === id)
      if (!p) throw new BronFout('Dit aandachtspunt bestaat niet (meer).')
      if (opgelost !== p.opgelost) Object.assign(p, { opgelost, opgelost_door: opgelost ? door : null, opgelost_op: opgelost ? new Date().toISOString() : null })
      bewaar()
      return kopie(p)
    },
    async verwijderControlepunt(punt) {
      await wacht()
      db.controlepunten = db.controlepunten.filter(p => p.id !== punt.id)
      delete db.fotos[punt.foto]
      bewaar()
    },
  }
}
