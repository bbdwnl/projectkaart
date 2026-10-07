import { leesWeergave, standaardWeergave, type Weergave } from '~/lib/weergave'

/** Wat iemand op de kaart wil zien, per apparaat bewaard in een cookie (een jaar geldig). */
export function useWeergave() {
  const cookie = useCookie<unknown>('projectkaart_weergave', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/', default: () => null })
  const weergave = useState<Weergave>('weergave', () => leesWeergave(cookie.value))
  watch(weergave, w => (cookie.value = JSON.parse(JSON.stringify(w))), { deep: true })
  const herstel = () => (weergave.value = standaardWeergave(weergave.value.tab))
  return { weergave, herstel }
}
