import { z } from "zod/v4";
import { api, HttpError, readJson, requireUser } from "@/lib/api";
import { deleteItem, setItemPortion } from "@/lib/db/queries/meals";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ portion: z.number().gt(0).max(20) });

export const PATCH = api(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "bad_request");
  const view = await setItemPortion((await params).id, user.id, parsed.data.portion);
  if (!view) throw new HttpError(404, "not_found");
  return Response.json({ ok: true });
});

export const DELETE = api(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const view = await deleteItem((await params).id, user.id);
  if (!view) throw new HttpError(404, "not_found");
  return Response.json({ ok: true });
});
