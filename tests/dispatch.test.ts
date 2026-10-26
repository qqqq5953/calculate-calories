import { beforeEach, describe, expect, it, vi } from "vitest";
import type { webhook } from "@line/bot-sdk";

const replyMock = vi.fn();
const notifyMock = vi.fn();
const getOrCreateUserMock = vi.fn();

vi.mock("@/lib/line/client", () => ({
  reply: (...args: unknown[]) => replyMock(...args),
  text: (t: string) => ({ type: "text", text: t }),
  showLoading: vi.fn(),
  lineClient: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ notifyAdminDbDown: (...a: unknown[]) => notifyMock(...a) }));
vi.mock("@/lib/db/queries/users", () => ({
  getOrCreateUser: (...a: unknown[]) => getOrCreateUserMock(...a),
}));

const { handleEvent } = await import("@/lib/bot/dispatch");
const { DbUnavailableError } = await import("@/lib/db/client");
const { MSG } = await import("@/lib/bot/messages");

const textEvent = {
  type: "message",
  mode: "active",
  timestamp: 0,
  webhookEventId: "e1",
  deliveryContext: { isRedelivery: false },
  source: { type: "user", userId: "U123" },
  replyToken: "token-1",
  message: { type: "text", id: "m1", text: "雞腿便當", quoteToken: "q" },
} as unknown as webhook.Event;

describe("handleEvent error handling", () => {
  beforeEach(() => {
    replyMock.mockReset();
    notifyMock.mockReset();
    getOrCreateUserMock.mockReset();
  });

  it("replies with a friendly message when the DB is unavailable", async () => {
    getOrCreateUserMock.mockRejectedValue(new DbUnavailableError(new Error("ECONNREFUSED")));
    await expect(handleEvent(textEvent)).resolves.toBeUndefined();
    expect(replyMock).toHaveBeenCalledWith("token-1", [{ type: "text", text: MSG.dbUnavailable }]);
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it("replies with a generic message on unexpected errors", async () => {
    getOrCreateUserMock.mockRejectedValue(new Error("boom"));
    await handleEvent(textEvent);
    expect(replyMock).toHaveBeenCalledWith("token-1", [{ type: "text", text: MSG.genericError }]);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("ignores group events", async () => {
    await handleEvent({ ...textEvent, source: { type: "group", groupId: "G1" } } as unknown as webhook.Event);
    expect(replyMock).not.toHaveBeenCalled();
  });
});
