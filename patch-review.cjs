const fs = require('fs');

// 1. Update API
let apiCode = fs.readFileSync('src/lib/customers/facebookIdentityApi.ts', 'utf8');

apiCode = apiCode.replace(
  "status: 'pending' | 'resolved' | 'failed' | 'manual_review_required';",
  "status: 'pending' | 'resolved' | 'failed' | 'manual_review_required' | 'duplicate_candidate' | 'ignored';"
);

apiCode = apiCode.replace(
  "auto_resolve_status?: 'not_attempted' | 'queued' | 'resolving' | 'resolved' | 'failed' | 'timeout' | 'rate_limited' | 'disabled' | 'cached';",
  "auto_resolve_status?: 'not_attempted' | 'queued' | 'resolving' | 'resolved' | 'failed' | 'timeout' | 'rate_limited' | 'disabled' | 'cached' | 'skipped_invalid_type' | 'duplicate_detected';\\n  duplicate_social_profile_id?: string | null;"
);

apiCode = apiCode.replace(
  "last_auto_resolve_error,\n          customers (",
  "last_auto_resolve_error,\n          duplicate_social_profile_id,\n          customers ("
);

apiCode = apiCode.replace(
  '.eq("status", "manual_review_required")',
  '.in("status", ["manual_review_required", "duplicate_candidate"])'
);

apiCode = apiCode.replace(
  "status: 'resolved' | 'failed';",
  "status: 'resolved' | 'failed' | 'ignored' | 'duplicate_candidate';"
);

fs.writeFileSync('src/lib/customers/facebookIdentityApi.ts', apiCode);

// 2. Update UI
let uiCode = fs.readFileSync('src/routes/admin/identity-resolution/-components/ManualReviewQueue.tsx', 'utf8');

const autoStatusReplace = `      case "disabled":
        color = "bg-slate-50 text-slate-500 border-slate-200";
        Icon = XCircle;
        label = "Tính năng tự động đang tắt";
        break;
    }`;

const autoStatusNew = `      case "disabled":
        color = "bg-slate-50 text-slate-500 border-slate-200";
        Icon = XCircle;
        label = "Tính năng tự động đang tắt";
        break;
      case "skipped_invalid_type":
        color = "bg-amber-50 text-amber-600 border-amber-200";
        Icon = AlertCircle;
        label = "Bỏ qua do loại link không hỗ trợ";
        break;
      case "duplicate_detected":
        color = "bg-rose-50 text-rose-600 border-rose-200";
        Icon = AlertTriangle;
        label = "Phát hiện trùng lặp UID";
        break;
    }`;

uiCode = uiCode.replace(autoStatusReplace, autoStatusNew);

const renderResolveTarget = `            <button
              onClick={handleFail}
              disabled={resolveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 px-3 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <AlertCircle className="w-3 h-3" /> Đánh dấu lỗi
            </button>
          </div>
        </div>
      </td>`;

const renderResolveNew = `            <button
              onClick={handleFail}
              disabled={resolveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 px-3 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <AlertCircle className="w-3 h-3" /> Đánh dấu lỗi
            </button>
          </div>
          {(job.status === 'duplicate_candidate' || job.auto_resolve_status === 'duplicate_detected') && (
            <div className="mt-2 bg-rose-50 border border-rose-200 p-2 rounded text-xs text-rose-700">
              <div className="flex items-start gap-1 font-bold mb-1">
                <AlertTriangle className="w-3 h-3 mt-0.5" /> Phát hiện trùng lặp UID!
              </div>
              <div>Bạn cần xem xét thủ công hoặc mở khách cũ để gộp thông tin.</div>
            </div>
          )}
        </div>
      </td>`;

uiCode = uiCode.replace(renderResolveTarget, renderResolveNew);

fs.writeFileSync('src/routes/admin/identity-resolution/-components/ManualReviewQueue.tsx', uiCode);
console.log("Patched ManualReviewQueue and API successfully.");
