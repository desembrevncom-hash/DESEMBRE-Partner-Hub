export const VIETNAM_PROVINCES_2025 = [
  "Hà Nội",
  "TP Huế",
  "Lai Châu",
  "Điện Biên",
  "Sơn La",
  "Lạng Sơn",
  "Quảng Ninh",
  "Thanh Hóa",
  "Nghệ An",
  "Hà Tĩnh",
  "Cao Bằng",
  "Tuyên Quang",
  "Lào Cai",
  "Thái Nguyên",
  "Phú Thọ",
  "Bắc Ninh",
  "Hưng Yên",
  "TP Hải Phòng",
  "Ninh Bình",
  "Quảng Trị",
  "TP Đà Nẵng",
  "Quảng Ngãi",
  "Gia Lai",
  "Khánh Hòa",
  "Lâm Đồng",
  "Đắk Lắk",
  "TP Hồ Chí Minh",
  "Đồng Nai",
  "Tây Ninh",
  "TP Cần Thơ",
  "Vĩnh Long",
  "Đồng Tháp",
  "Cà Mau",
  "An Giang",
];

export const DISTRICT_LOCALITIES = [
  "tân bình",
  "hồng bàng",
  "cầu giấy",
  "quận 1",
  "quận 2",
  "quận 3",
  "quận 4",
  "quận 5",
  "quận 6",
  "quận 7",
  "quận 8",
  "quận 9",
  "quận 10",
  "quận 11",
  "quận 12",
  "bình thạnh",
  "gò vấp",
  "phú nhuận",
  "tân phú",
  "bình tân",
  "hoàn kiếm",
  "ba đình",
  "đống đa",
  "hai bà trưng",
  "hoàng mai",
  "thanh xuân",
  "hà đông",
  "nam từ liêm",
  "bắc từ liêm",
  "long biên",
  "hải châu",
  "sơn trà",
  "thanh khê",
  "ngũ hành sơn",
  "lê chân",
  "ngô quyền",
  "kiến an",
  "ninh kiều",
  "bình thủy",
  "cái răng",
];

export function stripAccents(str: unknown): string {
  if (str === null || str === undefined) return "";
  const safeStr = typeof str === "string" ? str : String(str);
  if (!safeStr) return "";
  return safeStr
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

export function findProvinceByName(input: string): string | null {
  if (!input) return null;
  const searchNormalized = stripAccents(input);

  const aliasLower = input.toLowerCase().trim().replace(/\s+/g, " ");
  const aliasNormalized = searchNormalized.replace(/\s+/g, " ");

  const aliasMap: Record<string, string> = {
    hcm: "TP Hồ Chí Minh",
    tphcm: "TP Hồ Chí Minh",
    "tp hcm": "TP Hồ Chí Minh",
    "ho chi minh": "TP Hồ Chí Minh",
    "tp ho chi minh": "TP Hồ Chí Minh",
    "sài gòn": "TP Hồ Chí Minh",
    saigon: "TP Hồ Chí Minh",
    "sai gon": "TP Hồ Chí Minh",
    "hà nội": "Hà Nội",
    "ha noi": "Hà Nội",
    hanoi: "Hà Nội",
    "hải phòng": "TP Hải Phòng",
    "hai phong": "TP Hải Phòng",
    haiphong: "TP Hải Phòng",
    "tp hải phòng": "TP Hải Phòng",
    "đà nẵng": "TP Đà Nẵng",
    "da nang": "TP Đà Nẵng",
    danang: "TP Đà Nẵng",
    "tp đà nẵng": "TP Đà Nẵng",
    "cần thơ": "TP Cần Thơ",
    "can tho": "TP Cần Thơ",
    cantho: "TP Cần Thơ",
    "tp cần thơ": "TP Cần Thơ",
    huế: "TP Huế",
    hue: "TP Huế",
    "tp huế": "TP Huế",
  };

  if (aliasMap[aliasLower]) return aliasMap[aliasLower];
  if (aliasMap[aliasNormalized]) return aliasMap[aliasNormalized];

  for (const province of VIETNAM_PROVINCES_2025) {
    const provinceNormalized = stripAccents(province);
    if (provinceNormalized === searchNormalized) {
      return province;
    }
  }

  for (const province of VIETNAM_PROVINCES_2025) {
    const provinceNormalized = stripAccents(province);
    if (
      provinceNormalized.includes(searchNormalized) ||
      searchNormalized.includes(provinceNormalized)
    ) {
      return province;
    }
  }

  return null;
}

export function normalizeProvinceName(input: string): string {
  if (!input) return "";
  const matched = findProvinceByName(input);
  return matched || input;
}

export function isValidProvince(input: string): boolean {
  if (!input) return false;
  return VIETNAM_PROVINCES_2025.includes(input);
}

export function detectDistrictOrLocality(input: string): boolean {
  if (!input) return false;
  const inputLower = input.toLowerCase().trim();
  const inputNormalized = stripAccents(inputLower);
  
  for (const locality of DISTRICT_LOCALITIES) {
    if (inputLower.includes(locality) || inputNormalized.includes(stripAccents(locality))) {
      return true;
    }
  }
  
  if (
    inputLower.startsWith("quận ") || 
    inputLower.startsWith("huyện ") || 
    inputLower.startsWith("phường ") || 
    inputLower.startsWith("xã ") || 
    inputLower.startsWith("q.") || 
    inputLower.startsWith("h.")
  ) {
      return true;
  }
  
  return false;
}

export function suggestProvince(input: string): string | null {
    return findProvinceByName(input);
}
export const VIETNAM_PROVINCES = VIETNAM_PROVINCES_2025;
