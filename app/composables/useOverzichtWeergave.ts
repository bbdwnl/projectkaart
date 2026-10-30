/** De kolom die in de gridview wordt getoond, of 'alle' voor de normale drie kolommen. Bewaard in een cookie. */
export function useOverzichtWeergave() {
  const cookie = useCookie<string>('projectkaart_overzicht_kolom', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/', default: () => 'alle' })
  const kolom = useState<string>('overzicht-kolom', () => cookie.value || 'alle')
  watch(kolom, k => (cookie.value = k))
  const zet = (k: string) => (kolom.value = k)
  const herstel = () => (kolom.value = 'alle')
  return { kolom, zet, herstel }
}