import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.192.0/testing/mock.ts";
import { handler, ZALO_ZNS_URL } from "./index.ts";

const MOCK_ENV = {
  SUPABASE_SMS_HOOK_SECRET: "my-secret",
  ZALO_ZNS_ACCESS_TOKEN: "zalo-token-123",
  ZALO_ZNS_OTP_TEMPLATE_ID: "template-456",
};

Deno.test("send-otp-zalo-zns hook tests", async (t) => {
  // Mock Deno.env
  const envStub = stub(Deno.env, "get", (key: string) => MOCK_ENV[key as keyof typeof MOCK_ENV] || undefined);
  
  // Mock fetch
  let fetchCallCount = 0;
  let lastFetchUrl: string | URL | Request = "";
  let lastFetchOpts: RequestInit | undefined = undefined;
  
  let fetchResult = {
    error: 0,
    message: "Success",
  };

  const fetchStub = stub(globalThis, "fetch", async (url, opts) => {
    fetchCallCount++;
    lastFetchUrl = url;
    lastFetchOpts = opts;
    
    // Simulate delay for timeout tests if needed
    if (fetchResult.error === 999) {
      await new Promise(r => setTimeout(r, 100));
      throw new DOMException("The signal has been aborted", "AbortError");
    }

    return new Response(JSON.stringify(fetchResult), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  const createReq = (payload: any, secret: string = "my-secret") => {
    return new Request("http://localhost/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  };

  const validPayload = {
    user: {
      id: "user-123",
      phone: "+84987654321"
    },
    sms: {
      otp: "123456"
    }
  };

  await t.step("valid hook payload sends ZNS request", async () => {
    fetchCallCount = 0;
    fetchResult = { error: 0, message: "Success" };
    
    const res = await handler(createReq(validPayload));
    assertEquals(res.status, 200);
    
    const body = await res.json();
    assertEquals(body.success, true);
    assertEquals(fetchCallCount, 1);
    assertEquals(lastFetchUrl, ZALO_ZNS_URL);
    
    // Check that Zalo API payload has correct structure
    const znsPayload = JSON.parse(lastFetchOpts?.body as string);
    assertEquals(znsPayload.phone, "84987654321"); // No +
    assertEquals(znsPayload.template_id, "template-456");
    assertEquals(znsPayload.template_data.otp, "123456");
  });

  await t.step("invalid hook secret rejected", async () => {
    fetchCallCount = 0;
    const res = await handler(createReq(validPayload, "wrong-secret"));
    assertEquals(res.status, 401);
    assertEquals(fetchCallCount, 0);
  });

  await t.step("invalid phone rejected", async () => {
    fetchCallCount = 0;
    const res = await handler(createReq({
      user: { id: "123", phone: "+123456" }, // Not Vietnamese
      sms: { otp: "123456" }
    }));
    assertEquals(res.status, 400);
    assertEquals(fetchCallCount, 0);
  });

  await t.step("malformed payload rejected", async () => {
    fetchCallCount = 0;
    const res = await handler(createReq({ user: {} }));
    assertEquals(res.status, 400);
    assertEquals(fetchCallCount, 0);
  });

  await t.step("Zalo rate limit mapped safely", async () => {
    fetchCallCount = 0;
    fetchResult = { error: -144, message: "Quota exceeded" };
    
    const res = await handler(createReq(validPayload));
    assertEquals(res.status, 429);
  });

  await t.step("Zalo token failure mapped safely", async () => {
    fetchCallCount = 0;
    fetchResult = { error: -124, message: "access token invalid" };
    
    const res = await handler(createReq(validPayload));
    assertEquals(res.status, 503);
  });

  await t.step("Zalo timeout mapped safely", async () => {
    fetchCallCount = 0;
    fetchResult = { error: 999, message: "Timeout" };
    
    const res = await handler(createReq(validPayload));
    assertEquals(res.status, 504);
  });

  envStub.restore();
  fetchStub.restore();
});
