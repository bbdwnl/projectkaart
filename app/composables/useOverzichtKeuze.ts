import { leesSortering, type Sortering } from '~/lib/overzicht'

/**
 * De sortering en de filters van Projecten (verantwoordelijke, projectleider, opzichter, alleen prio), in de
 * adresbalk: terug vanaf een kaart geeft dezelfde keuze, en een selectie is te delen.
 */
export function useOverzichtKeuze(pad: string) {
  const route = useRoute()
  const router = useRouter()
  const tekst = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const sortering = ref<Sortering>(leesSortering(route.query.sort))
  const wie = ref(tekst(route.query.wie) ?? 'alle')
  const pl = ref(tekst(route.query.pl) ?? 'alle')
  const oz = ref(tekst(route.query.oz) ?? 'alle')
  const prio = ref(route.query.prio === '1')
  watch([sortering, wie, pl, oz, prio], ([s, w, l, o, p]) => {
    if (route.path !== pad) return
    // Andere sleutels (zoals het tabblad) blijven staan.
    const { sort: _s, wie: _w, pl: _l, oz: _o, prio: _p, ...rest } = route.query
    router.replace({ query: {
      ...rest,
      ...(s !== 'telaat' ? { sort: s } : {}),
      ...(w !== 'alle' ? { wie: w } : {}),
      ...(l !== 'alle' ? { pl: l } : {}),
      ...(o !== 'alle' ? { oz: o } : {}),
      ...(p ? { prio: '1' } : {}),
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
  })
  return { sortering, wie, pl, oz, prio }
}
