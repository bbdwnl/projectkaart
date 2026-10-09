/**
 * Maakt van een foto van de telefoon een jpg van hooguit `max` pixels breed of hoog.
 * Een foto van 4 tot 8 MB wordt zo een paar honderd kB: sneller op de bouw en genoeg om een gebrek op te zien.
 */
export async function verkleinFoto(bestand: Blob, max = 1600, kwaliteit = 0.8): Promise<Blob> {
  const beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' })
  const schaal = Math.min(1, max / Math.max(beeld.width, beeld.height))
  const doek = document.createElement('canvas')
  doek.width = Math.round(beeld.width * schaal)
  doek.height = Math.round(beeld.height * schaal)
  doek.getContext('2d')!.drawImage(beeld, 0, 0, doek.width, doek.height)
  beeld.close()
  return new Promise((klaar, mis) => doek.toBlob(b => (b ? klaar(b) : mis(new Error('De foto kon niet worden verwerkt.'))), 'image/jpeg', kwaliteit))
}

export function naarDataUrl(blob: Blob): Promise<string> {
  return new Promise((klaar, mis) => {
    const lezer = new FileReader()
    lezer.onload = () => klaar(String(lezer.result))
    lezer.onerror = () => mis(lezer.error)
    lezer.readAsDataURL(blob)
  })
}
