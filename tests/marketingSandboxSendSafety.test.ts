import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx")) {
        arrayOfFiles.push(path.join(__dirname, "../", dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

describe("Marketing Sandbox Send Safety", () => {
  it("should not contain any provider secret access or Resend SDK in frontend files", () => {
    const srcPath = "src";
    const files = getAllFiles(srcPath);

    const forbiddenStrings = [
      'from "resend"',
      "from 'resend'",
      "new Resend(",
      "resend.emails.send",
      "Deno.env",
      "process.env.RESEND_API_KEY",
      "process.env.RESEND_FROM_EMAIL",
      "process.env.RESEND_SANDBOX_TO_ALLOWLIST",
      "import.meta.env.RESEND_API_KEY",
      "import.meta.env.RESEND_FROM_EMAIL",
      "import.meta.env.RESEND_SANDBOX_TO_ALLOWLIST",
    ];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf8");
      forbiddenStrings.forEach((forbidden) => {
        if (content.includes(forbidden)) {
          throw new Error(`File ${file} contains forbidden string: ${forbidden}`);
        }
      });
    });

    expect(true).toBe(true);
  });

  it("should not introduce new unauthorized sandbox statuses in Edge Function", () => {
    const efPath = path.join(__dirname, "../supabase/functions/marketing-sandbox-send/index.ts");
    const content = fs.readFileSync(efPath, "utf8");

    const forbiddenStatuses = [
      "status: 'sandbox_sent'",
      'status: "sandbox_sent"',
      "status: 'sandbox_failed'",
      'status: "sandbox_failed"',
      "status: 'sandbox_blocked'",
      'status: "sandbox_blocked"',
    ];

    forbiddenStatuses.forEach((forbidden) => {
      if (content.includes(forbidden)) {
        throw new Error(`Edge Function contains forbidden status assignment: ${forbidden}`);
      }
    });

    expect(true).toBe(true);
  });
});

