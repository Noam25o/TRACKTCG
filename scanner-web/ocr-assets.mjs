// Exact routes only: exposing node_modules or a filesystem prefix is forbidden.
export const ocrAssets = new Map([
  ['/ocr-assets/worker.min.js', ['tesseract.js/dist/worker.min.js', 'text/javascript']],
  ['/ocr-assets/tesseract.LICENSE.txt', ['tesseract.js/LICENSE.md', 'text/plain']],
  ['/ocr-assets/worker.LICENSE.txt', ['tesseract.js/dist/worker.min.js.LICENSE.txt', 'text/plain']],
  ['/ocr-assets/core.LICENSE.txt', ['tesseract.js-core/LICENSE', 'text/plain']],
]);
for (const build of ['', '-lstm', '-simd', '-simd-lstm', '-relaxedsimd', '-relaxedsimd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const file = `tesseract-core${build}.${extension}`;
    ocrAssets.set(`/ocr-assets/core/${file}`, [`tesseract.js-core/${file}`, extension === 'wasm' ? 'application/wasm' : 'text/javascript']);
  }
}
for (const lang of ['fra', 'eng', 'jpn']) {
  ocrAssets.set(`/ocr-assets/lang/${lang}.traineddata.gz`, [`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, 'application/gzip']);
}
