import type { Bron, NieuwControlepunt, NieuweUitzondering } from './bron'
import { BronFout } from './bron'
import { LEGE_GEGEVENS, type DemoGegevens } from './demo'
import { leegTaak } from '~/lib/taak'
import { leegProject } from '~/lib/leads'
import { GEEN_PLEK, type Controlepunt, type Deellink, type DeellinkReden, type Fase, type LogRegel, type Project, type ProjectWijziging, type Taak, type TaakWijziging, type Tekening } from '~/lib/types'
import { bewaarBestand, leesBestand, wisAlleBestanden, wisBestand } from './demo-bestanden'
import { VOORBEELDTEKENING } from './demo'
import { fotoPad } from '~/lib/controle'
import { controleerCode, dichtAntwoord, externeInhoud, metProefStand, nieuweCode, nieuwToken, openPuntenVan, standVan, type ExternAntwoord } from '~/lib/deellink'
import type { ProefServer } from './proef-server'
import { plusMaand } from '~/lib/datum'
import { naarDataUrl, verkleinFoto } from '~/utils/foto'

// Dezelfde velden als de logboektriggers in de migratie.
const PROJECT_VELDEN = ['fase', 'prio', 'nummer', 'afas_nummer', 'naam', 'adres', 'm2', 'soort', 'slagingskans', 'am', 'po', 'pm', 'opzichter',
  'datum_casco', 'datum_voorbereiding', 'datum_inkoop', 'datum_afbouw', 'datum_oplevering',
  'sharepoint_url', 'extern_url', 'notitieblok_url', 'tekeningen_locatie'] as const
const TAAK_VELDEN = ['status', 'eigenaar', 'klantakkoord', 'document_url', 'document_naam', 'reden_nvt', 'deadline', 'notitie', 'aanleiding'] as const

const kopie = <T>(o: T): T => JSON.parse(JSON.stringify(o))
const alsTekst = (v: unknown): string | null => v === null || v === undefined ? null : Array.isArray(v) ? `{${v.join(',')}}` : String(v)
const wacht = () => new Promise(r => setTimeout(r, 120)) // voelt als een echte opslag
const willekeurig = (n: number) => crypto.getRandomValues(new Uint8Array(n))

function laad(opslag: string): DemoGegevens | null {
  try {
    const s = localStorage.getItem(opslag)
    const d = s ? JSON.parse(s) as DemoGegevens : null
    if (!(d && Array.isArray(d.projecten) && Array.isArray(d.taken) && Array.isArray(d.controlepunten) && Array.isArray(d.projectLeveranciers) && Array.isArray(d.tekeningen))) return null
    d.deellinks ??= [] // bewaard vóór er deellinks waren: de wijzigingen van de tester blijven staan
    return d
  } catch {
    return null
  }
}

/** Waar de proefversie de gegevens van een tester bewaart. Verhoog de versie als de vorm verandert. */
export const PROEF_OPSLAG = 'projectkaart_proefgegevens_v5'

export function wisProefgegevens() {
  try { localStorage.removeItem(PROEF_OPSLAG) } catch { /* niets te wissen */ }
}
/** Ook de geüploade tekeningen van de tester weggooien. */
export const wisProefbestanden = () => wisAlleBestanden().catch(() => undefined)

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
 * `door` staat in het logboek ("Jij"); `naam` is wie een leverancier op zijn pagina als aanspreekpunt ziet.
 * Met `server` werken de links voor leveranciers ook op een ander apparaat: daar staat een kopie (proef-server.ts).
 */
