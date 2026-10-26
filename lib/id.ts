import { customAlphabet } from "nanoid";

// 不含容易混淆的字元；12 碼在家庭規模下碰撞機率可忽略
export const newId = customAlphabet(
  "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  12,
);
