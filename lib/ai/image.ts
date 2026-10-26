import sharp from "sharp";

/** 長邊縮到 1092px、轉 JPEG：省 token 也加快辨識，同時去掉 EXIF（含 GPS） */
export async function prepareImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1092, height: 1092, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}
