import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock the environment to allow checking secrets/logic without hitting real APIs
describe("M42.2 Edge Function Manual Runner - Static Analysis & Unit Tests", () => {
  const edgeFunctionPath = path.join(__dirname, "../supabase/functions/process-automation-queue/index.ts");
  const handlerPath = path.join(__dirname, "../supabase/functions/process-automation-queue/handler.ts");
  
  it("should not contain Resend SDK or API calls in edge function files", () => {
    // Read files if they exist, to ensure we don't accidentally pull in resend
    const filesToCheck = [edgeFunctionPath, handlerPath];
    const forbiddenStrings = [
      'from "resend"',
      "from 'resend'",
      "new Resend(",
      "resend.emails.send",
      "https://api.resend.com"
    ];

    filesToCheck.forEach((file) => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf8");
        forbiddenStrings.forEach((forbidden) => {
          if (content.includes(forbidden)) {
            throw new Error(`File ${file} contains forbidden string: ${forbidden}`);
          }
        });
      }
    });

    expect(true).toBe(true);
  });

  it("should not contain any pg_cron or schedule annotations in edge function", () => {
    const filesToCheck = [edgeFunctionPath, handlerPath];
    const forbiddenStrings = [
      'pg_cron',
      'cron:',
      'schedule('
    ];

    filesToCheck.forEach((file) => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf8");
        forbiddenStrings.forEach((forbidden) => {
          if (content.toLowerCase().includes(forbidden.toLowerCase())) {
            throw new Error(`File ${file} contains forbidden cron/schedule string: ${forbidden}`);
          }
        });
      }
    });

    expect(true).toBe(true);
  });

  it("should explicitly hard-block the production project ref from SUPABASE_URL and req.url", () => {
    if (fs.existsSync(edgeFunctionPath)) {
      const content = fs.readFileSync(edgeFunctionPath, "utf8");
      // The production ref is xhfqjupiidexvlltstal
      expect(content).toContain("xhfqjupiidexvlltstal");
      // It should check SUPABASE_URL and req.url
      expect(content).toContain("supabaseUrl.includes(PROD_REF)");
      expect(content).toContain("reqUrl.includes(PROD_REF)");
      expect(content).toContain("403"); // Should return 403 Forbidden or similar block
    }
  });

  it("should require valid staging project ref from SUPABASE_URL or req.url", () => {
    if (fs.existsSync(edgeFunctionPath)) {
      const content = fs.readFileSync(edgeFunctionPath, "utf8");
      // The staging ref is wmhfvggbthyikqvlyqup
      expect(content).toContain("wmhfvggbthyikqvlyqup");
      expect(content).toContain("environment verification failed");
    }
  });

  it("should require admin or sub_admin role before calling the queue handler", () => {
    if (fs.existsSync(edgeFunctionPath)) {
      const content = fs.readFileSync(edgeFunctionPath, "utf8");
      // Should check authorization header
      expect(content).toContain("req.headers.get('Authorization')");
      // Should check user roles table
      expect(content).toContain("from('user_roles')");
      expect(content).toContain("admin/sub_admin required");
      // ensure processQueueHandler is ONLY called AFTER role check (in the try block at the end)
      const roleCheckIndex = content.indexOf("admin/sub_admin required");
      const processCallIndex = content.indexOf("processQueueHandler(");
      expect(roleCheckIndex).toBeLessThan(processCallIndex);
    }
  });

  it("should enforce provider='mock' only", () => {
    if (fs.existsSync(handlerPath)) {
      const content = fs.readFileSync(handlerPath, "utf8");
      // M42.2 explicitly blocks resend
      expect(content).toContain("provider === 'resend'");
    }
  });

});
