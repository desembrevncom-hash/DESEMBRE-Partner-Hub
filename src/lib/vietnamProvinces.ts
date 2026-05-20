export const VIETNAM_PROVINCES = [
  "Hà Nội",
  "Tp Hồ Chí Minh",
  "Hải Phòng",
  "Đà Nẵng",
  "Huế",
  "Cần Thơ",
  "Lai Châu",
  "Điện Biên",
  "Sơn La",
  "Lào Cai",
  "Tuyên Quang",
  "Cao Bằng",
  "Thái Nguyên",
  "Lạng Sơn",
  "Phú Thọ",
  "Bắc Ninh",
  "Quảng Ninh",
  "Hưng Yên",
  "Ninh Bình",
  "Thanh Hóa",
  "Nghệ An",
  "Hà Tĩnh",
  "Quảng Trị",
  "Quảng Ngãi",
  "Gia Lai",
  "Đắk Lắk",
  "Khánh Hòa",
  "Lâm Đồng",
  "Đồng Nai",
  "Tây Ninh",
  "Vĩnh Long",
  "Đồng Tháp",
  "Cà Mau",
  "An Giang"
];

/**
 * Strips Vietnamese diacritics (accents) from a string, converts to lowercase, and trims.
 */
export function stripAccents(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

/**
 * Searches for a matching province in the standard list by name or alias.
 * Supports accent-insensitive, case-insensitive, and abbreviation matches (e.g. hcm, ha noi).
 */
export function findProvinceByName(input: string): string | null {
  if (!input) return null;
  const searchNormalized = stripAccents(input);

  // 1. Direct or normalized alias check
  const aliasLower = input.toLowerCase().trim().replace(/\s+/g, " ");
  const aliasNormalized = searchNormalized.replace(/\s+/g, " ");

  const aliasMap: Record<string, string> = {
    "hcm": "Tp Hồ Chí Minh",
    "tphcm": "Tp Hồ Chí Minh",
    "tp hcm": "Tp Hồ Chí Minh",
    "ho chi minh": "Tp Hồ Chí Minh",
    "tp ho chi minh": "Tp Hồ Chí Minh",
    "ha noi": "Hà Nội",
    "hanoi": "Hà Nội",
    "da nang": "Đà Nẵng",
    "hue": "Huế",
    "can tho": "Cần Thơ",
  };

  if (aliasMap[aliasLower]) {
    return aliasMap[aliasLower];
  }
  if (aliasMap[aliasNormalized]) {
    return aliasMap[aliasNormalized];
  }

  // 2. Exact match after stripping accents
  for (const province of VIETNAM_PROVINCES) {
    const provinceNormalized = stripAccents(province);
    if (provinceNormalized === searchNormalized) {
      return province;
    }
  }

  // 3. Substring match
  for (const province of VIETNAM_PROVINCES) {
    const provinceNormalized = stripAccents(province);
    if (provinceNormalized.includes(searchNormalized) || searchNormalized.includes(provinceNormalized)) {
      return province;
    }
  }

  return null;
}

/**
 * Normalizes any input province string. Returns the matched standard province name
 * if found, or the original input string if not matched.
 */
export function normalizeProvinceName(input: string): string {
  if (!input) return "";
  const matched = findProvinceByName(input);
  return matched || input;
}
