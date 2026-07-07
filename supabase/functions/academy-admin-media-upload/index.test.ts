import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("Edge Function Tests: academy-admin-media-upload", async (t) => {
  // Set up mock env
  const origEnv = Deno.env.toObject();
  Deno.env.set("SUPABASE_URL", "https://mock.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "mock-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
  Deno.env.set("ACADEMY_ALLOWED_ORIGINS", "*");

  const origFetch = globalThis.fetch;

  // Create a mock fetch that handles auth.getUser, rpc, and storage
  globalThis.fetch = async (
    req: Request | URL | string,
    init?: RequestInit,
  ): Promise<Response> => {
    let url = "";
    let method = "GET";
    let body = "";

    if (req instanceof Request) {
      url = req.url;
      method = req.method;
    } else if (req instanceof URL) {
      url = req.toString();
    } else {
      url = req;
    }

    if (init && init.method) method = init.method;
    if (init && init.body) {
      body = typeof init.body === "string" ? init.body : String(init.body);
    }

    if (url.includes("/auth/v1/user")) {
      return new Response(
        JSON.stringify({
          id: "mock-user-id",
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.com",
          app_metadata: {},
          user_metadata: {},
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      url.includes("/rest/v1/rpc/admin_create_academy_media_upload_session")
    ) {
      return new Response(
        JSON.stringify({
          uploadSessionId: "mock-session-id",
          objectPath: "courses/c/lessons/l/uploads/u.mp4",
          expiresIn: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/storage/v1/object/sign/academy-content")) {
      return new Response(
        JSON.stringify({
          signedUrl:
            "https://mock.supabase.co/storage/v1/object/sign/academy-content/mock-path?token=mock-token",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      url.includes(
        "/rest/v1/rpc/admin_finalize_academy_media_upload_session",
      ) ||
      url.includes("/rest/v1/rpc/admin_cancel_academy_media_upload_session")
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          status: url.includes("finalize") ? "finalized" : "cancelled",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return origFetch(req, init);
  };

  await t.step("OPTIONS request", async () => {
    const req = new Request("http://localhost/upload", { method: "OPTIONS" });
    const res = await handler(req);
    assertEquals(res.status, 200);
  });

  await t.step("missing Authorization", async () => {
    const req = new Request("http://localhost/upload", { method: "POST" });
    const res = await handler(req);
    assertEquals(res.status, 401);
  });

  await t.step("malformed JSON", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer token" },
      body: "invalid json",
    });
    const res = await handler(req);
    if (res.status !== 400) {
      console.log(await res.text());
    }
    assertEquals(res.status, 400);
  });

  await t.step("request_upload success", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer token" },
      body: JSON.stringify({
        action: "request_upload",
        lessonId: "uuid",
        contentType: "video",
        mimeType: "video/mp4",
        sizeBytes: 100,
        originalFilename: "file.mp4",
      }),
    });
    const res = await handler(req);
    if (res.status !== 200) {
      console.log(await res.text());
    }
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.uploadSessionId, "mock-session-id");
  });

  // Restore everything
  globalThis.fetch = origFetch;
  for (const key of Object.keys(Deno.env.toObject())) {
    Deno.env.delete(key);
  }
  for (const [key, val] of Object.entries(origEnv)) {
    Deno.env.set(key, val);
  }
});
