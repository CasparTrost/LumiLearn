// A finished picture leaves the app two ways: as a PNG the device keeps
// (a download; on a phone or tablet the share sheet, where "Bild sichern"
// is), or on paper — one page, the picture large and centred, nothing of
// the app around it. Both stay on the device; nothing is uploaded.

export const pictureName = (lines = false) => {
  const d = new Date(), pad = n => String(n).padStart(2, '0')
  return `Mal-Atelier-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${lines ? '-Linien' : ''}.png`
}

// Any picture (a Blob or a URL) as a PNG blob
export async function toPng(src) {
  if (src instanceof Blob && src.type === 'image/png') return src
  const url = src instanceof Blob ? URL.createObjectURL(src) : src
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0)
    return await new Promise(res => c.toBlob(res, 'image/png'))
  } finally {
    if (src instanceof Blob) URL.revokeObjectURL(url)
  }
}

// Saves the PNG: the share sheet where there is a finger and the browser
// shares files, else a download. Returns 'shared', 'downloaded' or 'cancelled'.
export async function savePicture(blob, name = pictureName()) {
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
  const touch = window.matchMedia?.('(pointer: coarse)').matches
  if (touch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
      // not allowed here: download instead
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}

// The print page: A4, upright or wide as the picture, 10 mm margin; only
// the picture is printed, the app is hidden for the print
export const PRINT_ID = 'lumi-print'
export function printCss(wide) {
  const [pw, ph] = wide ? [277, 190] : [190, 277]
  return `@page { size: A4 ${wide ? 'landscape' : 'portrait'}; margin: 10mm }
@media screen { #${PRINT_ID} { display: none !important } }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important }
  body > *:not(#${PRINT_ID}) { display: none !important }
  #${PRINT_ID} { display: flex !important; align-items: center; justify-content: center; width: ${pw - 2}mm; height: ${ph - 3}mm; overflow: hidden; break-inside: avoid; page-break-after: avoid }
  #${PRINT_ID} img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; -webkit-print-color-adjust: exact; print-color-adjust: exact }
}`
}

export async function preparePrint(src) {
  document.getElementById(PRINT_ID)?.remove()
  const img = new Image()
  img.alt = ''
  img.src = src
  await img.decode()
  const root = document.createElement('div')
  root.id = PRINT_ID
  const style = document.createElement('style')
  style.textContent = printCss(img.naturalWidth > img.naturalHeight)
  root.append(style, img)
  document.body.appendChild(root)
  return root
}

export async function printPicture(src) {
  const root = await preparePrint(src)
  const done = () => { root.remove(); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  window.print()
}
