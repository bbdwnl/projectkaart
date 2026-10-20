import { leesSortering, type Sortering } from '~/lib/overzicht'

/**
 * De sortering en het filter op de verantwoordelijke van een overzicht (Projecten, Haalbaarheid), in de adresbalk:
 * terug vanaf een kaart geeft dezelfde keuze, en een selectie is te delen.
 */
export function useOverzichtKeuze(pad: string) {
  const route = useRoute()
  const router = useRouter()
  const tekst = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const sortering = ref<Sortering>(leesSortering(route.query.sort))
  const wie = ref(tekst(route.query.wie) ?? 'alle')
  watch([sortering, wie], ([s, w]) => {
    if (route.path !== pad) return
    // Andere sleutels (zoals het tabblad) blijven staan.
    const { sort: _s, wie: _w, ...rest } = route.query
    router.replace({ query: { ...rest, ...(s !== 'telaat' ? { sort: s } : {}), ...(w !== 'alle' ? { wie: w } : {}) } })
  })
  // Opnieuw op het menu-item klikken (zonder query): terug naar de standaard.
  watch(() => route.query, (q) => {
    if (route.path !== pad) return
    sortering.value = leesSortering(q.sort)
    wie.value = tekst(q.wie) ?? 'alle'
  })
  return { sortering, wie }
}