export function maakDemoBron({ door = 'Demo', naam = door, opslag, gegevens, server }: { door?: string, naam?: string, opslag?: string, gegevens: DemoGegevens | null, server?: ProefServer }): Bron {
  if (opslag) ruimOudeVersiesOp()
  const db = gegevens ? (opslag && laad(opslag)) || gegevens : LEGE_GEGEVENS()
  let teller = 0
  const nieuwId = (soort: string) => `${soort}-demo-${Date.now().toString(36)}-${++teller}`
  /** false: de opslag van de browser is vol of geblokkeerd; dan staat het alleen in het geheugen. */
  function bewaar(metServer = true): boolean {
    if (metServer) planNaarServer()
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
  /** Zoals de trigger in de database: geen open punten meer voor deze leverancier, dan gaan zijn links dicht. */
  function sluitAlsOpgelost(leverancierId: string | null) {
    if (!leverancierId || openPuntenVan(leverancierId, db.controlepunten).length) return
    for (const l of db.deellinks) if (l.leverancier_id === leverancierId && standVan(l, new Date()) === 'open') sluit(l, 'opgelost')
  }
  function sluit(l: Deellink, reden: DeellinkReden, wie: string | null = door) {
    Object.assign(l, { gesloten_reden: reden, gesloten_op: new Date().toISOString(), gesloten_door: wie })
  }
  /** Zoals de server: de link zoeken en de code controleren. Een verkeerde code telt. */
  function poort(token: string, code: string): { link: Deellink } | { antwoord: ExternAntwoord } {
    const link = db.deellinks.find(l => l.token === token)
    if (!link) return { antwoord: { stand: 'onbekend' } }
    const nu = new Date()
    const stand = standVan(link, nu)
    if (stand !== 'open') return { antwoord: dichtAntwoord(link, stand) }
    const { wijziging, antwoord } = controleerCode(link, code, code === link.code, nu)
    if (wijziging) {
      Object.assign(link, wijziging, wijziging.gesloten_reden ? { gesloten_door: 'systeem' } : {})
      bewaar()
    }
    return antwoord ? { antwoord } : { link }
  }
  /** Waar de viewer een tekening ophaalt: de voorbeeldtekening, of de pdf van de tester uit IndexedDB. */
  async function pdfUrl(tekening: Tekening): Promise<string> {
    if (tekening.pad === VOORBEELDTEKENING) return '/voorbeeld-tekening.pdf'
    const bestand = await leesBestand(tekening.pad).catch(() => null)
    if (!bestand) throw new BronFout('Deze tekening staat alleen in de browser waarin hij is geüpload (proefversie).')
    return URL.createObjectURL(bestand)
  }
  /** Wat de leverancier van deze link ziet. */
  function inhoudVan(link: Deellink, fotoUrl: (pad: string) => string | null) {
    const leverancier = db.leveranciers.find(l => l.id === link.leverancier_id)
    const projectIds = new Set(openPuntenVan(link.leverancier_id, db.controlepunten).map(p => p.project_id))
    if (!leverancier || !projectIds.size) return null
    return externeInhoud({
      link, leverancier,
      punten: db.controlepunten.filter(p => projectIds.has(p.project_id)),
      projecten: db.projecten.filter(p => projectIds.has(p.id)),
      tekeningen: db.tekeningen.filter(t => projectIds.has(t.project_id)),
      fotoUrl,
    })
  }

  // ---------- de links ook op een ander apparaat: een kopie op de server ----------
  /** Wat er per link het laatst naar de server ging (in dit venster), zodat niets dubbel gaat. */
  const verzonden = new Map<string, string>()
  /**
   * Zet de links op de server of werkt ze bij: alleen wat veranderde, of met `alles` elke link (dan komt ook terug
   * of de leverancier keek). Lukt het niet, dan werkt de link alleen in deze browser; de volgende keer opnieuw.
   */
  async function naarServer(alles = false) {
    if (!server) return
    const nu = new Date()
    const voorbeeld = db.tekeningen.filter(t => t.pad === VOORBEELDTEKENING).map(t => t.id)
    let gewijzigd = false
    for (const link of db.deellinks.filter(l => standVan(l, nu) !== 'verlopen')) {
      const open = !link.gesloten_reden
      // De vingerafdruk met de paden van de foto's in plaats van de foto's zelf.
      const afdruk = `${link.gesloten_reden ?? ''}|${JSON.stringify(open ? inhoudVan(link, pad => pad) : null)}`
      const veranderd = verzonden.get(link.token) !== afdruk
      if (!veranderd && !alles) continue
      if (!open && !link.op_server) continue // nooit op de server gezet: daar hoeft hij ook niet dicht
      const metInhoud = open && (veranderd || !link.op_server)
      try {
        const [stand] = await server.bewaar({
          token: link.token, code: link.code, geldig_tot: link.geldig_tot, gesloten_reden: link.gesloten_reden, gesloten_op: link.gesloten_op,
          inhoud: metInhoud ? inhoudVan(link, pad => db.fotos[pad] ?? null) : null,
          voorbeeld_tekeningen: voorbeeld,
        })
        verzonden.set(link.token, afdruk)
        if (stand) Object.assign(link, metProefStand(link, stand))
        else link.op_server = false
        if (stand && metInhoud) await uploadTekeningen(link)
      } catch {
        link.op_server = false
      }
      gewijzigd = true
    }
    if (gewijzigd) bewaar(false)
  }
  /** Eigen tekeningen van de tester met een punt van deze link: één keer naar de server, voor de leverancier. */
  async function uploadTekeningen(link: Deellink) {
    const ids = new Set(openPuntenVan(link.leverancier_id, db.controlepunten).map(p => p.tekening_id))
    db.proefUploads ??= []
    for (const t of db.tekeningen.filter(t => ids.has(t.id) && t.pad !== VOORBEELDTEKENING)) {
      const sleutel = `${link.token}/${t.id}`
      if (db.proefUploads.includes(sleutel)) continue
      const pdf = await leesBestand(t.pad).catch(() => null)
      if (!pdf) continue
      try {
        await server!.uploadTekening(link.token, t.id, pdf)
        db.proefUploads.push(sleutel)
      } catch { /* de volgende keer opnieuw */ }
    }
  }
  let wachtrij: Promise<void> = Promise.resolve()
  let gepland: ReturnType<typeof setTimeout> | undefined
  /** Na elke wijziging, even later en één tegelijk. */
  function planNaarServer() {
    if (!server || !db.deellinks.length) return
    clearTimeout(gepland)
    gepland = setTimeout(() => naarServerNu(), 400)
  }
  const naarServerNu = (alles = false) => (wachtrij = wachtrij.then(() => naarServer(alles)).catch(() => undefined))

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
      if (invoer.afas_nummer && db.projecten.some(p => p.afas_nummer === invoer.afas_nummer)) throw new BronFout(`Er is al een project met AFAS-nummer ${invoer.afas_nummer}.`)
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

    async tekeningen(projectId) {
      return kopie(projectId ? db.tekeningen.filter(t => t.project_id === projectId) : db.tekeningen)
    },
    async uploadTekening(projectId, bestand, naam) {
      const id = nieuwId('tek')
      const t: Tekening = { id, project_id: projectId, naam, pad: `${projectId}/${id}.pdf`, aangemaakt_door: door, aangemaakt_op: new Date().toISOString() }
      try {
        await bewaarBestand(t.pad, bestand)
      } catch {
        throw new BronFout('Deze browser kan de tekening niet bewaren (geen ruimte, of privévenster).')
      }
      db.tekeningen.push(t)
      bewaar()
      return kopie(t)
    },
    async hernoemTekening(id, naam) {
      await wacht()
      const t = db.tekeningen.find(x => x.id === id)
      if (!t) throw new BronFout('Deze tekening bestaat niet (meer).')
      t.naam = naam
      bewaar()
      return kopie(t)
    },
    async verwijderTekening(tekening) {
      await wacht()
      if (db.controlepunten.some(p => p.tekening_id === tekening.id)) throw new BronFout('Er staan aandachtspunten op deze tekening. Haal eerst hun plek weg of kies een andere tekening.')
      db.tekeningen = db.tekeningen.filter(t => t.id !== tekening.id)
      if (tekening.pad !== VOORBEELDTEKENING) await wisBestand(tekening.pad).catch(() => undefined)
      bewaar()
    },
    async tekeningUrl(tekening) {
      return pdfUrl(tekening)
    },

    async leveranciers(projectId) {
      const opNaam = (ls: typeof db.leveranciers) => kopie(ls).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
      if (!projectId) return opNaam(db.leveranciers)
      const ids = new Set(db.projectLeveranciers.filter(k => k.project_id === projectId).map(k => k.leverancier_id))
      return opNaam(db.leveranciers.filter(l => ids.has(l.id)))
    },
    async globaleLeveranciers() {
      return kopie(db.leveranciers.filter(l => l.globaal).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))
    },
    async koppelingen() {
      return kopie(db.projectLeveranciers)
    },
    async nieuweLeverancier(projectId, invoer) {
      await wacht()
      const naam = invoer.naam.trim()
      if (naam.length < 2) throw new BronFout('Geef de leverancier een naam van minstens twee letters.')
      if (invoer.globaal && db.leveranciers.some(l => l.globaal && l.naam.toLowerCase() === naam.toLowerCase())) throw new BronFout(`${naam} staat al in de globale lijst. Kies hem daar.`)
      const l = { id: nieuwId('lev'), naam, vak: invoer.vak, globaal: invoer.globaal }
      db.leveranciers.push(l)
      if (projectId) db.projectLeveranciers.push({ project_id: projectId, leverancier_id: l.id })
      bewaar()
      return kopie(l)
    },
    async koppelLeverancier(projectId, leverancierId) {
      await wacht()
      if (db.projectLeveranciers.some(k => k.project_id === projectId && k.leverancier_id === leverancierId)) throw new BronFout('Deze leverancier staat al bij dit project.')
      db.projectLeveranciers.push({ project_id: projectId, leverancier_id: leverancierId })
      bewaar()
    },
    async ontkoppelLeverancier(projectId, leverancier) {
      await wacht()
      if (db.controlepunten.some(p => p.project_id === projectId && p.leverancier_id === leverancier.id)) {
        throw new BronFout('Deze leverancier heeft aandachtspunten onder Controle. Haal die eerst weg, of kies er een andere leverancier bij.')
      }
      db.projectLeveranciers = db.projectLeveranciers.filter(k => !(k.project_id === projectId && k.leverancier_id === leverancier.id))
      if (!leverancier.globaal && !db.projectLeveranciers.some(k => k.leverancier_id === leverancier.id)) {
        db.leveranciers = db.leveranciers.filter(l => l.id !== leverancier.id)
      }
      bewaar()
    },
    async wijzigLeverancier(id, w) {
      await wacht()
      const l = db.leveranciers.find(x => x.id === id)
      if (!l) throw new BronFout('Deze leverancier bestaat niet (meer).')
      const nieuw = { ...l, ...w }
      if (nieuw.naam.trim().length < 2) throw new BronFout('Geef de leverancier een naam van minstens twee letters.')
      if (nieuw.globaal && db.leveranciers.some(x => x !== l && x.globaal && x.naam.trim().toLowerCase() === nieuw.naam.trim().toLowerCase())) {
        throw new BronFout('Er staat al een leverancier met deze naam in de globale lijst.')
      }
      Object.assign(l, w)
      bewaar()
      return kopie(l)
    },
    async verwijderLeverancier(id) {
      await wacht()
      if (db.projectLeveranciers.some(k => k.leverancier_id === id)) throw new BronFout('Deze leverancier staat nog op een project. Haal hem alleen uit de globale lijst, of eerst van die projecten af.')
      db.leveranciers = db.leveranciers.filter(l => l.id !== id)
      bewaar()
    },
    async controlepunten(projectId) {
      return kopie(projectId ? db.controlepunten.filter(p => p.project_id === projectId) : db.controlepunten)
    },
    async fotoUrls(paden) {
      return Object.fromEntries(paden.filter(p => db.fotos[p]).map(p => [p, db.fotos[p]!]))
    },
    async voegControlepuntToe(projectId, invoer: NieuwControlepunt) {
      if (invoer.leverancierId && !db.projectLeveranciers.some(k => k.project_id === projectId && k.leverancier_id === invoer.leverancierId)) throw new BronFout('Kies een leverancier van dit project.')
      const id = nieuwId('c')
      const foto = fotoPad(projectId, id)
      // Kleiner dan in het echt: alles staat in de opslag van de browser, en die is maar een paar MB.
      db.fotos[foto] = await naarDataUrl(await verkleinFoto(invoer.foto, 1024, 0.7))
      if (invoer.plek && !db.tekeningen.some(t => t.id === invoer.plek!.tekening_id && t.project_id === projectId)) throw new BronFout('Kies een tekening van dit project.')
      const p: Controlepunt = {
        id, project_id: projectId, leverancier_id: invoer.leverancierId, notitie: invoer.notitie, foto, opgelost: false,
        opgelost_door: null, opgelost_op: null, aangemaakt_door: door, aangemaakt_op: new Date().toISOString(),
        ...GEEN_PLEK, ...invoer.plek,
      }
      db.controlepunten.push(p)
      if (!bewaar()) {
        db.controlepunten.pop()
        delete db.fotos[foto]
        throw new BronFout('De opslag van deze browser is vol. Haal een paar aandachtspunten weg, of begin opnieuw met de voorbeeldgegevens.')
      }
      return kopie(p)
    },
    async bewaarControlepunt(id, w) {
      await wacht()
      const p = db.controlepunten.find(x => x.id === id)
      if (!p) throw new BronFout('Dit aandachtspunt bestaat niet (meer).')
      if (w.leverancier_id && !db.projectLeveranciers.some(k => k.project_id === p.project_id && k.leverancier_id === w.leverancier_id)) throw new BronFout('Kies een leverancier van dit project.')
      if (w.tekening_id && !db.tekeningen.some(t => t.id === w.tekening_id && t.project_id === p.project_id)) throw new BronFout('Kies een tekening van dit project.')
      const vorige = p.leverancier_id
      if (w.leverancier_id !== undefined) p.leverancier_id = w.leverancier_id
      for (const v of ['tekening_id', 'tekening_blad', 'tekening_x', 'tekening_y'] as const) if (w[v] !== undefined) Object.assign(p, { [v]: w[v] })
      if (w.opgelost !== undefined && w.opgelost !== p.opgelost) {
        Object.assign(p, { opgelost: w.opgelost, opgelost_door: w.opgelost ? door : null, opgelost_op: w.opgelost ? new Date().toISOString() : null })
      }
      sluitAlsOpgelost(vorige)
      bewaar()
      return kopie(p)
    },
    async verwijderControlepunt(punt) {
      await wacht()
      db.controlepunten = db.controlepunten.filter(p => p.id !== punt.id)
      // De voorbeeldpunten delen één foto: die blijft zolang een ander punt hem nog gebruikt.
      if (!db.controlepunten.some(p => p.foto === punt.foto)) delete db.fotos[punt.foto]
      sluitAlsOpgelost(punt.leverancier_id)
      bewaar()
    },

    async deellinks() {
      await naarServerNu(true)
      return kopie([...db.deellinks].sort((a, b) => Date.parse(b.aangemaakt_op) - Date.parse(a.aangemaakt_op)))
    },
    async maakDeellink(leverancierId) {
      await wacht()
      if (!openPuntenVan(leverancierId, db.controlepunten).length) throw new BronFout('Deze leverancier heeft geen open aandachtspunten.')
      const nu = new Date()
      const l: Deellink = {
        id: nieuwId('dl'), leverancier_id: leverancierId, token: nieuwToken(willekeurig(32)), code: nieuweCode(willekeurig(5)),
        geldig_tot: plusMaand(nu).toISOString(), gesloten_op: null, gesloten_door: null, gesloten_reden: null,
        foute_pogingen: 0, bekeken_op: null, aangemaakt_door: naam, aangemaakt_op: nu.toISOString(),
      }
      db.deellinks.push(l)
      bewaar(false)
      await naarServerNu()
      return kopie(l)
    },
    async trekDeellinkIn(id) {
      await wacht()
      const l = db.deellinks.find(x => x.id === id)
      if (!l) throw new BronFout('Deze link bestaat niet (meer).')
      if (!l.gesloten_reden) sluit(l, 'ingetrokken')
      bewaar(false)
      await naarServerNu()
      return kopie(l)
    },
    async externeInhoud(token, code) {
      await wacht()
      // Niet in deze browser gemaakt: dan de kopie op de server.
      if (server && !db.deellinks.some(l => l.token === token)) return server.inhoud(token, code)
      const poging = poort(token, code)
      if ('antwoord' in poging) return kopie(poging.antwoord)
      const { link } = poging
      const inhoud = inhoudVan(link, pad => db.fotos[pad] ?? null)
      if (!inhoud) {
        sluit(link, 'opgelost', 'systeem')
        bewaar()
        return dichtAntwoord(link, 'opgelost')
      }
      return { stand: 'open', inhoud: kopie(inhoud) }
    },
    async externeTekeningUrl(token, code, tekeningId) {
      if (server && !db.deellinks.some(l => l.token === token)) return server.tekeningUrl(token, code, tekeningId)
      const poging = poort(token, code)
      if ('antwoord' in poging) throw new BronFout('Deze link is niet (meer) open.')
      const op = openPuntenVan(poging.link.leverancier_id, db.controlepunten).some(p => p.tekening_id === tekeningId)
      const t = db.tekeningen.find(x => x.id === tekeningId)
      if (!op || !t) throw new BronFout('Deze tekening hoort niet (meer) bij deze link.')
      return pdfUrl(t)
    },
  }
}
