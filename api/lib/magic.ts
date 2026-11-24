// 文件魔数（magic bytes）检测 — 只信任文件头，不信任扩展名/MIME
export interface DetectedImage {
  contentType: string;
  ext: string;
}

export function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  const eq = (...sig: number[]) => sig.every((s, i) => b[i] === s);

  // JPEG: FF D8 FF
  if (eq(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", ext: "jpg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (eq(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { contentType: "image/png", ext: "png" };
  // GIF: 47 49 46 38 (37|39) 61
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61)
    return { contentType: "image/gif", ext: "gif" };
  // WebP: RIFF....WEBP
  if (eq(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { contentType: "image/webp", ext: "webp" };
  // BMP: 42 4D
  if (eq(0x42, 0x4d)) return { contentType: "image/bmp", ext: "bmp" };
  // AVIF/HEIC: ftyp box, brand avif/avis/heic/heix
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand === "avif" || brand === "avis") return { contentType: "image/avif", ext: "avif" };
    if (brand.startsWith("hei")) return { contentType: "image/heic", ext: "heic" };
  }
  return null;
}
