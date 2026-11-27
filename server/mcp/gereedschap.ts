import type { Bron } from '../../app/data/bron'
import type { Actie, ActieWijziging, Fase, Licht, Project, ProjectWijziging, Status, Taak, TaakWijziging, Uitzondering } from '../../app/lib/types'
import { BUDDIES, DATUMVELDEN, EIGENAREN, EISEN, FASEN, faseInfo, MENSEN, PROGNOSEVELDEN, ROLLEN } from '../../app/lib/fasen'
import { eisStand, opUrgentie, OPEN_LICHTEN, standZin, takenVan, telling, volgendeMijlpaal, weggehaaldVan, type TaakRegel } from '../../app/lib/stoplicht'
import { isAfgehandeld, kaartjesVan } from '../../app/lib/overzicht'
import { STATUSSEN, statusNaam } from '../../app/lib/taak'
import { beschrijf } from '../../app/lib/logboek'
import { dagen, fmt, naarDatum, naarIso } from '../../app/lib/datum'
import { InvoerFout, type Gereedschap } from './protocol'

// Wat Copilot met de projectkaart kan: lezen zoals op de kaart (met het stoplicht dat zichzelf uitrekent) en
// bijwerken wat een medewerker ook op de kaart bijwerkt. Alles gaat via de Bron, met de inlog van de medewerker: RLS
// bepaalt wat mag, en wie en wanneer vult de database in (logboek, aftekenen, klantakkoord). Geen verwijderen, geen
// financiën en geen instellingen: dat blijft in de app, met een vraag vooraf.

export interface Context {
  bron: Bron
  nu: Date
  gebruiker: { naam: string, email: string, isMt: boolean }
  /** Het adres van de app, voor de link naar een kaart. */
  appUrl: string
  /** Tot wanneer de koppeling met Copilot geldt: 30 dagen na het laatste gebruik, hoogstens een jaar na toestaan. */
  geldigTot: string
}

export const WOORD: Record<Licht, string> = { telaat: 'Te laat', letop: 'Let op', open: 'Open', klaar: 'Klaar', later: 'N.v.t. of later' }
const SLAGINGSKANSEN = [0, 25, 50, 75, 100]
const MAX_PROJECTEN = 60

// ---------------------------------------------------------------------------------------------------------------
// Invoer lezen. Een fout zegt wat er wel kan, zodat Copilot het zelf kan verbeteren.
// ---------------------------------------------------------------------------------------------------------------

type Args = Record<string, unknown>

function tekst(a: Args, k: string, opties: { verplicht?: boolean, max?: number } = {}): string | undefined {
  const v = a[k]
  if (v === undefined || v === null) {
    if (opties.verplicht) throw new InvoerFout(`${k} is verplicht.`)
    return undefined
  }
  if (typeof v !== 'string') throw new InvoerFout(`${k} moet tekst zijn.`)
  const t = v.trim()
  if (opties.verplicht && !t) throw new InvoerFout(`${k} is verplicht.`)
  if (opties.max && t.length > opties.max) throw new InvoerFout(`${k} mag hoogstens ${opties.max} tekens zijn.`)
  return t
}

/** Tekst, of leegmaken met null of "". undefined: niet meegegeven. */
function leegOfTekst(a: Args, k: string, max = 500): string | null | undefined {
  if (!(k in a)) return undefined
  if (a[k] === null) return null
  return tekst(a, k, { max }) || null
}

function janee(a: Args, k: string): boolean | undefined {
  const v = a[k]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new InvoerFout(`${k} moet true of false zijn.`)
  return v
}

function datum(a: Args, k: string): string | null | undefined {
  const v = leegOfTekst(a, k, 10)
  if (v === undefined || v === null) return v
  const d = naarDatum(v)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !d || naarIso(d) !== v) throw new InvoerFout(`${k} moet een datum zijn als 2026-12-31, of null om hem leeg te maken.`)
  return v
}

/** Een naam uit een keuzelijst (Instellingen → Mensen). Hoofdletters tellen niet; null maakt leeg. */
function uitLijst(a: Args, k: string, lijst: string[], wat: string): string | null | undefined {
  const v = leegOfTekst(a, k, 80)
  if (v === undefined || v === null) return v
  const gevonden = lijst.find(x => x.toLowerCase() === v.toLowerCase())
  if (!gevonden) throw new InvoerFout(`${v} staat niet in de lijst ${wat}. Kies uit: ${lijst.join(', ')}. Of null om leeg te maken.`)
  return gevonden
}

function fase(a: Args, k: string): Fase | undefined {
  const v = tekst(a, k)
  if (!v) return undefined
  const f = FASEN.find(x => x.id === v.toLowerCase() || x.naam.toLowerCase() === v.toLowerCase())
  if (!f) throw new InvoerFout(`Onbekende fase ${v}. Kies uit: ${FASEN.map(x => x.id).join(', ')}.`)
  return f.id
}

