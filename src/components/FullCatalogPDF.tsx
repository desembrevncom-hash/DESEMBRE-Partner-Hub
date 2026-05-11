import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

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

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export const FullCatalogPDF = ({ products, overrides }: any) => {
  // Group products by section
  const sections: Record<string, any[]> = {};
  products.forEach((p: any) => {
    const sec = p.section || 'OTHER';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(p);
  });

  return (
    <Document title="Desembre Vietnam - Bảng giá sản phẩm">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>DESEMBRE VIETNAM</Text>
          <Text style={{ fontSize: 6 }}>BẢNG GIÁ SẢN PHẨM NIÊM YẾT</Text>
        </View>

        <Text style={styles.title}>CATALOGUE & BẢNG GIÁ NIÊM YẾT</Text>

        {Object.entries(sections).map(([title, items]: any, sIdx) => (
          <View key={sIdx} wrap={false}>
            <Text style={styles.sectionHeader}>{title}</Text>
            <View style={styles.grid}>
              {items.map((it: any, pIdx: number) => {
                const o = overrides[it.no];
                const retailPrice = o?.retail_price;
                const salonPrice = o?.salon_price;
                
                return (
                  <View key={pIdx} style={styles.card}>
                    {o?.image_url && (
                      <Image src={o.image_url} style={styles.productImage} />
                    )}
                    <Text style={styles.productName}>{it.name}</Text>
                    <Text style={styles.productDesc}>{it.desc}</Text>
                    
                    {retailPrice && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Retail ({o?.retail_size}):</Text>
                        <Text style={styles.priceValue}>{fmt(retailPrice)}</Text>
                      </View>
                    )}
                    {salonPrice && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Professional ({o?.salon_size}):</Text>
                        <Text style={styles.priceValue}>{fmt(salonPrice)}</Text>
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
