import { huidig, standaard, type Instellingen, type Sleutel } from '~/lib/instellingen'

/**
 * Eén lijst onder Instellingen bewerken: een concept (een kopie van wat nu geldt), Opslaan en Terug naar de standaard.
 * Alleen het MT slaat op; de database dwingt dat ook af. Wijzigt iemand anders de lijst terwijl jij niets hebt
 * veranderd, dan volgt het concept vanzelf. voorOpslaan krijgt wat er gaat gelden (het concept, of bij Terug naar de
 * standaard de standaard) en draait vóór het opslaan; gaat het mis, dan wordt er niets opgeslagen.
 */
export function useInstellingBewerken<S extends Sleutel>(sleutel: S, opties: { voorOpslaan?: (nieuw: Instellingen[S]) => Promise<void> } = {}) {
  const bron = useBron()
  const { toon } = useToast()
  const { gebruiker } = useGebruiker()
  const { rijen, bijgewerkt, rij } = useInstellingen()
  const concept = ref(huidig()[sleutel]) as Ref<Instellingen[S]>
  let basis = JSON.stringify(concept.value)
  const bezig = ref(false)
  const isMt = computed(() => !!gebruiker.value?.isMt)
  const gewijzigd = computed(() => JSON.stringify(concept.value) !== basis)
  /** Wie dit het laatst opsloeg, of null als de standaard geldt. */
  const opgeslagen = computed(() => rij(sleutel))

  function herlaad() {
    concept.value = huidig()[sleutel]
    basis = JSON.stringify(concept.value)
  }
  watch(rijen, () => {
    if (!gewijzigd.value) herlaad()
  }, { deep: true })

  async function opslaan() {
    bezig.value = true
    try {
      await opties.voorOpslaan?.(concept.value)
      bijgewerkt(await bron.bewaarInstelling(sleutel, concept.value))
      herlaad()
      toon('Opgeslagen · geldt meteen voor iedereen')
    } catch (e) {
      toon(foutTekst(e), 'fout')
    } finally {
      bezig.value = false
    }
  }

  async function standaardTerug() {
    if (!confirm('Deze lijst terugzetten naar de standaard? Wat hier is aangepast, gaat verloren.')) return
    bezig.value = true
    try {
      await opties.voorOpslaan?.(standaard()[sleutel])
      await bron.wisInstelling(sleutel)
      bijgewerkt({ sleutel, weg: true })
      herlaad()
      toon('Terug naar de standaard')
    } catch (e) {
      toon(foutTekst(e), 'fout')
    } finally {
      bezig.value = false
    }
  }

  // Niet zomaar weg met wijzigingen die nog niet zijn opgeslagen.
  onBeforeRouteLeave(() => !gewijzigd.value || confirm('Je wijzigingen zijn nog niet opgeslagen. Toch weggaan?'))

  return { concept, gewijzigd, bezig, isMt, opgeslagen, opslaan, standaardTerug, herstel: herlaad }
}
