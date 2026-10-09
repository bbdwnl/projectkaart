import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

// Een uitsnede van een tekening rond een plek, met de plek erop: voor in de pdf, zodat een leverancier
// ziet waar het is. Elke tekening wordt één keer geladen per pdf (de cache gaat mee van buiten).

export interface Uitsnede { data: string, b: number, h: number }
export type TekeningCache = Map<string, { taak: PDFDocumentLoadingTask, pdf: Promise<PDFDocumentProxy> }>

/** Een kwart van de bladbreedte rond de plek (4:3), zo dicht mogelijk bij de rand als de plek daar ligt. */
export async function tekeningUitsnede(cache: TekeningCache, url: string, blad: number, x: number, y: number, breedte = 900): Promise<Uitsnede | null> {
  try {
    if (!cache.has(url)) {
      const pdfjs = await laadPdfjs()
      const taak = pdfjs.getDocument({ url })
      cache.set(url, { taak, pdf: taak.promise })
    }
    const pdf = await cache.get(url)!.pdf
    const pagina = await pdf.getPage(Math.min(Math.max(1, blad), pdf.numPages))
    const vp1 = pagina.getViewport({ scale: 1 })
    const deelB = Math.min(vp1.width, vp1.width * 0.25)
    const deelH = Math.min(vp1.height, deelB * 0.75)
    const x0 = Math.min(Math.max(0, x * vp1.width - deelB / 2), vp1.width - deelB)
    const y0 = Math.min(Math.max(0, y * vp1.height - deelH / 2), vp1.height - deelH)
    const s = breedte / deelB
    const doek = document.createElement('canvas')
    doek.width = Math.round(deelB * s)
    doek.height = Math.round(deelH * s)
    await pagina.render({ canvas: doek, viewport: pagina.getViewport({ scale: s }), transform: [1, 0, 0, 1, -x0 * s, -y0 * s] }).promise
    // De plek: een rode stip met witte en zwarte rand, zoals in de viewer.
    const c = doek.getContext('2d')!
    const px = (x * vp1.width - x0) * s, py = (y * vp1.height - y0) * s
    c.lineWidth = 6
    c.strokeStyle = 'rgba(194,110,96,.45)'
    c.beginPath(); c.arc(px, py, 34, 0, Math.PI * 2); c.stroke()
    c.fillStyle = '#ffffff'
    c.beginPath(); c.arc(px, py, 19, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#c26e60'; c.strokeStyle = '#111111'; c.lineWidth = 4
    c.beginPath(); c.arc(px, py, 13, 0, Math.PI * 2); c.fill(); c.stroke()
    return { data: doek.toDataURL('image/jpeg', 0.82), b: doek.width, h: doek.height }
  } catch {
    return null
  }
}

export function sluitTekeningen(cache: TekeningCache) {
  for (const { taak } of cache.values()) taak.destroy()
  cache.clear()
}
