import { describe, expect, it } from "vitest";
import {
  dryValidateProviderAdapter,
  getSupportedProviderNames,
} from "../src/lib/marketing/providers";

describe("M19 provider readiness dry validation", () => {
  it("lists supported providers", () => {
    expect(getSupportedProviderNames()).toEqual(["mock", "resend", "zalo_zns"]);
  });

  it("keeps real provider sends disabled", () => {
    const resend = dryValidateProviderAdapter("resend");
    const zalo = dryValidateProviderAdapter("zalo_zns");

    expect(resend.dry_run_only).toBe(true);
    expect(resend.real_send_enabled).toBe(false);
    expect(resend.status).toBe("blocked");

    expect(zalo.dry_run_only).toBe(true);
    expect(zalo.real_send_enabled).toBe(false);
    expect(zalo.status).toBe("blocked");
  });

  it("allows mock provider dry validation only", () => {
    const mock = dryValidateProviderAdapter("mock");

    expect(mock.status).toBe("pass");
    expect(mock.dry_run_only).toBe(true);
    expect(mock.real_send_enabled).toBe(false);
    expect(mock.can_initialize_adapter).toBe(true);
  });
});