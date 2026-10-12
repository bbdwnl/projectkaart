/** Zet een bestand in de downloads van de browser (ook op een iPhone: daar opent het in een voorbeeld). */
export function downloaden(bestand: Blob, naam: string) {
  const url = URL.createObjectURL(bestand)
  const a = Object.assign(document.createElement('a'), { href: url, download: naam })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
