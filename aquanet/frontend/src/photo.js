/** Nén ảnh chụp từ điện thoại (thường 3–8 MB) về JPEG cạnh dài tối đa 1600 px (~300 KB)
 *  trước khi lưu offline / gửi lên – tiết kiệm bộ nhớ máy và dung lượng 3G/4G. */
export async function compressImage(file, maxSide = 1600, quality = 0.8) {
  let src
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    src = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }
  const w = src.width || src.naturalWidth
  const h = src.height || src.naturalHeight
  const k = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height)
  if (src.close) src.close()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
  return blob || file
}
