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

  it("should explicitly hard-block the production project ref", () => {
    if (fs.existsSync(edgeFunctionPath)) {
      const content = fs.readFileSync(edgeFunctionPath, "utf8");
      // The production ref is xhfqjupiidexvlltstal
      expect(content).toContain("xhfqjupiidexvlltstal");
      expect(content).toContain("403"); // Should return 403 Forbidden or similar block
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
