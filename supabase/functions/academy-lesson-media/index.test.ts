import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { handleRequest, AppEnv } from "./index.ts";

const mockAppEnv = (overrides?: Partial<AppEnv>): AppEnv => ({
  getEnv: (key) => {
    if (key === "ACADEMY_ALLOWED_ORIGINS") return "http://localhost:3000,http://localhost:8080";
    if (key === "SUPABASE_URL") return "http://mock";
    if (key === "SUPABASE_ANON_KEY") return "mock-anon";
    if (key === "SUPABASE_SERVICE_ROLE_KEY") return "mock-service";
    return undefined;
  },
  createClient: () => ({
    rpc: async (fn: string) => {
      if (fn === "get_academy_lesson_content") {
        return { data: { state: "AVAILABLE", content: { kind: "video", media_ref: "media-uuid" } } };
      }
      if (fn === "get_academy_lesson_media_locator") {
        return { data: { bucket: "academy-content", path: "test.mp4" } };
      }
      return { data: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "http://signed" } }),
      }),
    },
  }) as any,
  ...overrides,
});

const makeReq = (method: string, body?: any, headers: Record<string, string> = {}) => {
  return new Request("http://localhost", {
    method,
    headers: new Headers({
      "Origin": "http://localhost:3000",
      "Authorization": "Bearer mock-token",
      ...headers,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
};

Deno.test("1. OPTIONS request returns allowed CORS response", async () => {
  const res = await handleRequest(makeReq("OPTIONS"), mockAppEnv());
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
});

Deno.test("2. disallowed origin is rejected or receives no allow-origin header", async () => {
  const req = new Request("http://localhost", { method: "OPTIONS", headers: { Origin: "http://hacker.com" } });
  const res = await handleRequest(req, mockAppEnv());
  assertEquals(res.status, 403);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("3. missing Authorization returns 401", async () => {
  const req = makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" });
  req.headers.delete("Authorization");
  const res = await handleRequest(req, mockAppEnv());
  assertEquals(res.status, 401);
});

Deno.test("4. malformed Bearer token is rejected", async () => {
  const req = makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }, { "Authorization": "Basic 123" });
  const res = await handleRequest(req, mockAppEnv());
  assertEquals(res.status, 401);
});

Deno.test("5. malformed JSON returns 400", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { Origin: "http://localhost:3000", Authorization: "Bearer tok" },
    body: "{ bad json",
  });
  const res = await handleRequest(req, mockAppEnv());
  assertEquals(res.status, 400);
});

Deno.test("6. missing courseSlug rejected", async () => {
  const res = await handleRequest(makeReq("POST", { lessonId: "00000000-0000-0000-0000-000000000000" }), mockAppEnv());
  assertEquals(res.status, 400);
});

Deno.test("7. malformed lessonId rejected", async () => {
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "bad-uuid" }), mockAppEnv());
  assertEquals(res.status, 400);
});

Deno.test("8, 9, 10, 11, 12, 13, 14, 15, 16, 17. Edge cases", async () => {
  let userRpcCalled = false;
  let adminRpcCalled = false;
  let providedTtl = 0;

  const env = mockAppEnv({
    createClient: (url, key) => {
      const isServiceRole = key === "mock-service";
      return {
        rpc: async (fn: string) => {
          if (fn === "get_academy_lesson_content" && !isServiceRole) {
            userRpcCalled = true;
            return { data: { state: "AVAILABLE", content: { kind: "video", media_ref: "correct-ref" } } };
          }
          if (fn === "get_academy_lesson_media_locator" && isServiceRole) {
            adminRpcCalled = true;
            return { data: { bucket: "correct-bucket", path: "correct-path" } };
          }
          return { data: null };
        },
        storage: {
          from: (bucket: string) => ({
            createSignedUrl: async (path: string, ttl: number) => {
              providedTtl = ttl;
              return { data: { signedUrl: "http://signed" } };
            },
          }),
        },
      } as any;
    },
  });

  const body = {
    courseSlug: "c",
    lessonId: "00000000-0000-0000-0000-000000000000",
    contentId: "fake",
    bucket: "fake",
    path: "fake",
    expiresIn: 9999
  };

  const res = await handleRequest(makeReq("POST", body), env);
  assertEquals(res.status, 200);
  assertEquals(userRpcCalled, true);
  assertEquals(adminRpcCalled, true);
  assertEquals(providedTtl, 300);
});

Deno.test("18. locator error is sanitized", async () => {
  const env = mockAppEnv({
    createClient: () => ({
      rpc: async (fn: string) => {
        if (fn === "get_academy_lesson_content") return { data: { state: "AVAILABLE", content: { kind: "video", media_ref: "media-uuid" } } };
        if (fn === "get_academy_lesson_media_locator") return { error: new Error("Secret DB Error") };
        return { data: null };
      },
      storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "http://signed" } }) }) },
    }) as any,
  });
  const consoleError = console.error;
  let logged = "";
  console.error = (msg: string) => logged += msg;
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }), env);
  console.error = consoleError;
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "Internal server error fetching media");
  assertEquals(logged.includes("Secret DB Error"), false);
});

Deno.test("19. signing error is sanitized", async () => {
  const env = mockAppEnv({
    createClient: () => ({
      rpc: async (fn: string) => {
        if (fn === "get_academy_lesson_content") return { data: { state: "AVAILABLE", content: { kind: "video", media_ref: "media-uuid" } } };
        if (fn === "get_academy_lesson_media_locator") return { data: { bucket: "b", path: "p" } };
        return { data: null };
      },
      storage: { from: () => ({ createSignedUrl: async () => ({ error: new Error("Secret Sign Error") }) }) },
    }) as any,
  });
  const consoleError = console.error;
  let logged = "";
  console.error = (msg: string) => logged += msg;
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }), env);
  console.error = consoleError;
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "Internal server error signing media");
  assertEquals(logged.includes("Secret Sign Error"), false);
});

Deno.test("21. response does not include storage path", async () => {
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }), mockAppEnv());
  const data = await res.json();
  assertEquals(data.path, undefined);
  assertEquals(data.bucket, undefined);
  assertEquals(data.signed_url, "http://signed");
});

Deno.test("13. non-AVAILABLE lesson denied", async () => {
  const env = mockAppEnv({
    createClient: () => ({ rpc: async () => ({ data: { state: "ACCESS_DENIED" } }), storage: {} as any }) as any,
  });
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }), env);
  assertEquals(res.status, 403);
});

Deno.test("14. article content cannot request media signing", async () => {
  const env = mockAppEnv({
    createClient: () => ({ rpc: async () => ({ data: { state: "AVAILABLE", content: { kind: "article" } } }), storage: {} as any }) as any,
  });
  const res = await handleRequest(makeReq("POST", { courseSlug: "c", lessonId: "00000000-0000-0000-0000-000000000000" }), env);
  assertEquals(res.status, 400);
});

Deno.test("CORS: missing allowlist fails closed", async () => {
  const env = mockAppEnv({
    getEnv: () => undefined,
  });
  const req = new Request("http://localhost", { method: "OPTIONS", headers: { Origin: "http://localhost:3000" } });
  const res = await handleRequest(req, env);
  assertEquals(res.status, 403);
});

Deno.test("CORS: whitespace normalization", async () => {
  const env = mockAppEnv({
    getEnv: (key) => key === "ACADEMY_ALLOWED_ORIGINS" ? " http://localhost:3000 , http://localhost:8080 " : undefined,
  });
  const req = new Request("http://localhost", { method: "OPTIONS", headers: { Origin: "http://localhost:3000" } });
  const res = await handleRequest(req, env);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
});
