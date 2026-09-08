import React from "react";
import { safeDigits } from "@/lib/utils/safeString";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// Register Vietnamese font
Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf",
  fontWeight: "light",
});
Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
  fontWeight: "normal",
});
Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
  fontWeight: "medium",
});
Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
  fontWeight: "bold",
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Roboto",
    fontSize: 9,
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: "#000",
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  headerInfo: {
    textAlign: "right",
    fontSize: 8,
    color: "#666",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#eee",
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
    minHeight: 30,
  },
  tableHeader: {
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "bold",
  },
  tableCol: {
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#eee",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
    justifyContent: "center",
  },
  colNo: { width: "5%" },
  colImage: { width: "12%" },
  colName: { width: "35%" },
  colSize: { width: "10%" },
  colQty: { width: "8%" },
  colPrice: { width: "14%" },
  colTotal: { width: "16%" },
  cellText: {
    textAlign: "center",
  },
  cellTextLeft: {
    textAlign: "left",
  },
  cellTextRight: {
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    borderTop: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 10,
    fontSize: 7,
    color: "#999",
  },
  summary: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginBottom: 5,
  },
  summaryLabel: {
    width: "150pt",
    textAlign: "right",
    paddingRight: 10,
    fontWeight: "bold",
  },
  summaryValue: {
    width: "100pt",
    textAlign: "right",
    fontWeight: "bold",
  },
  totalBox: {
    backgroundColor: "#f9f9f9",
    padding: 8,
    marginTop: 5,
    borderTop: 1,
    borderTopColor: "#000",
  },
});

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function getPdfProductName(it: unknown): string {
  if (!it || typeof it !== "object") return "Sản phẩm";
  const item = it as Record<string, unknown>;
  const candidates = [item.product_name_snapshot, item.product_name, item.name, item.display_name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "Sản phẩm";
}

export function getPdfChannelLabel(it: unknown): string {
  if (!it || typeof it !== "object") return "";
  const item = it as Record<string, unknown>;
  const ch = String(item.channel_snapshot || item.size_type || item.channel || "")
    .trim()
    .toLowerCase();
  if (ch === "salon") return "Chuyên nghiệp";
  if (ch === "retail") return "Niêm yết";
  return "";
}

export function getPdfProductSubtitle(it: unknown): string {
  if (!it || typeof it !== "object") return "";
  const item = it as Record<string, unknown>;
  const parts: string[] = [];

  // Brand
  const brand = String(item.brand_name_snapshot || item.brand_name || item.brand || "").trim();
  if (brand) {
    parts.push(brand.toUpperCase());
  }

  // Channel label
  const channelLabel = getPdfChannelLabel(it);
  if (channelLabel) {
    parts.push(channelLabel);
  }

  // Size / variant
  const size = String(item.size || item.size_label || item.variant_label_snapshot || "").trim();
  if (size) {
    parts.push(size);
  }

  return parts.join(" · ");
}

export interface CatalogPDFItem {
  product_name_snapshot?: string | null;
  product_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  brand_name_snapshot?: string | null;
  brand_name?: string | null;
  brand?: string | null;
  variant_label_snapshot?: string | null;
  channel_snapshot?: "retail" | "salon" | string | null;
  size_type?: "retail" | "salon" | string | null;
  channel?: "retail" | "salon" | string | null;
  size?: string | null;
  size_label?: string | null;
  image_url?: string | null;
  unit_price: number;
  quantity?: number;
  [key: string]: unknown;
}

export interface CatalogPDFProps {
  items: CatalogPDFItem[];
  customerName?: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  orderNo?: string;
  quoterName?: string;
  quoterEmail?: string;
  quoterPhone?: string;
  vatRate?: number;
}

export const CatalogPDF: React.FC<CatalogPDFProps> = ({
  items,
  customerName,
  subtotal,
  vatAmount,
  total,
  orderNo,
  quoterName,
  quoterEmail,
  quoterPhone,
  vatRate = 0.08,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>DESEMBRE VIETNAM</Text>
          <Text style={{ fontSize: 7, marginTop: 2 }}>Premium Skin Care Solutions</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text>QUOTATION #{orderNo}</Text>
          <Text>Ngày lập: {new Date().toLocaleDateString("vi-VN")}</Text>
          <Text>Khách hàng: {customerName || "N/A"}</Text>
        </View>
      </View>

      <Text style={styles.title}>Báo giá sản phẩm / Quotation</Text>

      <View style={styles.table}>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={[styles.tableCol, styles.colNo]}>
            <Text style={styles.cellText}>#</Text>
          </View>
          <View style={[styles.tableCol, styles.colImage]}>
            <Text style={styles.cellText}>Ảnh</Text>
          </View>
          <View style={[styles.tableCol, styles.colName]}>
            <Text style={styles.cellTextLeft}>Sản phẩm / Description</Text>
          </View>
          <View style={[styles.tableCol, styles.colSize]}>
            <Text style={styles.cellText}>Size</Text>
          </View>
          <View style={[styles.tableCol, styles.colQty]}>
            <Text style={styles.cellText}>SL</Text>
          </View>
          <View style={[styles.tableCol, styles.colPrice]}>
            <Text style={styles.cellTextRight}>Đơn giá</Text>
          </View>
          <View style={[styles.tableCol, styles.colTotal]}>
            <Text style={styles.cellTextRight}>Thành tiền</Text>
          </View>
        </View>

        {/* Rows */}
        {items.map((it, idx) => {
          const productName = getPdfProductName(it);
          const subtitle = getPdfProductSubtitle(it);
          const quantity = it.quantity ?? 1;
          const lineTotal = it.unit_price * quantity;

          return (
            <View key={idx} style={styles.tableRow}>
              <View style={[styles.tableCol, styles.colNo]}>
                <Text style={styles.cellText}>{idx + 1}</Text>
              </View>
              <View style={[styles.tableCol, styles.colImage]}>
                {it.image_url ? (
                  <Image
                    src={it.image_url}
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "cover",
                      alignSelf: "center",
                      borderRadius: 4,
                    }}
                  />
                ) : (
                  <Text style={{ fontSize: 6, color: "#ccc", textAlign: "center", marginTop: 12 }}>
                    NO IMG
                  </Text>
                )}
              </View>
              <View style={[styles.tableCol, styles.colName]}>
                <Text style={[styles.cellTextLeft, { fontWeight: "bold" }]}>{productName}</Text>
                {subtitle ? (
                  <Text style={{ fontSize: 6, color: "#666", marginTop: 2 }}>{subtitle}</Text>
                ) : null}
              </View>
              <View style={[styles.tableCol, styles.colSize]}>
                <Text style={styles.cellText}>{it.size || "-"}</Text>
              </View>
              <View style={[styles.tableCol, styles.colQty]}>
                <Text style={styles.cellText}>{quantity}</Text>
              </View>
              <View style={[styles.tableCol, styles.colPrice]}>
                <Text style={styles.cellTextRight}>{fmt(it.unit_price)}</Text>
              </View>
              <View style={[styles.tableCol, styles.colTotal]}>
                <Text style={styles.cellTextRight}>{fmt(lineTotal)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tạm tính (Sub-total):</Text>
          <Text style={styles.summaryValue}>{fmt(subtotal)}</Text>
        </View>
        {vatAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: "#e67e22" }]}>
              Thuế VAT ({Math.round(vatRate * 100)}%):
            </Text>
            <Text style={[styles.summaryValue, { color: "#e67e22" }]}>+{fmt(vatAmount)}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalBox]}>
          <Text style={[styles.summaryLabel, { fontSize: 12 }]}>TỔNG CỘNG (TOTAL):</Text>
          <Text style={[styles.summaryValue, { fontSize: 12 }]}>{fmt(total)} VNĐ</Text>
        </View>
      </View>

      <View style={{ marginTop: 40, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ width: "40%", textAlign: "center" }}>
          <Text style={{ fontWeight: "bold" }}>NGƯỜI LẬP BÁO GIÁ</Text>
          <Text style={{ fontSize: 8, marginTop: 4, fontWeight: "bold" }}>{quoterName}</Text>
          {quoterPhone && (
            <Text style={{ fontSize: 7, marginTop: 2, color: "#666" }}>{quoterPhone}</Text>
          )}
          {quoterEmail && (
            <Text style={{ fontSize: 7, marginTop: 2, color: "#666" }}>{quoterEmail}</Text>
          )}
          {quoterPhone && (
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://zalo.me/${safeDigits(quoterPhone)}`}
              style={{ width: 40, height: 40, alignSelf: "center", marginTop: 10 }}
            />
          )}
          {quoterPhone && (
            <Text style={{ fontSize: 6, marginTop: 2, color: "#999" }}>Quét mã để nhắn Zalo</Text>
          )}
        </View>
        <View style={{ width: "40%", textAlign: "center" }}>
          <Text style={{ fontWeight: "bold" }}>XÁC NHẬN KHÁCH HÀNG</Text>
          <Text style={{ fontSize: 7, marginTop: 4 }}>(Ký và ghi rõ họ tên)</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Desembre Vietnam - Quality is our priority. Cảm ơn quý khách đã tin tưởng sử dụng sản phẩm.
      </Text>
    </Page>
  </Document>
);
