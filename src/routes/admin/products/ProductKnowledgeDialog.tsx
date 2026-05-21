// src/routes/admin/products/ProductKnowledgeDialog.tsx
// Premium UI Dialog for managing Product Knowledge QA Workflow
// Integrated into /admin/products as a drawer/dialog "Cập nhật Tri thức"

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, TextField, Typography, Divider, Box } from "@mui/material"; // Assuming MUI is available in the project

// Supabase client (service role for admin actions)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Types
interface ProductKnowledge {
  id: string;
  name: string;
  qa_status: "draft" | "review" | "approved" | "archived";
  approved_by?: string | null;
  approved_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  knowledge_version?: number;
  status_reason_type?: string;
  note?: string;
}

interface StatusChangeLog {
  id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  note: string;
  status_reason_type: string;
  created_at: string;
}

// Helper to fetch product knowledge record
async function fetchProductKnowledge(id: string): Promise<ProductKnowledge | null> {
  const { data, error } = await supabaseAdmin
    .from("product_knowledge")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to fetch product knowledge:", error);
    return null;
  }
  return data as ProductKnowledge;
}

// Helper to fetch audit logs
async function fetchStatusChanges(productId: string): Promise<StatusChangeLog[]> {
  const { data, error } = await supabaseAdmin
    .from("product_knowledge_status_changes")
    .select("*", { order: "created_at", ascending: false })
    .eq("product_knowledge_id", productId);
  if (error) {
    console.error("Failed to fetch status changes:", error);
    return [];
  }
  return data as StatusChangeLog[];
}

// Helper to update status via RPC
async function updateStatus(
  productId: string,
  newStatus: string,
  note: string,
  reasonType: string
) {
  const { data, error } = await supabaseAdmin.rpc("update_product_knowledge_status", {
    pk_id: productId,
    new_status: newStatus,
    note: note,
    reason_type: reasonType,
  });
  if (error) throw error;
  return data;
}

// Main Dialog component
export const ProductKnowledgeDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  productId: string;
}> = ({ open, onClose, productId }) => {
  const [product, setProduct] = useState<ProductKnowledge | null>(null);
  const [logs, setLogs] = useState<StatusChangeLog[]>([]);
  const [newStatus, setNewStatus] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [reasonType, setReasonType] = useState<string>("content_update");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Load initially
  useEffect(() => {
    if (open && productId) {
      (async () => {
        const pk = await fetchProductKnowledge(productId);
        setProduct(pk);
        setNewStatus(pk?.qa_status ?? "draft");
        const audit = await fetchStatusChanges(productId);
        setLogs(audit);
      })();
    }
  }, [open, productId]);

  const handleSave = async () => {
    if (!product) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await updateStatus(product.id, newStatus, note, reasonType);
      // Refresh data
      const pk = await fetchProductKnowledge(product.id);
      setProduct(pk);
      const audit = await fetchStatusChanges(product.id);
      setLogs(audit);
      setNote("");
    } catch (e: any) {
      setErrorMsg(e.message || "Lỗi cập nhật trạng thái");
    } finally {
      setLoading(false);
    }
  };

  // AI Context Preview – fetch relevant chunks (approved & active)
  const [previewChunks, setPreviewChunks] = useState<any[]>([]);
  useEffect(() => {
    if (product && product.qa_status === "approved") {
      (async () => {
        const { data, error } = await supabaseAdmin.rpc("match_product_chunks", {
          product_knowledge_id: product.id,
        });
        if (!error) setPreviewChunks(data as any[]);
      })();
    }
  }, [product]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Cập nhật Tri thức - {product?.name ?? "Loading..."}</DialogTitle>
      <DialogContent dividers>
        {/* QA Status Section */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Trạng thái QA
          </Typography>
          <Select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as string)}
            fullWidth
            variant="outlined"
          >
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="review">Review</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />
          <Select
            label="Loại lý do"
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value as string)}
            fullWidth
            variant="outlined"
          >
            <MenuItem value="content_update">Cập nhật nội dung</MenuItem>
            <MenuItem value="medical_claim_risk">Rủi ro claim y khoa</MenuItem>
            <MenuItem value="missing_information">Thiếu thông tin</MenuItem>
            <MenuItem value="awaiting_review">Chờ duyệt</MenuItem>
            <MenuItem value="deprecated_product">Sản phẩm lỗi thời</MenuItem>
            <MenuItem value="compliance_issue">Vấn đề tuân thủ</MenuItem>
            <MenuItem value="other">Khác</MenuItem>
          </Select>
        </Box>
        {/* Audit Log */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Lịch sử thay đổi trạng thái
          </Typography>
          {logs.length === 0 && <Typography>Không có lịch sử.</Typography>}
          {logs.map((log) => (
            <Box key={log.id} mb={1} p={1} sx={{ border: "1px solid #e0e0e0", borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>{log.from_status} → {log.to_status}</strong> bởi {log.changed_by} vào {new Date(log.created_at).toLocaleString()}
              </Typography>
              <Typography variant="caption">Lý do: {log.status_reason_type} – {log.note}</Typography>
            </Box>
          ))}
        </Box>
        {/* AI Context Preview */}
        {product?.qa_status === "approved" && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              AI Context Preview
            </Typography>
            <Divider />
            {previewChunks.length === 0 && <Typography>Không có chunk nào.</Typography>}
            {previewChunks.slice(0, 5).map((c, idx) => (
              <Box key={c.id} mt={2} p={2} sx={{ background: "#f9f9f9", borderRadius: 2 }}>
                <Typography variant="subtitle2">Chunk {idx + 1} - {c.chunk_type}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{c.content}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {errorMsg && <Typography color="error">{errorMsg}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Đóng</Button>
        <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Lưu thay đổi"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductKnowledgeDialog;
