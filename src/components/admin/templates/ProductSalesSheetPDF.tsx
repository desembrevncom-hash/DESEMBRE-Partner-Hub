import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// Register Roboto fonts for Vietnamese unicode character support
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
    padding: 24,
    fontFamily: "Roboto",
    fontSize: 8,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "#1e3a8a",
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    alignSelf: "flex-start",
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#1e3a8a",
    textTransform: "uppercase",
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  subHeader: {
    fontSize: 7.5,
    color: "#64748b",
  },
  brandNameHighlight: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
  headerRight: {
    textAlign: "right",
    alignItems: "flex-end",
  },
  brandLogo: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e3a8a",
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 6,
    color: "#94a3b8",
    textTransform: "uppercase",
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  columns: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  leftCol: {
    width: "38%",
  },
  rightCol: {
    width: "59%",
  },
  imageCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    height: 135,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  productImage: {
    maxWidth: "100%",
    maxHeight: 120,
    objectFit: "contain",
  },
  noImageText: {
    fontSize: 7.5,
    color: "#94a3b8",
  },
  pricingCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  pricingTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 4,
    marginBottom: 6,
  },
  pricingTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e3a8a",
    textTransform: "uppercase",
  },
  currencyUnit: {
    fontSize: 7,
    color: "#64748b",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
    marginBottom: 3,
  },
  thChannel: {
    width: "32%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
  },
  thSize: {
    width: "33%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    textAlign: "center",
  },
  thPrice: {
    width: "35%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f8fafc",
    alignItems: "center",
  },
  tdChannel: {
    width: "32%",
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1e3a8a",
    textTransform: "uppercase",
  },
  tdSize: {
    width: "33%",
    fontSize: 7,
    color: "#334155",
    textAlign: "center",
  },
  tdPrice: {
    width: "35%",
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "right",
  },
  emptyPricingText: {
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 6,
  },
  quoteBox: {
    backgroundColor: "#eff6ff",
    borderLeftWidth: 3,
    borderLeftColor: "#1e3a8a",
    borderRadius: 4,
    padding: 7,
    marginBottom: 7,
  },
  quoteText: {
    fontSize: 7.5,
    color: "#1e3a8a",
    lineHeight: 1.3,
  },
  section: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e3a8a",
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  bulletList: {
    paddingLeft: 2,
  },
  bulletItem: {
    fontSize: 7,
    color: "#334155",
    marginBottom: 1.5,
    lineHeight: 1.3,
  },
  fullIngredientsText: {
    fontSize: 6.5,
    color: "#475569",
    lineHeight: 1.25,
  },
  warningBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fee2e2",
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginTop: 3,
  },
  warningTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#dc2626",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  warningText: {
    fontSize: 6.5,
    color: "#7f1d1d",
    lineHeight: 1.25,
  },
  internalNotesBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fef3c7",
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
  internalNotesTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#d97706",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  internalNotesText: {
    fontSize: 6.5,
    color: "#78350f",
    lineHeight: 1.25,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "#94a3b8",
  },
});

import type { SalesSheetViewModel } from "@/lib/salesSheetViewModel";

