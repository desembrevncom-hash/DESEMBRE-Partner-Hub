import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import type { Product } from '@/types/product';
import { getDisplayPrice, UserRole } from '@/lib/pricing';

// Register Vietnamese font
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
  fontWeight: 'light',
});
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
  fontWeight: 'normal',
});
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
  fontWeight: 'medium',
});
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
  fontWeight: 'bold',
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Roboto',
    fontSize: 8,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    backgroundColor: '#f0f0f0',
    padding: 5,
    marginTop: 15,
    marginBottom: 5,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31%', // 3 columns
    borderWidth: 0.5,
    borderColor: '#eee',
    padding: 5,
    marginBottom: 10,
  },
  productImage: {
    width: '100%',
    height: 80,
    objectFit: 'contain',
    marginBottom: 5,
    backgroundColor: '#f9f9f9',
  },
  productName: {
    fontWeight: 'bold',
    fontSize: 8,
    marginBottom: 2,
    minHeight: 20,
  },
  productDesc: {
    fontSize: 6,
    color: '#666',
    marginBottom: 5,
    height: 25,
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    borderTop: 0.5,
    borderTopColor: '#f0f0f0',
    paddingTop: 3,
  },
  priceLabel: {
    fontSize: 6,
    color: '#999',
  },
  priceValue: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 6,
    color: '#ccc',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    right: 20,
    fontSize: 6,
    color: '#999',
  }
});

const fmt = (n: number, vatOn: boolean, role: UserRole | "user" = "user") => {
  const price = getDisplayPrice(n, vatOn ? "with" : "without", role);
  return new Intl.NumberFormat('vi-VN').format(Math.round(price || 0));
};

export const FullCatalogPDF = ({ 
  products, 
  vatOn = false,
  role = "user",
  vatRate = 0.08
}: { 
  products: Product[], 
  vatOn?: boolean,
  role?: UserRole | "user",
  vatRate?: number
}) => {
  // Group products by category
  const categories: Record<string, Product[]> = {};
  products.forEach((p) => {
    const cat = p.categoryId || 'OTHER';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });

  const isSaleView = role === "sale" || role === "tele_lead" || role === "telesale";

  return (
    <Document title={`Desembre Vietnam - Bảng giá sản phẩm ${vatOn ? '(Có VAT)' : '(Chưa VAT)'} ${isSaleView ? '(Giá Sale)' : ''}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>DESEMBRE VIETNAM</Text>
          <Text style={{ fontSize: 6 }}>
            BẢNG GIÁ NIÊM YẾT {vatOn ? `(ĐÃ CÓ VAT ${Math.round(vatRate * 100)}%)` : '(CHƯA VAT)'} {isSaleView ? '- CHẾ ĐỘ GIÁ SALE (60%)' : ''}
          </Text>
        </View>

        <Text style={styles.title}>CATALOGUE & BẢNG GIÁ NIÊM YẾT</Text>

        {Object.entries(categories).map(([catId, items], sIdx) => (
          <View key={catId} wrap={false}>
            <Text style={styles.sectionHeader}>{catId}</Text>
            <View style={styles.grid}>
              {items.map((p, pIdx: number) => {
                const retail = p.variants.find(v => v.type === "retail");
                const salon = p.variants.find(v => v.type === "salon");
                
                return (
                  <View key={p.id} style={styles.card}>
                    {p.imageUrl && (
                      <Image src={p.imageUrl} style={styles.productImage} />
                    )}
                    <Text style={styles.productName}>{p.name}</Text>
                    <Text style={styles.productDesc}>{p.description}</Text>
                    
                    {retail && retail.price > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Retail ({retail.size}){vatOn ? ' (+VAT)' : ''}:</Text>
                        <Text style={styles.priceValue}>{fmt(retail.price, vatOn, role)}</Text>
                      </View>
                    )}
                    {salon && salon.price > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Professional ({salon.size}){vatOn ? ' (+VAT)' : ''}:</Text>
                        <Text style={styles.priceValue}>{fmt(salon.price, vatOn, role)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.footer}>© {new Date().getFullYear()} Desembre Vietnam. Tất cả giá đã bao gồm các chiết khấu tiêu chuẩn.</Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
