import type { InjectionKey } from 'vue'
import type { NieuweUitzondering } from '~/data/bron'
import type { Fase, Financien, Licht, LogRegel, Project, ProjectWijziging, Taak, TaakWijziging, Uitzondering } from '~/lib/types'
import { FASEN } from '~/lib/fasen'
import { OPEN_LICHTEN, standZin, takenVan, telling, volgendeMijlpaal, type TaakRegel } from '~/lib/stoplicht'
import { aantalPerUitzondering, bereiktFase } from '~/lib/uitzonderingen'
import { leegTaak } from '~/lib/taak'
import { vandaag } from '~/lib/datum'

export type Filter = 'open' | 'klaar' | 'alles' | 'telaat' | 'letop'

/** Past een stand in het filter? Open = te laat, let op en open. */
export const pastInFilter = (l: Licht, f: Filter) => f === 'alles' || (f === 'open' ? OPEN_LICHTEN.includes(l) : f === l)

const kopie = <T>(o: T): T => JSON.parse(JSON.stringify(o))

function maakKaart(slug: string) {
  const bron = useBron()
  const { toon } = useToast()
  const nu = vandaag()

  const project = ref<Project | null>(null)
  const taken = ref<Taak[]>([])
  const catalogus = ref<Uitzondering[]>([])
  const gebruik = ref(new Map<string, number>())
  const projecten = ref<Pick<Project, 'id' | 'fase'>[]>([])
  const financien = ref<Financien | null>(null)
  const logboek = ref<LogRegel[]>([])
  const stand = ref<'laden' | 'klaar' | 'niet-gevonden' | 'fout'>('laden')
  const fout = ref('')
  // Blijft staan als je van tabblad wisselt.
  const tabFase = ref<Fase>('lead')
  const filter = ref<Filter>('open')
  /** De taak waar net naartoe is gesprongen: die klapt open en licht even op. */
  const nadruk = ref<string | null>(null)

  async function laad() {
    stand.value = 'laden'
    try {
      const p = await bron.project(slug)
      if (!p) {
        stand.value = 'niet-gevonden'
        return
      }
      const [t, c, f, l, alle, ps] = await Promise.all([
        bron.taken(p.id), bron.uitzonderingen(), bron.financien(p.id), bron.logboek(p.id), bron.taken(), bron.projecten(),
      ])
      project.value = p
      taken.value = t
      catalogus.value = c
      financien.value = f
      logboek.value = l
      gebruik.value = aantalPerUitzondering(alle)
      projecten.value = ps.map(x => ({ id: x.id, fase: x.fase }))
      tabFase.value = p.fase
      stand.value = 'klaar'
    } catch (e) {
      fout.value = foutTekst(e)
      stand.value = 'fout'
    }
  }

  const regelsPerFase = computed(() => {
    const p = project.value
    if (!p) return null
    return Object.fromEntries(FASEN.map(f => [f.id, takenVan(f.id, p, taken.value, catalogus.value, nu)])) as Record<Fase, TaakRegel[]>
  })
  const huidig = computed(() => (project.value && regelsPerFase.value?.[project.value.fase]) || [])
  const lichten = computed(() => telling(huidig.value))
  const zin = computed(() => project.value ? standZin(project.value, huidig.value) : [])
  const mijlpaal = computed(() => project.value ? volgendeMijlpaal(project.value, nu) : null)
  const bereikt = (fase: Fase) => bereiktFase(projecten.value, fase)
  const vindRegel = (id: string) => regelsPerFase.value ? Object.values(regelsPerFase.value).flat().find(r => r.id === id) : undefined

  /** Spring naar een taak: juiste fase, een filter waarin hij past, uitgeklapt. */
  function gaNaar(id: string) {
    const r = vindRegel(id)
    if (!r) return
    tabFase.value = r.fase
    if (!pastInFilter(r.b.licht, filter.value)) filter.value = 'alles'
    nadruk.value = id
  }

  async function verversLog() {
    if (project.value) logboek.value = await bron.logboek(project.value.id).catch(() => logboek.value)
  }

  /** Wijzigt een taak meteen op het scherm en slaat hem op; bij een fout gaat alles terug. */
  async function wijzigTaak(regel: TaakRegel, w: TaakWijziging): Promise<boolean> {
    const p = project.value
    if (!p) return false
    const vorige = kopie(taken.value)
    const oudLicht = regel.b.licht
    const tijdelijk = `tijdelijk:${regel.id}`
    const bestaand = regel.taak && taken.value.find(t => t.id === regel.taak!.id)
    if (bestaand) Object.assign(bestaand, w)
    else if (regel.standaard) taken.value.push(leegTaak({ id: tijdelijk, project_id: p.id, fase: regel.fase, lijst: regel.fase, sleutel: regel.standaard.sleutel, ...w }))
    try {
      const opgeslagen = regel.taak
        ? await bron.bewaarTaak(regel.taak.id, w)
        : await bron.bewaarStandaardtaak(p.id, regel.fase, regel.standaard!.sleutel, w)
      const i = taken.value.findIndex(t => t.id === opgeslagen.id || t.id === tijdelijk)
      if (i >= 0) taken.value[i] = opgeslagen
      else taken.value.push(opgeslagen)
      const nieuw = vindRegel(regel.id)
      toon(nieuw && nieuw.b.licht !== oudLicht ? `Opgeslagen · ${regel.titel}: ${nieuw.b.woord.toLowerCase()}` : 'Opgeslagen · in het logboek')
      verversLog()
      return true
    } catch (e) {
      taken.value = vorige
      toon(foutTekst(e), 'fout')
      return false
    }
  }

  async function wijzigProject(w: ProjectWijziging, melding = 'Opgeslagen · in het logboek'): Promise<boolean> {
    const p = project.value
    if (!p) return false
    const vorige = kopie(p)
    Object.assign(p, w)
    try {
      project.value = await bron.bewaarProject(p.id, w)
      if (w.fase) tabFase.value = w.fase
      toon(melding)
      verversLog()
      return true
    } catch (e) {
      project.value = vorige
      toon(foutTekst(e), 'fout')
      return false
    }
  }

  async function voegUitzonderingToe(invoer: NieuweUitzondering): Promise<Taak | null> {
    const p = project.value
    if (!p) return null
    try {
      const { taak, uitzondering } = await bron.voegUitzonderingToe(p.id, invoer)
      if (!catalogus.value.some(u => u.id === uitzondering.id)) catalogus.value.push(uitzondering)
      taken.value.push(taak)
      gebruik.value = new Map(gebruik.value).set(uitzondering.id, (gebruik.value.get(uitzondering.id) ?? 0) + 1)
      toon(`Uitzondering toegevoegd · komt nu voor in ${gebruik.value.get(uitzondering.id)} ${gebruik.value.get(uitzondering.id) === 1 ? 'project' : 'projecten'}`)
      verversLog()
      return taak
    } catch (e) {
      toon(foutTekst(e), 'fout')
      return null
    }
  }

  async function verwijderUitzondering(regel: TaakRegel) {
    if (!regel.taak) return
    const vorige = kopie(taken.value)
    taken.value = taken.value.filter(t => t.id !== regel.taak!.id)
    try {
      await bron.verwijderTaak(regel.taak.id)
      const id = regel.taak.uitzondering_id
      if (id) gebruik.value = new Map(gebruik.value).set(id, Math.max(0, (gebruik.value.get(id) ?? 1) - 1))
      toon('Uitzondering weggehaald · in het logboek')
      verversLog()
    } catch (e) {
      taken.value = vorige
      toon(foutTekst(e), 'fout')
    }
  }

  return {
    project, taken, catalogus, gebruik, financien, logboek, stand, fout, nu, tabFase, filter, nadruk,
    regelsPerFase, huidig, lichten, zin, mijlpaal, bereikt,
    laad, gaNaar, wijzigTaak, wijzigProject, voegUitzonderingToe, verwijderUitzondering,
  }
}

export type Kaart = ReturnType<typeof maakKaart>
const SLEUTEL: InjectionKey<Kaart> = Symbol('projectkaart')

/** Op de pagina: maakt de kaart en geeft hem door aan alle onderdelen. */
export function useProjectkaart(slug: string): Kaart {
  const kaart = maakKaart(slug)
  provide(SLEUTEL, kaart)
  return kaart
}

/** In een onderdeel van de kaart. */
export function useKaart(): Kaart {
  const kaart = inject(SLEUTEL)
  if (!kaart) throw new Error('useKaart() werkt alleen binnen een projectkaart.')
  return kaart
}
