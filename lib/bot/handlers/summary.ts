import { daySummary } from "@/lib/db/queries/meals";
import { buildSummaryCard } from "@/lib/line/flex/summaryCard";
import { recordMenu } from "@/lib/line/quickReplies";
import { localDate } from "@/lib/time";
import type { BotContext } from "../context";

export async function replySummary(ctx: BotContext) {
  const user = ctx.requireUser();
  const date = localDate(new Date(), ctx.tz);
  const day = await daySummary(user.id, date, ctx.tz);
  const card = buildSummaryCard({
    date,
    totals: day.totals,
    targets: {
      kcal: user.targetKcal,
      proteinG: user.targetProteinG,
      carbG: user.targetCarbG,
      fatG: user.targetFatG,
    },
    meals: day.meals,
  });
  await ctx.reply({ ...card, quickReply: recordMenu() });
}