function url(a: Args, k: string): string | null | undefined {
  const v = leegOfTekst(a, k, 2000)
  if (v && !/^https?:\/\//i.test(v)) throw new InvoerFout(`${k} moet een link zijn die met https:// begint.`)
  return v
}

// ---------------------------------------------------------------------------------------------------------------
// Zoeken: een project op nummer, naam of slug; een taak op id of titel.
// ---------------------------------------------------------------------------------------------------------------

const PROJECT_UITLEG = 'Het projectnummer (P20038), de naam (of een deel ervan) of de slug uit de link.'
const TAAK_UITLEG = 'Het id uit project_bekijken (std:fase:sleutel of uitz:…), of de titel van de taak (of een uniek deel ervan).'

const kort = (p: Project) => `${p.nummer ?? p.slug} ${p.naam}`

export function vindProject(projecten: Project[], ref: string): Project {
  const z = ref.trim().toLowerCase()
  if (!z) throw new InvoerFout(`Noem een project. ${PROJECT_UITLEG}`)
  const exact = projecten.filter(p => p.slug === z || p.nummer?.toLowerCase() === z || p.naam.toLowerCase() === z)
  if (exact.length === 1) return exact[0]!
  const kandidaten = exact.length ? exact : projecten.filter(p => p.naam.toLowerCase().includes(z) || !!p.nummer?.toLowerCase().includes(z))
  if (kandidaten.length === 1) return kandidaten[0]!
  if (!kandidaten.length) throw new InvoerFout(`Geen project gevonden bij "${ref}". Zoek eerst met projecten_zoeken.`)
  throw new InvoerFout(`"${ref}" past bij ${kandidaten.length} projecten: ${kandidaten.slice(0, 10).map(kort).join('; ')}. Noem het projectnummer.`)
}

export function vindTaak(regels: TaakRegel[], ref: string, huidigeFase: Fase): TaakRegel {
  const z = ref.trim().toLowerCase()
  if (!z) throw new InvoerFout(`Noem een taak. ${TAAK_UITLEG}`)
  const opId = regels.find(r => r.id.toLowerCase() === z)
  if (opId) return opId
  const kies = (lijst: TaakRegel[]) => {
    if (lijst.length === 1) return lijst[0]!
    const inFase = lijst.filter(r => r.fase === huidigeFase)
    return inFase.length === 1 ? inFase[0]! : null
  }
  const exact = regels.filter(r => r.titel.toLowerCase() === z)
  const deel = exact.length ? exact : regels.filter(r => r.titel.toLowerCase().includes(z))
  const gevonden = kies(deel)
  if (gevonden) return gevonden
  if (!deel.length) throw new InvoerFout(`Geen taak gevonden bij "${ref}". Bekijk de taken met project_bekijken (filter alles).`)
  throw new InvoerFout(`"${ref}" past bij ${deel.length} taken: ${deel.slice(0, 10).map(r => `${r.titel} (${faseInfo(r.fase).naam}, id ${r.id})`).join('; ')}. Gebruik het id.`)
}

// ---------------------------------------------------------------------------------------------------------------
// Wat Copilot terugkrijgt: kort, in woorden, zonder lege velden.
// ---------------------------------------------------------------------------------------------------------------

function zonderLeeg<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')) as Partial<T>
}

const zin = (delen: { tekst: string }[]) => delen.map(d => d.tekst).join('')
const iso = (d: Date | null) => (d ? naarIso(d) : null)

function verantwoordelijk(p: Project): string {
  const rol = faseInfo(p.fase).rol
  return p[rol] ? `${ROLLEN[rol].kort} ${p[rol]}` : `${ROLLEN[rol].kort} nog niet gekozen`
}

function projectKort(p: Project, regels: TaakRegel[], ctx: Context) {
  const t = telling(regels)
  const mp = volgendeMijlpaal(p, ctx.nu)
  return zonderLeeg({
    nummer: p.nummer,
    naam: p.naam,
    plaats: p.plaats,
    fase: faseInfo(p.fase).naam,
    verantwoordelijk: verantwoordelijk(p),
    prio: p.prio || null,
    wachtkamer: (p.fase === 'lead' && p.wachtkamer) || null,
    afgehandeld: isAfgehandeld(p) || null,
    stand: zin(standZin(p, regels)),
    taken: { te_laat: t.telaat, let_op: t.letop, open: t.open, klaar: t.klaar },
    volgende_mijlpaal: mp ? `${mp.naam} op ${fmt(mp.datum)} (${mp.dagen < 0 ? `${dagen(-mp.dagen)} geleden` : `over ${dagen(mp.dagen)}`})` : null,
    link: `${ctx.appUrl}/projecten/${p.slug}`,
  })
}

