import type { Fase } from '~/lib/types'
import { KOLOMMEN } from '~/lib/overzicht'

/** De kolom die op Projecten over de hele breedte staat, of 'alle' voor alle kolommen naast elkaar. Bewaard in een cookie. */
export function useOverzichtWeergave() {
  const cookie = useCookie<string>('projectkaart_overzicht_kolom', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/', default: () => 'alle' })
  /** Een oude of onbekende waarde in de cookie wordt gewoon weer alle kolommen. */
  const geldig = (k: unknown): Fase | 'alle' => (KOLOMMEN.includes(k as Fase) ? k as Fase : 'alle')
  const kolom = useState<Fase | 'alle'>('overzicht-kolom', () => geldig(cookie.value))
  watch(kolom, k => (cookie.value = k))
  const zet = (k: Fase) => (kolom.value = geldig(k))
  const herstel = () => (kolom.value = 'alle')
  return { kolom, zet, herstel }
}