export interface ProductSalesSheetPdfData {
  product: {
    name: string;
    brand_name?: string;
    category_name?: string;
    short_description?: string;
    image_url?: string;
  };
  variants?: Array<{
    channel: string;
    size_label: string;
    price: string;
  }>;
  knowledge?: {
    benefits?: string[] | string;
    key_ingredients?: string[] | string;
    ingredient_highlights?: string[] | string;
    show_ingredient_highlights?: boolean;
    full_ingredients?: string;
    skin_types?: string[] | string;
    usage?: string[] | string;
    warnings?: string[] | string;
    sales_notes?: string[] | string;
  };
  benefits?: string[];
  ingredients?: string[];
  full_ingredients?: string;
  skin_types?: string[];
  usageInstructions?: string[];
  warnings?: string[];
  sales_notes?: string[];
  footer_note?: string;
  generated_at?: string;
  audience?: "customer" | "internal";
  hideBrandLogo?: boolean;
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (typeof val === "string" && val.trim() !== "" && val.trim() !== "Chưa có thông tin trong tài liệu nguồn.") {
    return val
      .split("\n")
      .map((line) => line.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function ProductSalesSheetPDF({
  data,
}: {
  data: ProductSalesSheetPdfData | SalesSheetViewModel;
}) {
  const audience = data.audience || "customer";
  const isCustomer = audience === "customer";
  const hideBrandLogo = data.hideBrandLogo ?? false;
  const footer_note = data.footer_note;
  const generated_at = data.generated_at;

  const product = {
    name: data.product.name,
    brand_name: data.product.brand_name || "Desembre",
    category_name: data.product.category_name || "Mỹ phẩm",
    short_description: data.product.short_description || "",
    image_url: data.product.image_url || "",
  };

  const variants = data.variants || [];

  // Extract list fields cleanly whether passed as SalesSheetViewModel or legacy ProductSalesSheetPdfData
  const benefitsList = "benefits" in data && Array.isArray(data.benefits)
    ? toArray(data.benefits)
    : toArray(data.knowledge?.benefits);

  const ingredientsList = "ingredients" in data && Array.isArray(data.ingredients)
    ? toArray(data.ingredients)
    : toArray(data.knowledge?.key_ingredients);

  const fullIngredients = !isCustomer
    ? ("full_ingredients" in data ? data.full_ingredients : data.knowledge?.full_ingredients) || ""
    : "";

  const skinTypesList = "skin_types" in data && Array.isArray(data.skin_types)
    ? toArray(data.skin_types)
    : toArray(data.knowledge?.skin_types);

  const usageList = "usageInstructions" in data && Array.isArray(data.usageInstructions)
    ? toArray(data.usageInstructions)
    : toArray(data.knowledge?.usage);

  const warningsList = "warnings" in data && Array.isArray(data.warnings)
    ? toArray(data.warnings)
    : toArray(data.knowledge?.warnings);

  const salesNotesList = !isCustomer
    ? ("sales_notes" in data && Array.isArray(data.sales_notes)
        ? toArray(data.sales_notes)
        : toArray(data.knowledge?.sales_notes))
    : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>THÔNG TIN SẢN PHẨM</Text>
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.subHeader}>
              Thương hiệu:{" "}
              <Text style={styles.brandNameHighlight}>{product.brand_name || "Desembre"}</Text> |
              Danh mục: {product.category_name || "Chưa rõ"}
            </Text>
          </View>
          {!hideBrandLogo && (
            <View style={styles.headerRight}>
              <Text style={styles.brandLogo}>DESEMBRE</Text>
              <Text style={styles.brandSub}>LUXURY COSMETICS</Text>
            </View>
          )}
        </View>

        {/* Content Structure */}
        <View style={styles.columns}>
          {/* Left Column: Image & Pricing */}
          <View style={styles.leftCol}>
            <View style={styles.imageCard}>
              {product.image_url ? (
                <Image src={product.image_url} style={styles.productImage} />
              ) : (
                <Text style={styles.noImageText}>Không có hình ảnh</Text>
              )}
            </View>

            <View style={styles.pricingCard}>
              <View style={styles.pricingTitleRow}>
                <Text style={styles.pricingTitle}>BẢNG GIÁ SẢN PHẨM</Text>
                <Text style={styles.currencyUnit}>VND</Text>
              </View>

              {variants.length > 0 ? (
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={styles.thChannel}>Kênh</Text>
                    <Text style={styles.thSize}>Quy cách</Text>
                    <Text style={styles.thPrice}>Giá niêm yết</Text>
                  </View>
                  {variants.map((v, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={styles.tdChannel}>{v.channel}</Text>
                      <Text style={styles.tdSize}>{v.size_label}</Text>
                      <Text style={styles.tdPrice}>{v.price}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyPricingText}>Chưa có bảng giá đã duyệt.</Text>
              )}
            </View>
          </View>

          {/* Right Column: Knowledge Base */}
          <View style={styles.rightCol}>
            {product.short_description ? (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>{product.short_description}</Text>
              </View>
            ) : null}

            {/* Công dụng nổi bật */}
            {benefitsList.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CÔNG DỤNG NỔI BẬT</Text>
                <View style={styles.bulletList}>
                  {benefitsList.map((item, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Thành phần chính & Chức năng */}
            {ingredientsList.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</Text>
                <View style={styles.bulletList}>
                  {ingredientsList.map((item, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Thành phần đầy đủ (only in internal mode) */}
            {!isCustomer && fullIngredients ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>THÀNH PHẦN ĐẦY ĐỦ</Text>
                <Text style={styles.fullIngredientsText}>{fullIngredients}</Text>
              </View>
            ) : null}

            {/* Loại da phù hợp */}
            {skinTypesList.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LOẠI DA PHÙ HỢP</Text>
                <View style={styles.bulletList}>
                  {skinTypesList.map((item, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Hướng dẫn sử dụng */}
            {usageList.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>HƯỚNG DẪN SỬ DỤNG</Text>
                <View style={styles.bulletList}>
                  {usageList.map((item, idx) => (
                    <Text key={idx} style={styles.bulletItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Cảnh báo / Chống chỉ định */}
            {warningsList.length > 0 ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>CẢNH BÁO / CHỐNG CHỈ ĐỊNH</Text>
                {warningsList.map((item, idx) => (
                  <Text key={idx} style={styles.warningText}>
                    • {item}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* Lưu ý tư vấn nội bộ (Only in internal mode) */}
            {!isCustomer && salesNotesList.length > 0 ? (
              <View style={styles.internalNotesBox}>
                <Text style={styles.internalNotesTitle}>LƯU Ý TƯ VẤN (NỘI BỘ)</Text>
                {salesNotesList.map((item, idx) => (
                  <Text key={idx} style={styles.internalNotesText}>
                    • {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {footer_note || "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam."}
            {generated_at ? ` | Tạo lúc: ${generated_at}` : ""}
          </Text>
          <Text style={styles.footerText}>Trang 1/1</Text>
        </View>
      </Page>
    </Document>
  );
}