function taakUit(r: TaakRegel, opmerkingen = 0) {
  const t = r.taak
  return zonderLeeg({
    id: r.id,
    titel: r.titel,
    groep: r.groep,
    fase: faseInfo(r.fase).naam,
    stand: r.b.woord,
    reden: r.b.reden,
    deadline: iso(r.b.deadline),
    status: statusNaam(t?.status ?? 'niet_gestart'),
    eigenaar: t?.eigenaar,
    reden_nvt: t?.reden_nvt,
    aanleiding: t?.aanleiding,
    document: t?.document_url ? zonderLeeg({ naam: t.document_naam, url: t.document_url }) : null,
    klantakkoord: t?.klantakkoord ? `${t.klantakkoord_door ?? '?'} op ${t.klantakkoord_op?.slice(0, 10) ?? '?'}` : null,
    afgetekend: t?.afgetekend_door ? `${t.afgetekend_door} op ${t.afgetekend_op?.slice(0, 10) ?? '?'}` : null,
    uitzondering: r.uitzondering ? true : null,
    opmerkingen: opmerkingen || null,
  })
}

const actieUit = (a: Actie, nummer: number, p?: Project) => zonderLeeg({
  project: p ? kort(p) : null,
  nummer,
  tekst: a.tekst,
  actiehouder: a.actiehouder,
  deadline: a.deadline,
  gereed: a.gereed ? `${a.gereed_door ?? '?'} op ${a.gereed_op?.slice(0, 10) ?? '?'}` : false,
  aangemaakt: `${a.aangemaakt_door ?? '?'} op ${a.aangemaakt_op.slice(0, 10)}`,
})

/** De acties van één project met hun nummer: in volgorde van aanmaken, zoals op de kaart. */
const genummerd = (acties: Actie[], projectId: string) =>
  acties.filter(a => a.project_id === projectId).map((a, i) => ({ a, nummer: i + 1 }))

// ---------------------------------------------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------------------------------------------

async function laadProject(ctx: Context, a: Args) {
  const projecten = await ctx.bron.projecten()
  return vindProject(projecten, tekst(a, 'project', { verplicht: true })!)
}

async function laadKaart(ctx: Context, p: Project) {
  const [taken, catalogus] = await Promise.all([ctx.bron.taken(p.id), ctx.bron.uitzonderingen()])
  return { taken, catalogus, regels: alleRegels(p, taken, catalogus, ctx.nu) }
}

const alleRegels = (p: Project, taken: Taak[], catalogus: Uitzondering[], nu: Date) =>
  FASEN.flatMap(f => takenVan(f.id, p, taken, catalogus, nu))

// ---------------------------------------------------------------------------------------------------------------
// Het gereedschap
// ---------------------------------------------------------------------------------------------------------------

const projectVeld = { type: 'string', description: PROJECT_UITLEG }
const taakVeld = { type: 'string', description: TAAK_UITLEG }
const datumVeld = (wat: string) => ({ type: ['string', 'null'], description: `${wat}, als 2026-12-31; null maakt leeg.` })
const lezen = { readOnlyHint: true, openWorldHint: false } as const
const schrijven = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const

