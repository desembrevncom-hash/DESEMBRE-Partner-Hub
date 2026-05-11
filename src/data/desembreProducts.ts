export type Product = {
  name: string;
  desc: string;
  link?: string;
};

export type Section = {
  title: string;
  vi?: string;
  products: Product[];
};

export const sections: Section[] = [
  {
    title: "CLEANSER",
    vi: "Làm sạch",
    products: [
      { name: "DESEMBRE MILK ESSENTIAL CLEANSER", desc: "Sữa rửa mặt không bọt cho mọi loại da" },
      { name: "DESEMBRE DERMA SCIENCE WATER CLEANSER", desc: "Nước tẩy trang cân bằng pH cho mọi loại da" },
      { name: "DESEMBRE AGE MOUSSE CLEANSER", desc: "Sữa rửa mặt dạng bọt cho da lão hóa" },
      { name: "DESEMBRE ENZYME POWDER CLEANSER", desc: "Bột enzyme tẩy da chết, làm sạch sâu" },
      { name: "DESEMBRE OXY PEEL BUBBLE CLEANSER", desc: "Tẩy da chết tự sủi bọt lành tính" },
      {
        name: "DESEMBRE MEDI EPI SCIENCE P.SKIN CARE CLEANSING GEL",
        desc: "Gel rửa mặt chiết xuất nọc độc rết chúa cho da mụn",
      },
      { name: "DESEMBRE HEMP OIL CLEANSER", desc: "Dầu tẩy trang tinh dầu gai dầu" },
    ],
  },
  {
    title: "TONER",
    vi: "Cân bằng",
    products: [
      { name: "DESEMBRE ROSE ESSENCE TONER", desc: "Nước hoa hồng cấp ẩm cho mọi loại da" },
      { name: "DESEMBRE P.SKIN CARE CALMING TONER", desc: "Nước hoa hồng làm dịu cho da mụn" },
      { name: "DESEMBRE MADETOX MIST", desc: "Xịt khoáng làm dịu, phục hồi" },
    ],
  },
  {
    title: "CREAM MASK",
    vi: "Mặt nạ kem",
    products: [
      { name: "DESEMBRE HYDRO SCIENCE HYDRO E.R CREAM MASK", desc: "Mặt nạ kem cấp ẩm" },
      { name: "DESEMBRE WHITE SCIENCE BRILLIANT E.R CREAM MASK", desc: "Mặt nạ kem làm trắng" },
      { name: "DESEMBRE P.SKIN CARE CREAM MASK", desc: "Mặt nạ kem cho da mụn" },
    ],
  },
  {
    title: "PROTECTION CARE",
    vi: "Chống nắng",
    products: [
      { name: "DESEMBRE AT HOME E.G.F WATER DROP SUNBLOCK SPF40 PA++", desc: "Kem chống nắng phục hồi, trẻ hoá" },
      { name: "DESEMBRE UV PROTECTOR SUNBLOCK SPF50/PA+++", desc: "Kem chống nắng dưỡng ẩm" },
    ],
  },
  {
    title: "CREAM",
    vi: "Kem dưỡng",
    products: [
      { name: "DESEMBRE DERMA SCIENCE TRUE FILL-UP EYE & NECK CREAM", desc: "Kem dưỡng cho vùng mắt và cổ" },
      { name: "DESEMBRE HYDRO 24H CARE CREAM", desc: "Kem dưỡng cấp ẩm 24H" },
      { name: "DESEMBRE WHITE SCIENCE BRILLIANT 24H CARE CREAM", desc: "Kem dưỡng làm trắng 24H" },
      { name: "DESEMBRE AGING SCIENCE AGE 24H CARE CREAM", desc: "Kem dưỡng trẻ hóa 24H" },
      { name: "DESEMBRE P.SKIN CARE CREAM", desc: "Kem dưỡng chiết xuất nọc độc rết chúa cho da mụn" },
      { name: "DESEMBRE HYDRATING CREAM PLUS", desc: "Kem cấp ẩm đặc trị" },
      { name: "DESEMBRE S-PDRN CORE VITAL CREAM", desc: "Kem dưỡng trẻ hóa DNA cá hồi" },
      { name: "DESEMBRE GLUTATHIONE MEDI R COMPLEX CICA MULTI REPAIR CREAM", desc: "Kem chấm điểm sắc tố liposome" },
    ],
  },
  {
    title: "SERUM",
    products: [
      { name: "DESEMBRE SERUM CORRECTIVE", desc: "Serum γ-PGA, Peptide" },
      { name: "DESEMBRE 24K GOLD BLASTING AMPOULE", desc: "Tinh chất vàng 24K" },
      { name: "DESEMBRE GLUTATHIONE MEDI R COMPLEX CICA MULTI REPAIR SERUM", desc: "Tinh chất kháng sắc tố liposome" },
      { name: "DESEMBRE SPIRULINA ICE CALMING AMPOULE MIST", desc: "Tinh chất dạng xịt tảo biển" },
      { name: "DESEMBRE HOMME SPIRULINA ALL IN ONE-SOLUTION", desc: "Dưỡng chất làm dịu tảo biển" },
    ],
  },
  {
    title: "CONCENTRATE",
    vi: "Tinh chất cô đặc",
    products: [
      { name: "DESEMBRE HYDRO CONCENTRATE", desc: "Tinh chất cô đặc cấp ẩm" },
      { name: "DESEMBRE WHITE CONCENTRATE", desc: "Tinh chất cô đặc làm trắng" },
      { name: "DESEMBRE REPAIR CONCENTRATE", desc: "Tinh chất cô đặc trẻ hóa" },
      { name: "DESEMBRE P.SKIN CARE CONCENTRATE", desc: "Tinh chất cô đặc cho da mụn" },
    ],
  },
  {
    title: "AMPOULE",
    vi: "Dịch chiết TBG",
    products: [
      { name: "DESEMBRE ACTIVATOR HYDRA-FULL AMPOULE", desc: "Dịch chiết tế bào gốc cấp ẩm" },
      { name: "DESEMBRE WHITE ACTIVATOR AMPOULE", desc: "Dịch chiết tế bào gốc làm trắng" },
      { name: "DESEMBRE AGE ACTIVATOR AMPOULE", desc: "Dịch chiết tế bào gốc trẻ hóa" },
      { name: "DESEMBRE ACTIVATOR AC CONTROL AMPOULE", desc: "Dịch chiết tế bào gốc cho da mụn" },
    ],
  },
  {
    title: "AMPOULING",
    vi: "Huyết thanh",
    products: [
      { name: "DESEMBRE HYDRO CORE AMPOULING", desc: "Huyết thanh cấp ẩm" },
      { name: "DESEMBRE WHITE CORE AMPOULING", desc: "Huyết thanh làm trắng" },
      { name: "DESEMBRE RECELL CORE AMPOULING", desc: "Dịch chiết tế bào gốc trẻ hóa" },
      { name: "DESEMBRE P.SKIN CARE AMPOULE", desc: "Huyết thanh cho da mụn" },
      { name: "DESEMBRE S-PDRN CORE VITAL AMPOULE", desc: "Huyết thanh trẻ hóa từ DNA cá hồi" },
    ],
  },
  {
    title: "ESSENCE",
    vi: "Tinh chất",
    products: [
      { name: "DESEMBRE HYDRO+ SCIENCE ESSENCE", desc: "Dưỡng chất cấp ẩm" },
      { name: "DESEMBRE WHITE+ SCIENCE ESSENCE", desc: "Dưỡng chất dưỡng trắng" },
      { name: "DESEMBRE AGE+ SCIENCE ESSENCE", desc: "Dưỡng chất căng bóng" },
      { name: "DESEMBRE PURE+ SCIENCE ESSENCE", desc: "Dưỡng chất kiềm dầu cho da mụn, nhạy cảm" },
    ],
  },
  {
    title: "GEL",
    products: [
      { name: "DESEMBRE 24K GOLD COLLAGEN GEL", desc: "Gel collagen Vàng 24K" },
      { name: "DESEMBRE DERMA SCIENCE ALOE VERA GEL", desc: "Gel lô hội Úc" },
    ],
  },
  {
    title: "MASSAGE",
    products: [
      { name: "DESEMBRE MASSAGE CREAM", desc: "Kem massage cơ bản" },
      { name: "DESEMBRE HIGH FREQUENCY CREAM", desc: "Kem massage tần sóng cao" },
      { name: "DESEMBRE JOJOBA & HONEY MASSAGE GEL", desc: "Gel massage tinh dầu thiên nhiên jojoba và mật ong" },
      { name: "BELLA CUP", desc: "Cốc chuông" },
    ],
  },
  {
    title: "SHEET MASK",
    vi: "Mặt nạ miếng",
    products: [
      { name: "DESEMBRE 3IN1 INVISIBLE SILK MASK III", desc: "Mặt nạ miếng tơ tằm" },
      { name: "DESEMBRE SEAWEED SEED MASK", desc: "Mặt nạ miếng hạt tảo biển" },
      { name: "DESEMBRE SPIRULINA ICE SILK MASK", desc: "Mặt nạ miếng làm dịu tảo biển" },
      { name: "DESEMBRE 24K GOLD FOIL", desc: "Vàng lá 24K" },
    ],
  },
  {
    title: "MODELING",
    vi: "Mặt nạ thạch",
    products: [
      { name: "DESEMBRE PEEL OFF ALGINATE TEA TREE OIL", desc: "Mặt nạ thạch dẻo tràm trà" },
      { name: "DESEMBRE GOLD PEEL OFF MASK", desc: "Mặt nạ thạch dẻo collagen vàng" },
      { name: "DESEMBRE PREMIUM VITAMIN MODELING MASK", desc: "Mặt nạ thạch dẻo Vitamin" },
      { name: "DESEMBRE PREMIUM COLLAGEN MODELING MASK", desc: "Mặt nạ thạch dẻo collagen" },
      { name: "DESEMBRE PREMIUM COOL TEATREE MODELING MASK", desc: "Mặt nạ thạch dẻo tràm trà" },
      { name: "DESEMBRE PREMIUM SPIRULINA MODELING MASK", desc: "Mặt nạ thạch dẻo tảo biển" },
      { name: "DESEMBRE HYDRO BLUE SPIRULINA MODELING MASK", desc: "Mặt nạ thạch dẻo tảo xoắn cấp ẩm" },
      { name: "DESEMBRE FRESH GREEN SPIRULINA MODELING MASK", desc: "Mặt nạ thạch dẻo tảo xoắn làm dịu" },
    ],
  },
  {
    title: "THERAPY TREATMENT / SET",
    vi: "Set chăm sóc chuyên sâu",
    products: [
      { name: "DESEMBRE LUXURY GOLD THERAPY PLUS", desc: "Bộ trị liệu chuyên sâu Vàng 24k" },
      { name: "DESEMBRE OXYJET ELIXIR TREATMENT", desc: "Bộ trị liệu chuyên sâu cấp oxy" },
      { name: "DESEMBRE V-LINE MAGIC THERAPY", desc: "Bộ trị liệu chuyên sâu làm thon gọn gương mặt" },
      { name: "DESEMBRE HOLISTIC CRYSTALING PEEL", desc: "Bộ thay da vi kim tảo biển dạng bột" },
      { name: "DESEMBRE EXFOLIATOR 3IN1 PEELING CREAM", desc: "Bộ tái tạo da vi kim tảo biển dạng kem" },
    ],
  },
];

// Flatten with stable global No.
export type FlatProduct = Product & {
  no: number;
  section: string;
  sectionVi?: string;
};

export const flatProducts: FlatProduct[] = (() => {
  let counter = 0;
  const list: FlatProduct[] = [];
  for (const s of sections) {
    for (const p of s.products) {
      counter += 1;
      list.push({ ...p, no: counter, section: s.title, sectionVi: s.vi });
    }
  }
  return list;
})();
