import { pingDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDb();
    return Response.json({ db: "ok" });
  } catch (err) {
    console.error("health check: db unavailable", err);
    return Response.json({ db: "unavailable" }, { status: 503 });
  }
}
