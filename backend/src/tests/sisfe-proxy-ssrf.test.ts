import { describe, expect, it } from "vitest";
import {
  isUnsafeProxyPath,
  resolveSafeProxyTarget,
  rewriteLocationSafe,
} from "../routes/sisfe.routes.js";

describe("proxy SISFE — anti-SSRF", () => {
  it("rechaza paths protocol-relative y absolutos a otros hosts", () => {
    expect(isUnsafeProxyPath("//evil.com/payload")).toBe(true);
    expect(isUnsafeProxyPath("/http://evil.com/x")).toBe(true);
    expect(isUnsafeProxyPath("http://evil.com/x")).toBe(true);
    expect(isUnsafeProxyPath("/\\evil.com")).toBe(true);
    expect(resolveSafeProxyTarget("//evil.com/payload")).toBeNull();
    expect(resolveSafeProxyTarget("/http://evil.com/x")).toBeNull();
    expect(resolveSafeProxyTarget("http://evil.com/x")).toBeNull();
  });

  it("acepta paths relativos normales de SISFE", () => {
    const target = resolveSafeProxyTarget("/buscar-expediente");
    expect(target).not.toBeNull();
    expect(target!.origin).toBe("https://sisfe.justiciasantafe.gov.ar");
    expect(target!.pathname).toBe("/buscar-expediente");
  });

  it("rewriteLocationSafe solo reescribe destinos SISFE", () => {
    expect(rewriteLocationSafe("https://evil.com/x")).toBeNull();
    expect(rewriteLocationSafe("//evil.com/x")).toBeNull();
    expect(rewriteLocationSafe("https://sisfe.justiciasantafe.gov.ar/foo")).toBe(
      "/api/sisfe/proxy/foo",
    );
    expect(rewriteLocationSafe("/buscar-expediente")).toBe("/api/sisfe/proxy/buscar-expediente");
  });
});
