/**
 * ProductCatalogDebugConsole — Task 11
 * Shown only in DEV mode for managers.
 * Condition: import.meta.env.DEV && isManager
 */

interface Props {
  isCatalogDbReadEnabled: boolean;
  isDbAdminEnabled: boolean;
  isProductDbOrderEnabled: boolean;
  isUsingDbCatalogData: boolean;
  userEmail?: string;
  roles: string[];
  isAdmin: boolean;
  isManager: boolean;
  dbError: boolean;
  dbErrorMessage: string | null;
}

export function ProductCatalogDebugConsole({
  isCatalogDbReadEnabled,
  isDbAdminEnabled,
  isProductDbOrderEnabled,
  isUsingDbCatalogData,
  userEmail,
  roles,
  isAdmin,
  isManager,
  dbError,
  dbErrorMessage,
}: Props) {
  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-slate-900/95 text-slate-100 p-4 rounded-xl border border-slate-700 shadow-2xl text-[11px] font-mono space-y-1.5 max-w-sm backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
        <span className="font-bold text-indigo-400">🔍 STAGING DEBUG CONSOLE</span>
        <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
          47310e8
        </span>
      </div>
      <div>
        <span className="text-slate-400">catalogDbReadEnabled:</span>{" "}
        <span
          className={
            isCatalogDbReadEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"
          }
        >
          {isCatalogDbReadEnabled ? "true" : "false"}
        </span>{" "}
        <span className="text-slate-500 font-normal">
          ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_CATALOG_DB_READ_ENABLED)}`})
        </span>
      </div>
      <div>
        <span className="text-slate-400">productDbAdminEnabled:</span>{" "}
        <span className={isDbAdminEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>
          {isDbAdminEnabled ? "true" : "false"}
        </span>{" "}
        <span className="text-slate-500 font-normal">
          ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_DB_ADMIN_ENABLED)}`})
        </span>
      </div>
      <div>
        <span className="text-slate-400">productDbOrderEnabled:</span>{" "}
        <span
          className={
            isProductDbOrderEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"
          }
        >
          {isProductDbOrderEnabled ? "true" : "false"}
        </span>{" "}
        <span className="text-slate-500 font-normal">
          ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_DB_ORDER_ENABLED)}`})
        </span>
      </div>
      <div>
        <span className="text-slate-400">userEmail:</span>{" "}
        <span className="text-blue-400">{userEmail || "none"}</span>
      </div>
      <div>
        <span className="text-slate-400">userRoles:</span>{" "}
        <span className="text-blue-400">{JSON.stringify(roles || [])}</span>
      </div>
      <div>
        <span className="text-slate-400">isAdmin:</span>{" "}
        <span className={isAdmin ? "text-green-400 font-bold" : "text-rose-400"}>
          {isAdmin ? "true" : "false"}
        </span>
      </div>
      <div>
        <span className="text-slate-400">isManager:</span>{" "}
        <span className={isManager ? "text-green-400 font-bold" : "text-rose-400"}>
          {isManager ? "true" : "false"}
        </span>
      </div>
      <div>
        <span className="text-slate-400">usingCatalogDbMode:</span>{" "}
        <span
          className={isUsingDbCatalogData ? "text-green-400 font-bold" : "text-rose-400 font-bold"}
        >
          {isUsingDbCatalogData ? "true" : "false"}
        </span>
      </div>
      {dbError && (
        <div className="text-rose-300 bg-rose-950/50 p-2 rounded border border-rose-900 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-[9px] leading-relaxed">
          <span className="font-bold">Error:</span> {dbErrorMessage || "Unknown DB fetch error"}
        </div>
      )}
    </div>
  );
}
