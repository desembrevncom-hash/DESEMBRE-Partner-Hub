
import { Category, Product } from "../types/product";

export const CATEGORIES: Category[] = [
  {
    "id": "CLEANSER",
    "name": "CLEANSER",
    "nameVi": "Làm sạch"
  },
  {
    "id": "TONER",
    "name": "TONER",
    "nameVi": "Cân bằng"
  },
  {
    "id": "CREAM MASK",
    "name": "CREAM MASK",
    "nameVi": "Mặt nạ kem"
  },
  {
    "id": "PROTECTION CARE",
    "name": "PROTECTION CARE",
    "nameVi": "Chống nắng"
  },
  {
    "id": "CREAM",
    "name": "CREAM",
    "nameVi": "Kem dưỡng"
  },
  {
    "id": "SERUM",
    "name": "SERUM"
  },
  {
    "id": "CONCENTRATE",
    "name": "CONCENTRATE",
    "nameVi": "Tinh chất cô đặc"
  },
  {
    "id": "AMPOULE",
    "name": "AMPOULE",
    "nameVi": "Dịch chiết TBG"
  },
  {
    "id": "AMPOULING",
    "name": "AMPOULING",
    "nameVi": "Huyết thanh"
  },
  {
    "id": "ESSENCE",
    "name": "ESSENCE",
    "nameVi": "Tinh chất"
  },
  {
    "id": "GEL",
    "name": "GEL"
  },
  {
    "id": "MASSAGE",
    "name": "MASSAGE"
  },
  {
    "id": "SHEET MASK",
    "name": "SHEET MASK",
    "nameVi": "Mặt nạ miếng"
  },
  {
    "id": "MODELING",
    "name": "MODELING",
    "nameVi": "Mặt nạ thạch"
  },
  {
    "id": "THERAPY TREATMENT / SET",
    "name": "THERAPY TREATMENT / SET",
    "nameVi": "Set chăm sóc chuyên sâu"
  }
];

