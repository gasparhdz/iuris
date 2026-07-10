import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clearSseTicketMemoryStoreForTests,
  consumeSseTicket,
  issueSseTicket,
} from "../services/sse-ticket.service.js";

describe("SSE ticket — un solo uso", () => {
  beforeAll(() => {
    clearSseTicketMemoryStoreForTests();
  });

  afterAll(() => {
    clearSseTicketMemoryStoreForTests();
  });

  it("consume un ticket válido una sola vez; el segundo uso falla", async () => {
    const { ticket } = await issueSseTicket({
      usuarioId: 1,
      estudioId: 1,
      tokenVersion: 0,
    });

    const first = await consumeSseTicket(ticket);
    expect(first).toEqual({ usuarioId: 1, estudioId: 1, tokenVersion: 0 });

    const second = await consumeSseTicket(ticket);
    expect(second).toBeNull();
  });
});
