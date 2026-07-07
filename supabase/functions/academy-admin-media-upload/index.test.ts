import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

Deno.test("Edge Function Tests: academy-admin-media-upload", async (t) => {
  const origEnv = Deno.env.toObject();
  Deno.env.set("SUPABASE_URL", "https://mock.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "mock-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
  Deno.env.set("ACADEMY_ALLOWED_ORIGINS", "*");

  const origFetch = globalThis.fetch;

  let rpcCalled = false;
  let storageCalled = false;

  globalThis.fetch = async (
    req: Request | URL | string,
    init?: RequestInit,
  ): Promise<Response> => {
    let url = typeof req === "string"
      ? req
      : req instanceof URL
      ? req.toString()
      : req.url;
    let authHeader = "";

    if (init && init.headers) {
      const headers = new Headers(init.headers);
      authHeader = headers.get("authorization") ||
        headers.get("Authorization") || "";
    }

    if (url.includes("/auth/v1/user")) {
      if (authHeader.includes("invalid")) {
        return new Response(
          JSON.stringify({ error: "Invalid login credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      let id = "mock-student-id";
      if (authHeader.includes("admin")) id = "mock-admin-id";
      if (authHeader.includes("sub_admin")) id = "mock-subadmin-id";
      if (authHeader.includes("sale")) id = "mock-sale-id";
      if (authHeader.includes("tele_lead")) id = "mock-tele-lead-id";

      return new Response(
        JSON.stringify({
          id,
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

    if (url.includes("/rest/v1/user_roles")) {
      const urlObj = new URL(url);
      const userIdStr = urlObj.searchParams.get("user_id");
      let data: any[] = [];
      if (userIdStr?.includes("mock-admin-id")) data = [{ role: "admin" }];
      if (userIdStr?.includes("mock-subadmin-id")) {
        data = [{ role: "sub_admin" }];
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      url.includes("/rest/v1/rpc/admin_create_academy_media_upload_session")
    ) {
      rpcCalled = true;
      return new Response(
        JSON.stringify({
          uploadSessionId: "mock-session-id",
          objectPath: "path",
          expiresIn: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      url.includes("/storage/v1/object/sign/academy-content") ||
      url.includes("/storage/v1/object/upload/sign/academy-content")
    ) {
      storageCalled = true;
      const resData = {
        url: "/object/upload/sign/academy-content/mock-path?token=mock-token",
      };
      return new Response(JSON.stringify(resData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      url.includes(
        "/rest/v1/rpc/admin_finalize_academy_media_upload_session",
      ) ||
      url.includes("/rest/v1/rpc/admin_cancel_academy_media_upload_session")
    ) {
      rpcCalled = true;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return origFetch(req, init);
  };

  await t.step(
    "Authentication: missing Authorization returns 401",
    async () => {
      const req = new Request("http://localhost/upload", { method: "POST" });
      const res = await handler(req);
      assertEquals(res.status, 401);
    },
  );

  await t.step("Authentication: malformed Bearer returns 401", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Token 123" },
    });
    const res = await handler(req);
    assertEquals(res.status, 401);
  });

  await t.step("Authentication: invalid JWT returns 401", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer invalid" },
    });
    const res = await handler(req);
    assertEquals(res.status, 401);
  });

  await t.step("Authorization: student returns 403", async () => {
    rpcCalled = false;
    storageCalled = false;
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer student" },
      body: JSON.stringify({
        action: "request_upload",
        lessonId: "x",
        contentType: "x",
        mimeType: "x",
        sizeBytes: 1,
        originalFilename: "x",
      }),
    });
    const res = await handler(req);
    assertEquals(res.status, 403);
    assertEquals(rpcCalled, false);
    assertEquals(storageCalled, false);
  });

  await t.step("Authorization: sale returns 403", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer sale" },
      body: JSON.stringify({
        action: "request_upload",
        lessonId: "x",
        contentType: "x",
        mimeType: "x",
        sizeBytes: 1,
        originalFilename: "x",
      }),
    });
    const res = await handler(req);
    assertEquals(res.status, 403);
  });

  await t.step("Authorization: tele_lead returns 403", async () => {
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer tele_lead" },
      body: JSON.stringify({
        action: "request_upload",
        lessonId: "x",
        contentType: "x",
        mimeType: "x",
        sizeBytes: 1,
        originalFilename: "x",
      }),
    });
    const res = await handler(req);
    assertEquals(res.status, 403);
  });

  await t.step(
    "Payload-order regression: student with incomplete fields -> 403",
    async () => {
      const req = new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Authorization": "Bearer student" },
        body: JSON.stringify({ action: "request_upload" }),
      });
      const res = await handler(req);
      assertEquals(res.status, 403);
    },
  );

  await t.step(
    "Payload-order regression: sub_admin with incomplete fields -> 400",
    async () => {
      const req = new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Authorization": "Bearer sub_admin" },
        body: JSON.stringify({ action: "request_upload" }),
      });
      const res = await handler(req);
      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error.code, "INVALID_REQUEST");
    },
  );

  await t.step(
    "Authorization: sub_admin reaches payload validation and succeeds",
    async () => {
      rpcCalled = false;
      const req = new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Authorization": "Bearer sub_admin" },
        body: JSON.stringify({
          action: "request_upload",
          lessonId: "x",
          contentType: "x",
          mimeType: "x",
          sizeBytes: 1,
          originalFilename: "x",
        }),
      });
      const res = await handler(req);
      if (res.status === 500) {
        console.log("500 ERROR BODY:", await res.text());
      }
      assertEquals(res.status, 200);
      assertEquals(rpcCalled, true);
    },
  );

  await t.step(
    "Authorization: admin reaches payload validation and succeeds",
    async () => {
      rpcCalled = false;
      const req = new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Authorization": "Bearer admin" },
        body: JSON.stringify({
          action: "request_upload",
          lessonId: "x",
          contentType: "x",
          mimeType: "x",
          sizeBytes: 1,
          originalFilename: "x",
        }),
      });
      const res = await handler(req);
      if (res.status === 500) {
        console.log("500 ERROR BODY:", await res.text());
      }
      assertEquals(res.status, 200);
      assertEquals(rpcCalled, true);
    },
  );

  await t.step(
    "Actor integrity: browser-supplied actor UUID is ignored",
    async () => {
      rpcCalled = false;
      // Supply malformed JSON but an actorId property to try to bypass (though we parse it as payload)
      const req = new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Authorization": "Bearer student" },
        body: JSON.stringify({
          actorId: "mock-admin-id",
          action: "request_upload",
          lessonId: "x",
          contentType: "x",
          mimeType: "x",
          sizeBytes: 1,
          originalFilename: "x",
        }),
      });
      const res = await handler(req);
      assertEquals(res.status, 403);
      assertEquals(rpcCalled, false);
    },
  );

  globalThis.fetch = origFetch;
  for (const key of Object.keys(Deno.env.toObject())) {
    Deno.env.delete(key);
  }
  for (const [key, val] of Object.entries(origEnv)) {
    Deno.env.set(key, val);
  }
});