export function maakGereedschap(ctx: Context): Gereedschap[] {
  const { bron } = ctx
  return [
    {
      name: 'wie_ben_ik',
      title: 'Wie ben ik',
      description: 'Namens wie Copilot werkt, met welke rol, en tot wanneer de koppeling geldt. Wat je wijzigt, staat op deze naam in het logboek.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: lezen,
      run: async () => ({ naam: ctx.gebruiker.naam, email: ctx.gebruiker.email, rol: ctx.gebruiker.isMt ? 'MT' : 'medewerker', koppeling_geldig_tot: ctx.geldigTot }),
    },

    {
      name: 'projecten_zoeken',
      title: 'Projecten zoeken',
      description: 'De projecten met hun stand in de huidige fase (het stoplicht rekent zichzelf uit), het dringendste eerst: '
        + 'de meeste taken te laat, dan let op. Zonder zoekterm: alle lopende projecten. Afgehandelde nazorg alleen met afgehandeld_ook.',
      inputSchema: {
        type: 'object',
        properties: {
          zoek: { type: 'string', description: 'Deel van de naam, het projectnummer of de plaats.' },
          fase: { type: 'string', enum: FASEN.map(f => f.id), description: 'Alleen projecten in deze fase.' },
          verantwoordelijke: { type: 'string', description: 'Alleen projecten van deze persoon (AM, PO, PM of opzichter), op voornaam.' },
          alleen_aandacht: { type: 'boolean', description: 'Alleen projecten met taken te laat of let op.' },
          afgehandeld_ook: { type: 'boolean', description: 'Ook nazorg die is afgehandeld.' },
        },
        additionalProperties: false,
      },
      annotations: lezen,
      async run(a) {
        const zoek = tekst(a, 'zoek')?.toLowerCase()
        const f = fase(a, 'fase')
        const wie = tekst(a, 'verantwoordelijke')?.toLowerCase()
        const aandacht = janee(a, 'alleen_aandacht') ?? false
        const afgehandeld = janee(a, 'afgehandeld_ook') ?? false
        const [projecten, taken, catalogus] = await Promise.all([bron.projecten(), bron.taken(), bron.uitzonderingen()])
        const kaartjes = kaartjesVan(projecten, taken, catalogus, ctx.nu).filter(({ p, t }) =>
          (afgehandeld || !isAfgehandeld(p))
          && (!f || p.fase === f)
          && (!zoek || [p.naam, p.nummer, p.plaats, p.slug].some(v => v?.toLowerCase().includes(zoek)))
          && (!wie || [p.am, p.po, p.pm, p.opzichter].some(v => v?.toLowerCase().split(/\s+/).includes(wie) || v?.toLowerCase() === wie))
          && (!aandacht || t.telaat + t.letop > 0))
        const lijst = kaartjes.slice(0, MAX_PROJECTEN).map(({ p }) =>
          projectKort(p, takenVan(p.fase, p, taken.filter(t => t.project_id === p.id), catalogus, ctx.nu), ctx))
        return { aantal: kaartjes.length, ...(kaartjes.length > MAX_PROJECTEN ? { let_op: `Alleen de eerste ${MAX_PROJECTEN}; zoek gerichter.` } : {}), projecten: lijst }
      },
    },

    {
      name: 'project_bekijken',
      title: 'Projectkaart bekijken',
      description: 'De projectkaart van één project: gegevens, datums, de stand, de taken van een fase (met id, stoplicht, status, eigenaar, '
        + 'document, wie aftekende), wat er klaar moet zijn voor de overdracht, de open acties uit het overleg en de aandachtspunten. '
        + 'Standaard de huidige fase en alleen wat openstaat (te laat, let op, open), het dringendste eerst.',
      inputSchema: {
        type: 'object',
        properties: {
          project: projectVeld,
          fase: { type: 'string', enum: FASEN.map(f => f.id), description: 'Een andere fase dan de huidige.' },
          filter: { type: 'string', enum: ['open', 'klaar', 'alles'], description: 'Open (standaard): te laat, let op en open. Klaar: definitief of klantakkoord. Alles: ook n.v.t. en later.' },
        },
        required: ['project'],
        additionalProperties: false,
      },
      annotations: lezen,
      async run(a) {
        const p = await laadProject(ctx, a)
        const f = fase(a, 'fase') ?? p.fase
        const filter = tekst(a, 'filter') ?? 'open'
        if (!['open', 'klaar', 'alles'].includes(filter)) throw new InvoerFout('filter is open, klaar of alles.')
        const [{ taken, catalogus }, acties, punten, opmerkingen] = await Promise.all([
          laadKaart(ctx, p), bron.acties(p.id), bron.controlepunten(p.id), bron.opmerkingen(p.id),
        ])
        const huidig = takenVan(p.fase, p, taken, catalogus, ctx.nu)
        const getoond = takenVan(f, p, taken, catalogus, ctx.nu)
        const past = (l: Licht) => filter === 'alles' || (filter === 'open' ? OPEN_LICHTEN.includes(l) : l === 'klaar')
        const aantalOpm = (id?: string) => (id ? opmerkingen.filter(o => o.taak_id === id).length : 0)
        return {
          project: {
            ...projectKort(p, huidig, ctx),
            ...zonderLeeg({
              adres: [[p.straat, p.huisnummer].filter(Boolean).join(' '), [p.postcode, p.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', '),
              soort: p.soort.join(', '),
              m2: p.m2,
              slagingskans: p.slagingskans === null ? null : `${p.slagingskans}%`,
              rollen: zonderLeeg({ am: p.am, po: p.po, pm: p.pm, opzichter: p.opzichter, buddy: p.buddy }),
              datums: zonderLeeg(Object.fromEntries(DATUMVELDEN.map(d => [d.veld, p[d.veld]]))),
              prognose: zonderLeeg(Object.fromEntries(PROGNOSEVELDEN.map(d => [d.veld, p[d.veld]]))),
              sharepoint: p.sharepoint_url,
              sharepoint_extern: p.extern_url,
              notitieblok: p.notitieblok_url,
              tekeningen_locatie: p.tekeningen_locatie,
            }),
          },
          taken_van: `${faseInfo(f).naam}, filter ${filter}`,
          taken: opUrgentie(getoond.filter(r => past(r.b.licht))).map(r => taakUit(r, aantalOpm(r.taak?.id))),
          overdracht: { kop: EISEN[f].kop, eisen: EISEN[f].items.map(e => ({ eis: e.titel, stand: WOORD[eisStand(e.taken, p, taken, ctx.nu)] })) },
          weggehaald_bij_dit_project: weggehaaldVan(f, p, taken).map(w => w.standaard.titel),
          acties_open: genummerd(acties, p.id).filter(x => !x.a.gereed).map(x => actieUit(x.a, x.nummer)),
          aandachtspunten: {
            open: punten.filter(x => !x.opgelost && !x.gereed_op).length,
            te_controleren: punten.filter(x => !x.opgelost && x.gereed_op).length,
            opgelost: punten.filter(x => x.opgelost).length,
          },
        }
      },
    },

    {
      name: 'logboek_bekijken',
      title: 'Logboek bekijken',
      description: 'Wie wat wanneer wijzigde aan een project, het nieuwste eerst. Het logboek vult de database zelf.',
      inputSchema: {
        type: 'object',
        properties: { project: projectVeld, aantal: { type: 'integer', minimum: 1, maximum: 200, description: 'Hoeveel regels (standaard 25).' } },
        required: ['project'],
        additionalProperties: false,
      },
      annotations: lezen,
      async run(a) {
        const p = await laadProject(ctx, a)
        const n = typeof a.aantal === 'number' && Number.isInteger(a.aantal) ? Math.min(Math.max(a.aantal, 1), 200) : 25
        const [regels, catalogus] = await Promise.all([bron.logboek(p.id, n), bron.uitzonderingen()])
        return { project: kort(p), logboek: regels.map(r => ({ op: r.op, door: r.door, wat: zin(beschrijf(r, catalogus)) })) }
      },
    },

    {
      name: 'opmerkingen_bekijken',
      title: 'Opmerkingen bij een taak',
      description: 'De draad met opmerkingen bij één taak: wie, wanneer en wat, de oudste eerst.',
      inputSchema: { type: 'object', properties: { project: projectVeld, taak: taakVeld }, required: ['project', 'taak'], additionalProperties: false },
      annotations: lezen,
      async run(a) {
        const p = await laadProject(ctx, a)
        const { regels } = await laadKaart(ctx, p)
        const r = vindTaak(regels, tekst(a, 'taak', { verplicht: true })!, p.fase)
        const opm = r.taak ? (await bron.opmerkingen(p.id)).filter(o => o.taak_id === r.taak!.id) : []
        return { taak: r.titel, opmerkingen: opm.map(o => ({ op: o.op, door: o.door, tekst: o.tekst })) }
      },
    },

    {
      name: 'acties_bekijken',
      title: 'Acties uit het overleg',
      description: 'De actielijst van het overleg: van één project of van alle projecten, met nummer, actiehouder, deadline en of hij gereed is.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { ...projectVeld, description: `Optioneel. ${PROJECT_UITLEG}` },
          actiehouder: { type: 'string', description: 'Alleen de acties van deze persoon.' },
          ook_gereed: { type: 'boolean', description: 'Ook de acties die gereed zijn (standaard alleen open).' },
        },
        additionalProperties: false,
      },
      annotations: lezen,
      async run(a) {
        const projecten = await bron.projecten()
        const ref = tekst(a, 'project')
        const p = ref ? vindProject(projecten, ref) : null
        const wie = tekst(a, 'actiehouder')?.toLowerCase()
        const gereedOok = janee(a, 'ook_gereed') ?? false
        const acties = await bron.acties(p?.id)
        const rijen = (p ? [p] : projecten).flatMap(x => genummerd(acties, x.id).map(r => ({ ...r, p: x })))
          .filter(({ a: act }) => (gereedOok || !act.gereed) && (!wie || act.actiehouder?.toLowerCase() === wie))
        rijen.sort((x, y) => (x.a.deadline ?? '9999').localeCompare(y.a.deadline ?? '9999'))
        return { aantal: rijen.length, acties: rijen.map(r => actieUit(r.a, r.nummer, r.p)) }
      },
    },

    {
      name: 'taak_bijwerken',
      title: 'Taak bijwerken',
      description: 'Werkt een taak op de projectkaart bij: status, eigenaar, reden n.v.t., document of klantakkoord. Status Definitief is aftekenen: '
        + 'de database zet de naam van de gebruiker en het moment erbij. N.v.t. vraagt een reden. Komt in het logboek op naam van de gebruiker. '
        + 'Vraag de gebruiker eerst om bevestiging.',
      inputSchema: {
        type: 'object',
        properties: {
          project: projectVeld,
          taak: taakVeld,
          status: { type: 'string', enum: STATUSSEN.map(s => s.id), description: `De nieuwe status: ${STATUSSEN.map(s => `${s.id} (${s.naam})`).join(', ')}.` },
          eigenaar: { type: ['string', 'null'], description: 'Wie de taak heeft, uit de lijst van eigenaren; null maakt leeg.' },
          reden_nvt: { type: ['string', 'null'], description: 'Waarom de taak niet van toepassing is (bij status nvt).' },
          document_url: { type: ['string', 'null'], description: 'Link naar het document (https://…, bijvoorbeeld in SharePoint); null haalt het weg.' },
          document_naam: { type: ['string', 'null'], description: 'Naam van het document, bijvoorbeeld P20038 – DO Casco – rev D.pdf.' },
          klantakkoord: { type: 'boolean', description: 'De klant ging akkoord (true) of dat wordt teruggedraaid (false).' },
          deadline: datumVeld('Alleen bij een uitzondering: de deadline. Standaardtaken rekenen die uit de projectdatums'),
        },
        required: ['project', 'taak'],
        additionalProperties: false,
      },
      annotations: schrijven,
      async run(a) {
        const p = await laadProject(ctx, a)
        const { taken, catalogus, regels } = await laadKaart(ctx, p)
        const r = vindTaak(regels, tekst(a, 'taak', { verplicht: true })!, p.fase)
        const w: TaakWijziging = {}
        const status = tekst(a, 'status')
        if (status) {
          const s = STATUSSEN.find(x => x.id === status || x.naam.toLowerCase() === status.toLowerCase())
          if (!s) throw new InvoerFout(`Onbekende status ${status}. Kies uit: ${STATUSSEN.map(x => x.id).join(', ')}.`)
          w.status = s.id as Status
        }
        const eigenaar = uitLijst(a, 'eigenaar', EIGENAREN, 'eigenaren')
        if (eigenaar !== undefined) w.eigenaar = eigenaar
        const reden = leegOfTekst(a, 'reden_nvt', 500)
        if (reden !== undefined) w.reden_nvt = reden
        const docUrl = url(a, 'document_url')
        if (docUrl !== undefined) w.document_url = docUrl
        const docNaam = leegOfTekst(a, 'document_naam', 300)
        if (docNaam !== undefined) w.document_naam = docNaam
        if (docUrl === null && docNaam === undefined) w.document_naam = null
        const akkoord = janee(a, 'klantakkoord')
        if (akkoord !== undefined) w.klantakkoord = akkoord
        const deadline = datum(a, 'deadline')
        if (deadline !== undefined) {
          if (!r.uitzondering) throw new InvoerFout('Een standaardtaak rekent zijn deadline uit de projectdatums. Pas die aan met project_bijwerken.')
          w.deadline = deadline
        }
        if (!Object.keys(w).length) throw new InvoerFout('Geef aan wat er verandert: status, eigenaar, reden_nvt, document_url, document_naam, klantakkoord of deadline.')
        const nvt = (w.status ?? r.taak?.status) === 'nvt'
        const redenNa = 'reden_nvt' in w ? w.reden_nvt : r.taak?.reden_nvt
        if (nvt && !redenNa) {
          throw new InvoerFout('Bij n.v.t. hoort een reden (reden_nvt). Vraag de gebruiker waarom de taak niet van toepassing is.')
        }

        const opgeslagen = r.taak
          ? await bron.bewaarTaak(r.taak.id, w)
          : await bron.bewaarStandaardtaak(p.id, r.fase, r.standaard!.sleutel, w)
        const nieuw = [...taken.filter(t => t.id !== opgeslagen.id), opgeslagen]
        const na = alleRegels(p, nieuw, catalogus, ctx.nu).find(x => x.id === r.id)
          ?? takenVan(r.fase, p, nieuw, catalogus, ctx.nu).find(x => x.taak?.id === opgeslagen.id)
        return { opgeslagen: true, door: ctx.gebruiker.naam, taak: na ? taakUit(na) : { id: r.id, titel: r.titel } }
      },
    },

    {
      name: 'opmerking_plaatsen',
      title: 'Opmerking plaatsen',
      description: 'Zet een opmerking in de draad bij een taak, op naam van de gebruiker. Een opmerking is daarna niet meer te wijzigen of te verwijderen. Vraag eerst om bevestiging.',
      inputSchema: {
        type: 'object',
        properties: { project: projectVeld, taak: taakVeld, tekst: { type: 'string', description: 'De opmerking (hoogstens 4000 tekens).' } },
        required: ['project', 'taak', 'tekst'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      async run(a) {
        const p = await laadProject(ctx, a)
        const { regels } = await laadKaart(ctx, p)
        const r = vindTaak(regels, tekst(a, 'taak', { verplicht: true })!, p.fase)
        const t = tekst(a, 'tekst', { verplicht: true, max: 4000 })!
        const taakId = r.taak?.id ?? (await bron.bewaarStandaardtaak(p.id, r.fase, r.standaard!.sleutel, {})).id
        const o = await bron.plaatsOpmerking(taakId, t)
        return { geplaatst: true, taak: r.titel, door: o.door, op: o.op }
      },
    },

    {
      name: 'project_bijwerken',
      title: 'Project bijwerken',
      description: 'Werkt de gegevens van een project bij: fase (alleen het MT), datums, prognose, wie welke rol heeft, prio, slagingskans, wachtkamer of afgehandeld. '
        + 'Alleen wat je meegeeft verandert; null maakt een veld leeg. Komt in het logboek op naam van de gebruiker. Vraag eerst om bevestiging.',
      inputSchema: {
        type: 'object',
        properties: {
          project: projectVeld,
          fase: { type: 'string', enum: FASEN.map(f => f.id), description: 'De nieuwe fase. Alleen het MT kan de fase wisselen.' },
          ...Object.fromEntries(DATUMVELDEN.map(d => [d.veld, datumVeld(d.naam)])),
          ...Object.fromEntries(PROGNOSEVELDEN.map(d => [d.veld, datumVeld(`Prognose ${d.naam.toLowerCase()} (lead en haalbaarheid)`)])),
          am: { type: ['string', 'null'], description: 'Accountmanager, uit Instellingen → Mensen.' },
          po: { type: ['string', 'null'], description: 'Projectontwikkelaar, uit Instellingen → Mensen.' },
          pm: { type: ['string', 'null'], description: 'Projectmanager, uit Instellingen → Mensen.' },
          opzichter: { type: ['string', 'null'], description: 'Opzichter, uit Instellingen → Mensen.' },
          buddy: { type: ['string', 'null'], description: 'Buddy die meekijkt, uit Instellingen → Mensen.' },
          prio: { type: 'boolean' },
          slagingskans: { type: ['integer', 'null'], enum: [...SLAGINGSKANSEN, null], description: 'In procenten: 0, 25, 50, 75 of 100.' },
          wachtkamer: { type: 'boolean', description: 'Een lead in de wachtkamer.' },
          afgehandeld: { type: 'boolean', description: 'Nazorg helemaal klaar.' },
        },
        required: ['project'],
        additionalProperties: false,
      },
      annotations: schrijven,
      async run(a) {
        const p = await laadProject(ctx, a)
        const w: ProjectWijziging = {}
        const f = fase(a, 'fase')
        if (f && f !== p.fase && !ctx.gebruiker.isMt) throw new InvoerFout('Alleen het MT kan de fase van een project wisselen.')
        if (f) w.fase = f
        for (const d of [...DATUMVELDEN, ...PROGNOSEVELDEN]) {
          const v = datum(a, d.veld)
          if (v !== undefined) (w as Record<string, unknown>)[d.veld] = v
        }
        for (const rol of ['am', 'po', 'pm', 'opzichter'] as const) {
          const v = uitLijst(a, rol, MENSEN[rol], ROLLEN[rol].naam.toLowerCase())
          if (v !== undefined) w[rol] = v
        }
        const buddy = uitLijst(a, 'buddy', BUDDIES, 'buddies')
        if (buddy !== undefined) w.buddy = buddy
        for (const k of ['prio', 'wachtkamer', 'afgehandeld'] as const) {
          const v = janee(a, k)
          if (v !== undefined) w[k] = v
        }
        if ('slagingskans' in a) {
          const v = a.slagingskans
          if (v !== null && !SLAGINGSKANSEN.includes(v as number)) throw new InvoerFout('slagingskans is 0, 25, 50, 75 of 100, of null.')
          w.slagingskans = v as number | null
        }
        if (!Object.keys(w).length) throw new InvoerFout('Geef aan wat er verandert.')
        if (w.afgehandeld && (w.fase ?? p.fase) !== 'nazorg') throw new InvoerFout('Afgehandeld kan alleen in nazorg.')
        if (w.wachtkamer && (w.fase ?? p.fase) !== 'lead') throw new InvoerFout('De wachtkamer is alleen voor leads.')

        const na = await bron.bewaarProject(p.id, w)
        const { regels } = await laadKaart(ctx, na)
        return { opgeslagen: true, door: ctx.gebruiker.naam, gewijzigd: Object.keys(w), project: projectKort(na, regels.filter(r => r.fase === na.fase), ctx) }
      },
    },

    {
      name: 'actie_toevoegen',
      title: 'Actie toevoegen',
      description: 'Zet een nieuwe actie op de actielijst van het overleg van een project. Wie hem aanmaakte en wanneer vult de database in. Vraag eerst om bevestiging.',
      inputSchema: {
        type: 'object',
        properties: {
          project: projectVeld,
          tekst: { type: 'string', description: 'Wat er moet gebeuren (hoogstens 2000 tekens).' },
          actiehouder: { type: ['string', 'null'], description: 'Wie de actie heeft, uit de lijst van eigenaren.' },
          deadline: datumVeld('Wanneer hij af moet zijn'),
        },
        required: ['project', 'tekst'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      async run(a) {
        const p = await laadProject(ctx, a)
        const w: ActieWijziging = { tekst: tekst(a, 'tekst', { verplicht: true, max: 2000 })! }
        const houder = uitLijst(a, 'actiehouder', EIGENAREN, 'eigenaren')
        if (houder !== undefined) w.actiehouder = houder
        const d = datum(a, 'deadline')
        if (d !== undefined) w.deadline = d
        const nieuw = await bron.nieuweActie(p.id, w)
        const nummer = genummerd(await bron.acties(p.id), p.id).find(x => x.a.id === nieuw.id)?.nummer ?? 0
        return { toegevoegd: true, actie: actieUit(nieuw, nummer, p) }
      },
    },

    {
      name: 'actie_bijwerken',
      title: 'Actie bijwerken',
      description: 'Werkt een actie uit het overleg bij, op projectnummer en actienummer: gereed melden (of terug), tekst, actiehouder of deadline. Vraag eerst om bevestiging.',
      inputSchema: {
        type: 'object',
        properties: {
          project: projectVeld,
          nummer: { type: 'integer', minimum: 1, description: 'Het nummer van de actie, zoals op de kaart en in acties_bekijken.' },
          gereed: { type: 'boolean' },
          tekst: { type: 'string', description: 'Nieuwe omschrijving.' },
          actiehouder: { type: ['string', 'null'], description: 'Uit de lijst van eigenaren; null maakt leeg.' },
          deadline: datumVeld('Wanneer hij af moet zijn'),
        },
        required: ['project', 'nummer'],
        additionalProperties: false,
      },
      annotations: schrijven,
      async run(a) {
        const p = await laadProject(ctx, a)
        const lijst = genummerd(await bron.acties(p.id), p.id)
        const gevonden = lijst.find(x => x.nummer === a.nummer)
        if (!gevonden) throw new InvoerFout(`Project ${kort(p)} heeft geen actie ${String(a.nummer)}. Er ${lijst.length === 1 ? 'is 1 actie' : `zijn ${lijst.length} acties`}.`)
        const w: ActieWijziging = {}
        const g = janee(a, 'gereed')
        if (g !== undefined) w.gereed = g
        const t = tekst(a, 'tekst', { max: 2000 })
        if (t !== undefined) {
          if (!t) throw new InvoerFout('Een actie heeft een omschrijving.')
          w.tekst = t
        }
        const houder = uitLijst(a, 'actiehouder', EIGENAREN, 'eigenaren')
        if (houder !== undefined) w.actiehouder = houder
        const d = datum(a, 'deadline')
        if (d !== undefined) w.deadline = d
        if (!Object.keys(w).length) throw new InvoerFout('Geef aan wat er verandert: gereed, tekst, actiehouder of deadline.')
        const na = await bron.bewaarActie(gevonden.a.id, w)
        return { opgeslagen: true, actie: actieUit(na, gevonden.nummer, p) }
      },
    },
  ]
}

/** Wat Copilot bij het begin te lezen krijgt: voor wie het werkt en hoe de projectkaart denkt. */
export function instructies(ctx: Pick<Context, 'gebruiker' | 'geldigTot'>): string {
  const n = ctx.gebruiker.naam
  return [
    `Je werkt in de Projectkaart van BbDW namens ${n}${ctx.gebruiker.isMt ? ' (MT)' : ''}. Antwoord in het Nederlands.`,
    `Alles wat je wijzigt, staat in het logboek op naam van ${n}. Status Definitief is aftekenen en een klantakkoord vastleggen ook: daar staat ${n} bij. `
    + 'Wijzig daarom alleen wat de gebruiker vraagt, en vraag eerst bevestiging met precies wat je gaat wijzigen.',
    'Elk project heeft een kaart met taken per fase (lead, haalbaarheid, ontwikkeling, uitvoering, nazorg). Het stoplicht van een taak rekent zichzelf uit '
    + 'uit de status en de deadline: Te laat, Let op (binnen 14 dagen, of n.v.t. zonder reden), Open, Klaar (definitief of klantakkoord) of N.v.t./later. Je zet het nooit met de hand; '
    + 'je verandert de status, of de projectdatums waar de deadlines uit volgen.',
    'Noem projecten bij projectnummer en naam (P20038 Den Bosch). Geef bij een antwoord over een project de link naar de kaart.',
    'De toetssteen: hoe weet ik of dit klopt, of het is afgetekend, en wat de laatste status is. Zeg dus wie aftekende en wanneer, en zeg het als iets niet is afgetekend.',
    `De koppeling blijft werken zolang de gebruiker Copilot gebruikt; na 30 dagen zonder gebruik (nu: ${ctx.geldigTot.slice(0, 10)}) of een jaar na toestaan vraagt Copilot opnieuw om in te loggen bij de Projectkaart.`,
  ].join('\n\n')
}
