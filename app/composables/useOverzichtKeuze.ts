import { leesSortering, type Sortering } from '~/lib/overzicht'

const FILTERS = ['wie', 'pl', 'oz', 'prio', 'af']

/**
 * De sortering en de filters van Projecten (verantwoordelijke, projectleider, opzichter, alleen prio, afgehandeld), in de
 * adresbalk: terug vanaf een kaart geeft dezelfde keuze. Kom je van buiten de app binnen (een getypt of bewaard adres,
 * een bladwijzer, na het inloggen), dan beginnen de filters leeg: een oud adres zet ze niet stilletjes op iemand.
 */
export function useOverzichtKeuze(pad: string) {
  const route = useRoute()
  const router = useRouter()
  const vorige = router.options.history.state.back
  const vanBinnen = typeof vorige === 'string' && !vorige.startsWith('/login')
  const begin = vanBinnen ? route.query : Object.fromEntries(Object.entries(route.query).filter(([k]) => !FILTERS.includes(k)))
  if (!vanBinnen && FILTERS.some(k => k in route.query)) router.replace({ query: begin })
  const tekst = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const sortering = ref<Sortering>(leesSortering(begin.sort))
  const wie = ref(tekst(begin.wie) ?? 'alle')
  const pl = ref(tekst(begin.pl) ?? 'alle')
  const oz = ref(tekst(begin.oz) ?? 'alle')
  const prio = ref(begin.prio === '1')
  const afgehandeld = ref(begin.af === '1')
  watch([sortering, wie, pl, oz, prio, afgehandeld], ([s, w, l, o, p, a]) => {
    if (route.path !== pad) return
    // Andere sleutels (zoals het tabblad) blijven staan.
    const { sort: _s, wie: _w, pl: _l, oz: _o, prio: _p, af: _a, ...rest } = route.query
    router.replace({ query: {
      ...rest,
      ...(s !== 'telaat' ? { sort: s } : {}),
      ...(w !== 'alle' ? { wie: w } : {}),
      ...(l !== 'alle' ? { pl: l } : {}),
      ...(o !== 'alle' ? { oz: o } : {}),
      ...(p ? { prio: '1' } : {}),
      ...(a ? { af: '1' } : {}),
    } })
  })
  // Opnieuw op het menu-item klikken (zonder query): terug naar de standaard.
  watch(() => route.query, (q) => {
    if (route.path !== pad) return
    sortering.value = leesSortering(q.sort)
    wie.value = tekst(q.wie) ?? 'alle'
    pl.value = tekst(q.pl) ?? 'alle'
    oz.value = tekst(q.oz) ?? 'alle'
    prio.value = q.prio === '1'
    afgehandeld.value = q.af === '1'
  })
  return { sortering, wie, pl, oz, prio, afgehandeld }
}