export const PRODUCTS: Product[] = [
  {
    "id": 1,
    "name": "DESEMBRE MILK ESSENTIAL CLEANSER",
    "description": "Sữa rửa mặt không bọt cho mọi loại da",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "1-retail",
        "type": "retail",
        "size": "150ml",
        "price": 650000
      },
      {
        "id": "1-salon",
        "type": "salon",
        "size": "1000ml",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 2,
    "name": "DESEMBRE DERMA SCIENCE WATER CLEANSER",
    "description": "Nước tẩy trang cân bằng pH cho mọi loại da",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "2-salon",
        "type": "salon",
        "size": "1000ml",
        "price": 1400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 3,
    "name": "DESEMBRE REPAIR MOUSSE CLEANSER",
    "description": "Sữa rửa mặt dạng bọt cho da lão hóa",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "3-retail",
        "type": "retail",
        "size": "150ml",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 4,
    "name": "DESEMBRE ENZYME POWDER CLEANSER",
    "description": "Bột enzyme tẩy da chết, làm sạch sâu",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "4-retail",
        "type": "retail",
        "size": "80g",
        "price": 700000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 5,
    "name": "DESEMBRE OXY PEEL BUBBLE CLEANSER",
    "description": "Tẩy da chết tự sủi bọt lành tính",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "5-retail",
        "type": "retail",
        "size": "130ml",
        "price": 900000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 6,
    "name": "DESEMBRE MEDI EPI SCIENCE P.SKIN CARE CLEANSING GEL",
    "description": "Gel rửa mặt chiết xuất nọc độc rết chúa cho da mụn",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "6-retail",
        "type": "retail",
        "size": "200ml",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 7,
    "name": "DESEMBRE HEMP OIL CLEANSER",
    "description": "Dầu tẩy trang tinh dầu gai dầu",
    "categoryId": "CLEANSER",
    "variants": [
      {
        "id": "7-retail",
        "type": "retail",
        "size": "200ml",
        "price": 950000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 8,
    "name": "DESEMBRE ROSE ESSENCE TONER",
    "description": "Nước hoa hồng cấp ẩm cho mọi loại da",
    "categoryId": "TONER",
    "variants": [
      {
        "id": "8-retail",
        "type": "retail",
        "size": "150ml",
        "price": 750000
      },
      {
        "id": "8-salon",
        "type": "salon",
        "size": "1000ml",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 9,
    "name": "DESEMBRE P.SKIN CARE CALMING TONER",
    "description": "Nước hoa hồng làm dịu cho da mụn",
    "categoryId": "TONER",
    "variants": [
      {
        "id": "9-retail",
        "type": "retail",
        "size": "150ml",
        "price": 750000
      },
      {
        "id": "9-salon",
        "type": "salon",
        "size": "1000ml",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 10,
    "name": "DESEMBRE MADETOX MIST",
    "description": "Xịt khoáng làm dịu, phục hồi",
    "categoryId": "TONER",
    "variants": [
      {
        "id": "10-retail",
        "type": "retail",
        "size": "100ml",
        "price": 550000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 11,
    "name": "DESEMBRE HYDRO SCIENCE HYDRO E.R CREAM MASK",
    "description": "Mặt nạ kem cấp ẩm",
    "categoryId": "CREAM MASK",
    "variants": [
      {
        "id": "11-salon",
        "type": "salon",
        "size": "200g",
        "price": 950000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 12,
    "name": "DESEMBRE WHITE SCIENCE BRILLIANT E.R CREAM MASK",
    "description": "Mặt nạ kem làm trắng",
    "categoryId": "CREAM MASK",
    "variants": [
      {
        "id": "12-salon",
        "type": "salon",
        "size": "200g",
        "price": 950000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 13,
    "name": "DESEMBRE P.SKIN CARE CREAM MASK",
    "description": "Mặt nạ kem cho da mụn",
    "categoryId": "CREAM MASK",
    "variants": [
      {
        "id": "13-salon",
        "type": "salon",
        "size": "200g",
        "price": 950000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 14,
    "name": "DESEMBRE AT HOME E.G.F WATER DROP SUNBLOCK SPF40 PA++",
    "description": "Kem chống nắng phục hồi, trẻ hoá",
    "categoryId": "PROTECTION CARE",
    "variants": [
      {
        "id": "14-retail",
        "type": "retail",
        "size": "50ml",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 15,
    "name": "DESEMBRE UV PROTECTOR SUNBLOCK SPF50/PA+++",
    "description": "Kem chống nắng dưỡng ẩm",
    "categoryId": "PROTECTION CARE",
    "variants": [
      {
        "id": "15-retail",
        "type": "retail",
        "size": "70ml",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 16,
    "name": "DESEMBRE DERMA SCIENCE TRUE FILL-UP EYE & NECK CREAM",
    "description": "Kem dưỡng cho vùng mắt và cổ",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "16-retail",
        "type": "retail",
        "size": "30g",
        "price": 1200000
      },
      {
        "id": "16-salon",
        "type": "salon",
        "size": "120g",
        "price": 1800000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 17,
    "name": "DESEMBRE HYDRO 24H CARE CREAM",
    "description": "Kem dưỡng cấp ẩm 24H",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "17-retail",
        "type": "retail",
        "size": "50g",
        "price": 1200000
      },
      {
        "id": "17-salon",
        "type": "salon",
        "size": "200g",
        "price": 1800000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 18,
    "name": "DESEMBRE WHITE SCIENCE BRILLIANT 24H CARE CREAM",
    "description": "Kem dưỡng làm trắng 24H",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "18-retail",
        "type": "retail",
        "size": "50g",
        "price": 1200000
      },
      {
        "id": "18-salon",
        "type": "salon",
        "size": "200g",
        "price": 1800000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 19,
    "name": "DESEMBRE REPAIR 24H CARE CREAM",
    "description": "Kem dưỡng trẻ hóa 24H",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "19-retail",
        "type": "retail",
        "size": "50g",
        "price": 1200000
      },
      {
        "id": "19-salon",
        "type": "salon",
        "size": "200g",
        "price": 1800000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 20,
    "name": "DESEMBRE P.SKIN CARE CREAM",
    "description": "Kem dưỡng chiết xuất nọc độc rết chúa cho da mụn",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "20-retail",
        "type": "retail",
        "size": "50g",
        "price": 1200000
      },
      {
        "id": "20-salon",
        "type": "salon",
        "size": "200g",
        "price": 1800000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 21,
    "name": "DESEMBRE HYDRATING CREAM PLUS",
    "description": "Kem cấp ẩm đặc trị",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "21-salon",
        "type": "salon",
        "size": "120g",
        "price": 2400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 22,
    "name": "DESEMBRE S-PDRN CORE VITAL CREAM",
    "description": "Kem dưỡng trẻ hóa DNA cá hồi",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "22-retail",
        "type": "retail",
        "size": "50g",
        "price": 1200000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 23,
    "name": "DESEMBRE GLUTATHIONE MEDI R COMPLEX CICA MULTI REPAIR CREAM",
    "description": "Kem chấm điểm sắc tố liposome",
    "categoryId": "CREAM",
    "variants": [
      {
        "id": "23-retail",
        "type": "retail",
        "size": "30g",
        "price": 650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 24,
    "name": "DESEMBRE SERUM CORRECTIVE",
    "description": "Serum γ-PGA, Peptide",
    "categoryId": "SERUM",
    "variants": [
      {
        "id": "24-retail",
        "type": "retail",
        "size": "100ml",
        "price": 2150000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 25,
    "name": "DESEMBRE 24K GOLD BLASTING AMPOULE",
    "description": "Tinh chất vàng 24K",
    "categoryId": "SERUM",
    "variants": [
      {
        "id": "25-retail",
        "type": "retail",
        "size": "100ml",
        "price": 1450000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 26,
    "name": "DESEMBRE GLUTATHIONE MEDI R COMPLEX CICA MULTI REPAIR SERUM",
    "description": "Tinh chất kháng sắc tố liposome",
    "categoryId": "SERUM",
    "variants": [
      {
        "id": "26-retail",
        "type": "retail",
        "size": "50ml",
        "price": 750000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 27,
    "name": "DESEMBRE SPIRULINA ICE CALMING AMPOULE MIST",
    "description": "Tinh chất dạng xịt tảo biển",
    "categoryId": "SERUM",
    "variants": [
      {
        "id": "27-retail",
        "type": "retail",
        "size": "100ml",
        "price": 1200000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 28,
    "name": "DESEMBRE HOMME SPIRULINA ALL IN ONE-SOLUTION",
    "description": "Dưỡng chất làm dịu tảo biển",
    "categoryId": "SERUM",
    "variants": [
      {
        "id": "28-retail",
        "type": "retail",
        "size": "100ml",
        "price": 1450000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 29,
    "name": "DESEMBRE HYDRO CONCENTRATE",
    "description": "Tinh chất cô đặc cấp ẩm",
    "categoryId": "CONCENTRATE",
    "variants": [
      {
        "id": "29-retail",
        "type": "retail",
        "size": "30ml",
        "price": 750000
      },
      {
        "id": "29-salon",
        "type": "salon",
        "size": "100ml",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 30,
    "name": "DESEMBRE WHITE CONCENTRATE",
    "description": "Tinh chất cô đặc làm trắng",
    "categoryId": "CONCENTRATE",
    "variants": [
      {
        "id": "30-retail",
        "type": "retail",
        "size": "30ml",
        "price": 750000
      },
      {
        "id": "30-salon",
        "type": "salon",
        "size": "100ml",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 31,
    "name": "DESEMBRE REPAIR CONCENTRATE",
    "description": "Tinh chất cô đặc trẻ hóa",
    "categoryId": "CONCENTRATE",
    "variants": [
      {
        "id": "31-retail",
        "type": "retail",
        "size": "30ml",
        "price": 750000
      },
      {
        "id": "31-salon",
        "type": "salon",
        "size": "100ml",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 32,
    "name": "DESEMBRE P.SKIN CARE CONCENTRATE",
    "description": "Tinh chất cô đặc cho da mụn",
    "categoryId": "CONCENTRATE",
    "variants": [
      {
        "id": "32-retail",
        "type": "retail",
        "size": "30ml",
        "price": 750000
      },
      {
        "id": "32-salon",
        "type": "salon",
        "size": "100ml",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 33,
    "name": "DESEMBRE ACTIVATOR HYDRA-FULL AMPOULE",
    "description": "Dịch chiết tế bào gốc cấp ẩm",
    "categoryId": "AMPOULE",
    "variants": [
      {
        "id": "33-salon",
        "type": "salon",
        "size": "7ml x 10ea",
        "price": 2500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 34,
    "name": "DESEMBRE WHITE ACTIVATOR AMPOULE",
    "description": "Dịch chiết tế bào gốc làm trắng",
    "categoryId": "AMPOULE",
    "variants": [
      {
        "id": "34-salon",
        "type": "salon",
        "size": "7ml x 10ea",
        "price": 2500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 35,
    "name": "DESEMBRE AGE ACTIVATOR AMPOULE",
    "description": "Dịch chiết tế bào gốc trẻ hóa",
    "categoryId": "AMPOULE",
    "variants": [
      {
        "id": "35-salon",
        "type": "salon",
        "size": "7ml x 10ea",
        "price": 2500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 36,
    "name": "DESEMBRE ACTIVATOR AC CONTROL AMPOULE",
    "description": "Dịch chiết tế bào gốc cho da mụn",
    "categoryId": "AMPOULE",
    "variants": [
      {
        "id": "36-salon",
        "type": "salon",
        "size": "7ml x 10ea",
        "price": 2500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 37,
    "name": "DESEMBRE HYDRO CORE AMPOULING",
    "description": "Huyết thanh cấp ẩm",
    "categoryId": "AMPOULING",
    "variants": [
      {
        "id": "37-retail",
        "type": "retail",
        "size": "2ml x 12ea",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 38,
    "name": "DESEMBRE WHITE CORE AMPOULING",
    "description": "Huyết thanh làm trắng",
    "categoryId": "AMPOULING",
    "variants": [
      {
        "id": "38-retail",
        "type": "retail",
        "size": "2ml x 12ea",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 39,
    "name": "DESEMBRE RECELL CORE AMPOULING",
    "description": "Dịch chiết tế bào gốc trẻ hóa",
    "categoryId": "AMPOULING",
    "variants": [
      {
        "id": "39-retail",
        "type": "retail",
        "size": "2ml x 12ea",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 40,
    "name": "DESEMBRE P.SKIN CARE AMPOULE",
    "description": "Huyết thanh cho da mụn",
    "categoryId": "AMPOULING",
    "variants": [
      {
        "id": "40-retail",
        "type": "retail",
        "size": "2ml x 12ea",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 41,
    "name": "DESEMBRE S-PDRN CORE VITAL AMPOULE",
    "description": "Huyết thanh trẻ hóa từ DNA cá hồi",
    "categoryId": "AMPOULING",
    "variants": [
      {
        "id": "41-retail",
        "type": "retail",
        "size": "2ml x 12ea",
        "price": 1250000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 42,
    "name": "DESEMBRE HYDRO+ SCIENCE ESSENCE",
    "description": "Dưỡng chất cấp ẩm",
    "categoryId": "ESSENCE",
    "variants": [
      {
        "id": "42-salon",
        "type": "salon",
        "size": "200ml",
        "price": 1400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 43,
    "name": "DESEMBRE WHITE+ SCIENCE ESSENCE",
    "description": "Dưỡng chất dưỡng trắng",
    "categoryId": "ESSENCE",
    "variants": [
      {
        "id": "43-salon",
        "type": "salon",
        "size": "200ml",
        "price": 1400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 44,
    "name": "DESEMBRE AGE+ SCIENCE ESSENCE",
    "description": "Dưỡng chất căng bóng",
    "categoryId": "ESSENCE",
    "variants": [
      {
        "id": "44-salon",
        "type": "salon",
        "size": "200ml",
        "price": 1400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 45,
    "name": "DESEMBRE PURE+ SCIENCE ESSENCE",
    "description": "Dưỡng chất kiềm dầu cho da mụn, nhạy cảm",
    "categoryId": "ESSENCE",
    "variants": [
      {
        "id": "45-salon",
        "type": "salon",
        "size": "200ml",
        "price": 1400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 46,
    "name": "DESEMBRE 24K GOLD COLLAGEN GEL",
    "description": "Gel collagen Vàng 24K",
    "categoryId": "GEL",
    "variants": [
      {
        "id": "46-retail",
        "type": "retail",
        "size": "110ml",
        "price": 600000
      },
      {
        "id": "46-salon",
        "type": "salon",
        "size": "500ml",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 47,
    "name": "DESEMBRE DERMA SCIENCE ALOE VERA GEL",
    "description": "Gel lô hội Úc",
    "categoryId": "GEL",
    "variants": [
      {
        "id": "47-retail",
        "type": "retail",
        "size": "110ml",
        "price": 450000
      },
      {
        "id": "47-salon",
        "type": "salon",
        "size": "500ml",
        "price": 1350000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 48,
    "name": "DESEMBRE MASSAGE CREAM",
    "description": "Kem massage cơ bản",
    "categoryId": "MASSAGE",
    "variants": [
      {
        "id": "48-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 49,
    "name": "DESEMBRE HIGH FREQUENCY CREAM",
    "description": "Kem massage tần sóng cao",
    "categoryId": "MASSAGE",
    "variants": [
      {
        "id": "49-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1650000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 50,
    "name": "DESEMBRE JOJOBA & HONEY MASSAGE GEL",
    "description": "Gel massage tinh dầu thiên nhiên jojoba và mật ong",
    "categoryId": "MASSAGE",
    "variants": [
      {
        "id": "50-salon",
        "type": "salon",
        "size": "250g",
        "price": 1550000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 51,
    "name": "BELLA CUP",
    "description": "Cốc chuông",
    "categoryId": "MASSAGE",
    "variants": [
      {
        "id": "51-salon",
        "type": "salon",
        "size": "2ea",
        "price": 450000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 52,
    "name": "DESEMBRE 3IN1 INVISIBLE SILK MASK III",
    "description": "Mặt nạ miếng tơ tằm",
    "categoryId": "SHEET MASK",
    "variants": [
      {
        "id": "52-retail",
        "type": "retail",
        "size": "30mlx10pcs",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 53,
    "name": "DESEMBRE SEAWEED SEED MASK",
    "description": "Mặt nạ miếng hạt tảo biển",
    "categoryId": "SHEET MASK",
    "variants": [
      {
        "id": "53-salon",
        "type": "salon",
        "size": "10ea",
        "price": 950000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 54,
    "name": "DESEMBRE SPIRULINA ICE SILK MASK",
    "description": "Mặt nạ miếng làm dịu tảo biển",
    "categoryId": "SHEET MASK",
    "variants": [
      {
        "id": "54-retail",
        "type": "retail",
        "size": "25mlx10pcs",
        "price": 850000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 55,
    "name": "DESEMBRE 24K GOLD FOIL",
    "description": "Vàng lá 24K",
    "categoryId": "SHEET MASK",
    "variants": [
      {
        "id": "55-salon",
        "type": "salon",
        "size": "50pcs",
        "price": 12000000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 56,
    "name": "DESEMBRE PEEL OFF ALGINATE TEA TREE OIL",
    "description": "Mặt nạ thạch dẻo tràm trà",
    "categoryId": "MODELING",
    "variants": [],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 57,
    "name": "DESEMBRE GOLD PEEL OFF MASK",
    "description": "Mặt nạ thạch dẻo collagen vàng",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "57-retail",
        "type": "retail",
        "size": "500g",
        "price": 1250000
      },
      {
        "id": "57-salon",
        "type": "salon",
        "size": "1000g",
        "price": 2400000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 58,
    "name": "DESEMBRE PREMIUM VITAMIN MODELING MASK",
    "description": "Mặt nạ thạch dẻo Vitamin",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "58-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 59,
    "name": "DESEMBRE PREMIUM COLLAGEN MODELING MASK",
    "description": "Mặt nạ thạch dẻo collagen",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "59-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 60,
    "name": "DESEMBRE PREMIUM COOL TEATREE MODELING MASK",
    "description": "Mặt nạ thạch dẻo tràm trà",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "60-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 61,
    "name": "DESEMBRE PREMIUM SPIRULINA MODELING MASK",
    "description": "Mặt nạ thạch dẻo tảo biển",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "61-salon",
        "type": "salon",
        "size": "1000g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 62,
    "name": "DESEMBRE HYDRO BLUE SPIRULINA MODELING MASK",
    "description": "Mặt nạ thạch dẻo tảo xoắn cấp ẩm",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "62-retail",
        "type": "retail",
        "size": "500g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 63,
    "name": "DESEMBRE FRESH GREEN SPIRULINA MODELING MASK",
    "description": "Mặt nạ thạch dẻo tảo xoắn làm dịu",
    "categoryId": "MODELING",
    "variants": [
      {
        "id": "63-retail",
        "type": "retail",
        "size": "500g",
        "price": 1500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 64,
    "name": "DESEMBRE LUXURY GOLD THERAPY PLUS",
    "description": "Bộ trị liệu chuyên sâu Vàng 24k",
    "categoryId": "THERAPY TREATMENT / SET",
    "variants": [
      {
        "id": "64-salon",
        "type": "salon",
        "size": "Set",
        "price": 9500000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 65,
    "name": "DESEMBRE OXYJET ELIXIR TREATMENT",
    "description": "Bộ trị liệu chuyên sâu cấp oxy",
    "categoryId": "THERAPY TREATMENT / SET",
    "variants": [
      {
        "id": "65-salon",
        "type": "salon",
        "size": "Set",
        "price": 2300000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 66,
    "name": "DESEMBRE V-LINE MAGIC THERAPY",
    "description": "Bộ trị liệu chuyên sâu làm thon gọn gương mặt",
    "categoryId": "THERAPY TREATMENT / SET",
    "variants": [
      {
        "id": "66-salon",
        "type": "salon",
        "size": "Set",
        "price": 3300000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 67,
    "name": "DESEMBRE HOLISTIC CRYSTALING PEEL",
    "description": "Bộ thay da vi kim tảo biển dạng bột",
    "categoryId": "THERAPY TREATMENT / SET",
    "variants": [
      {
        "id": "67-salon",
        "type": "salon",
        "size": "Set",
        "price": 2000000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  },
  {
    "id": 68,
    "name": "DESEMBRE EXFOLIATOR 3IN1 PEELING CREAM",
    "description": "Bộ tái tạo da vi kim tảo biển dạng kem",
    "categoryId": "THERAPY TREATMENT / SET",
    "variants": [
      {
        "id": "68-retail",
        "type": "retail",
        "size": "5ml x 6ea",
        "price": 1750000
      }
    ],
    "isCustom": false,
    "isDeleted": false
  }
];
