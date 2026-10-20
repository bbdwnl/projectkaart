/**
 * Het tabblad van een overzicht in de adresbalk (?weergave=planning): terug vanaf een kaart geeft dezelfde weergave,
 * en een link is te delen. De standaard staat er niet in; andere sleutels (filters) blijven staan.
 */
export function useTabblad<T extends string>(standaard: T, opties: readonly T[]) {
  const route = useRoute()
  const router = useRouter()
  return computed<T>({
    get: () => opties.find(o => o === route.query.weergave) ?? standaard,
    set: (w) => {
      const { weergave: _, ...rest } = route.query
      router.replace({ query: w === standaard ? rest : { ...rest, weergave: w } })
    },
  })
}
