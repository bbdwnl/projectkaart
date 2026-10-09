import type * as Pdfjs from 'pdfjs-dist'

// pdf.js wordt pas geladen als iemand een tekening opent; daarna hergebruikt.
// De legacy-bouw, zodat het ook op oudere telefoons op de bouw werkt.
let laden: Promise<typeof Pdfjs> | null = null

export function laadPdfjs(): Promise<typeof Pdfjs> {
  laden ??= (async () => {
    const [pdfjs, werker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = werker.default
    return pdfjs
  })()
  return laden
}
