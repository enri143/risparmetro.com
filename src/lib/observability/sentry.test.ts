import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "./sentry";

describe("scrubSentryEvent", () => {
  it("rediga chiave 'provvigione' in extra", () => {
    const result = scrubSentryEvent({ extra: { provvigione: 50, route: "/board" } });
    expect((result["extra"] as Record<string, unknown>)["provvigione"]).toBe("[redacted]");
    expect((result["extra"] as Record<string, unknown>)["route"]).toBe("/board");
  });

  it("rediga token, password, service_role, api_key in extra", () => {
    const result = scrubSentryEvent({
      extra: {
        token: "abc",
        password: "secret",
        service_role: "jwt",
        api_key: "key",
        api_key2: "key2",
      },
    });
    const extra = result["extra"] as Record<string, unknown>;
    expect(extra["token"]).toBe("[redacted]");
    expect(extra["password"]).toBe("[redacted]");
    expect(extra["service_role"]).toBe("[redacted]");
    expect(extra["api_key"]).toBe("[redacted]");
    expect(extra["api_key2"]).toBe("[redacted]");
  });

  it("rimuove request.data", () => {
    const result = scrubSentryEvent({
      request: { url: "https://example.com", data: { payload: "sensitive" } },
    });
    const req = result["request"] as Record<string, unknown>;
    expect(req["data"]).toBeUndefined();
    expect(req["url"]).toBe("https://example.com");
  });

  it("lascia intatte chiavi normali (userId, route)", () => {
    const result = scrubSentryEvent({ extra: { userId: "u-1", route: "/board" } });
    const extra = result["extra"] as Record<string, unknown>;
    expect(extra["userId"]).toBe("u-1");
    expect(extra["route"]).toBe("/board");
  });

  it("non lancia su event con campi mancanti ({})", () => {
    expect(() => scrubSentryEvent({})).not.toThrow();
    expect(() => scrubSentryEvent({ extra: undefined } as unknown as Record<string, unknown>)).not.toThrow();
  });

  it("NON muta l'oggetto input originale", () => {
    const original = {
      extra: { provvigione: 100, route: "/board" },
      request: { url: "https://example.com", data: "body" },
    };
    const originalExtra = original.extra;
    const originalRequest = original.request;
    scrubSentryEvent(original as unknown as Record<string, unknown>);
    expect(original.extra).toBe(originalExtra);
    expect(original.extra.provvigione).toBe(100);
    expect(original.request).toBe(originalRequest);
    expect(original.request.data).toBe("body");
  });
});
