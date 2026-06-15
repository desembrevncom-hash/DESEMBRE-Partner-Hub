export function TemplateMappingModal({ accountId, onClose }: { accountId: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
        <h3 className="text-lg font-bold mb-4">Cấu hình Mapping Template</h3>
        <p className="text-sm text-slate-500 mb-6">Tính năng cấu hình tham số động đang được phát triển ở M6.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold">Đóng</button>
        </div>
      </div>
    </div>
  );
}
