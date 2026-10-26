import { api, HttpError, requireUser } from "@/lib/api";
import { updateMeal } from "@/lib/db/queries/meals";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = api(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const view = await updateMeal((await params).id, user.id, { deletedAt: new Date() });
  if (!view) throw new HttpError(404, "not_found");
  return Response.json({ ok: true });
});
