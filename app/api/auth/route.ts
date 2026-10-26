import { z } from "zod/v4";
import { api, HttpError, readJson } from "@/lib/api";
import { createSession, verifyLineIdToken } from "@/lib/auth/session";
import { getOrCreateUser } from "@/lib/db/queries/users";

const body = z.union([
  z.object({ idToken: z.string().min(10) }),
  // 本機開發（沒有 LIFF）用：只有設定 ALLOW_DEV_LOGIN=1 且非 production 才接受
  z.object({ devLineUserId: z.string().min(1) }),
]);

export const POST = api(async (req: Request) => {
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "bad_request");

  let lineUserId: string;
  let name: string | undefined;
  if ("idToken" in parsed.data) {
    try {
      ({ lineUserId, name } = await verifyLineIdToken(parsed.data.idToken));
    } catch (err) {
      console.warn("id token verify failed", err);
      throw new HttpError(401, "invalid_token");
    }
  } else {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "1") {
      throw new HttpError(403, "dev_login_disabled");
    }
    lineUserId = parsed.data.devLineUserId;
  }

  const user = await getOrCreateUser(lineUserId, name);
  await createSession(user.id);
  return Response.json({ ok: true });
});
