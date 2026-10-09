// De "legacy"-bouw van pdf.js (werkt ook op oudere telefoons) heeft dezelfde vorm als de gewone.
declare module 'pdfjs-dist/legacy/build/pdf.min.mjs' {
  export * from 'pdfjs-dist'
}
