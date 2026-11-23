import { leesThema, type Thema } from '~/lib/thema'

/** De vormgeving van de app (Kaarten of Zakelijk), per apparaat bewaard in een cookie (een jaar geldig). */
export function useThema() {
  const cookie = useCookie<string>('projectkaart_thema', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/', default: () => 'kaarten' })
  const thema = useState<Thema>('thema', () => leesThema(cookie.value))
  watch(thema, t => (cookie.value = t))
  const zakelijk = computed(() => thema.value === 'zakelijk')
  const zet = (t: Thema) => (thema.value = leesThema(t))
  return { thema, zakelijk, zet }
}
