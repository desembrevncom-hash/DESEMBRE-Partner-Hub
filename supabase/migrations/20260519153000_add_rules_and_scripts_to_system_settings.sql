-- Migration: Add cross-sell rules and spa equipment scripts to system_settings table
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS cross_sell_rules jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS spa_equipment_scripts jsonb DEFAULT '{}'::jsonb;

-- Update the default row with initial/default rules and scripts so it is not empty
UPDATE public.system_settings
SET cross_sell_rules = '[
  {
    "id": "cleansing",
    "name": "Dòng Làm sạch & Thải độc (Cleansing)",
    "desc": "Sữa rửa mặt, mặt nạ oxy bong bóng sủi bọt, tẩy tế bào chết enzyme",
    "note_purchased": "Đã mua đơn hàng trước",
    "note_not_purchased": "Chưa từng mua",
    "action_label": "CHÀO MẪU TEST"
  },
  {
    "id": "serum",
    "name": "Dòng Serum & Ampoule Trị liệu (EGF / Vitamin C)",
    "desc": "Tế bào gốc phục hồi, Vitamin C trị nám, serum mụn chuyên sâu",
    "note_purchased": "Đã mua serum trị liệu trước đó",
    "note_not_purchased": "Spa CHƯA MUA - Tỷ lệ lỗ hổng Upsell cực cao 🎯",
    "action_label": "CHÀO MẪU TEST"
  },
  {
    "id": "cream",
    "name": "Dòng Kem dưỡng & Khóa ẩm Cabin (Creams)",
    "desc": "Kem cấp ẩm sâu Hyaluronic, kem phục hồi Hydro lipid bơ hạt mỡ",
    "note_purchased": "Đã mua đơn hàng trước",
    "note_not_purchased": "Chưa từng mua",
    "action_label": "CHÀO MẪU TEST"
  },
  {
    "id": "sunblock",
    "name": "Dòng Chống nắng & Bảo vệ (Sun Shield)",
    "desc": "Kem chống nắng vật lý SPF 50+, gel làm dịu mát lô hội sau nắng",
    "note_purchased": "Đã mua kem chống nắng trước đó",
    "note_not_purchased": "Spa CHƯA MUA - Khách hàng đang bỏ ngỏ dòng bảo vệ da 🎯",
    "action_label": "CHÀO MẪU TEST"
  }
]'::jsonb,
spa_equipment_scripts = '{
  "laser": {
    "label": "Máy Laser YAG/CO2",
    "tag": "TƯ VẤN SAU LASER",
    "desc": "Spa có máy Laser ➡️ Khách hàng điều trị nám, sẹo, tàn nhang rất nhiều. Da sau Laser cực kỳ mỏng yếu và tổn thương.",
    "script": "Tư vấn ngay **Set Tế bào gốc phục hồi EGF Desembre** (hộp 10 ống) kèm Kem chống nắng vật lý bảo vệ chuyên sâu. Nhấn mạnh hiệu quả tái tạo da tức thì, tránh tăng sắc tố sau Laser."
  },
  "needle": {
    "label": "Thiết bị Phi kim/Lăn kim",
    "tag": "TƯ VẤN SAU PHI KIM",
    "desc": "Spa làm dịch vụ Phi kim / Lăn kim ➡️ Liệu trình collagen cảm ứng rất cần chất dẫn phục hồi biểu bì sâu.",
    "script": "Giới thiệu dòng **Mặt nạ thải độc sủi bọt Desembre Oxy Bubble Mask** hoặc Serum đặc trị sẹo rỗ, lỗ chân lông to của Desembre để làm sạch sâu cabin trước và nuôi da sau liệu trình phi kim."
  },
  "hifu": {
    "label": "Máy HIFU / Nâng cơ",
    "tag": "TƯ VẤN SAU HIFU / NÂNG CƠ",
    "desc": "Spa làm trẻ hóa nâng cơ bằng HIFU/RF ➡️ Cần bổ sung dưỡng chất nâng cơ, chống nhăn chùng chảy xệ tại nhà để duy trì kết quả máy.",
    "script": "Chào dòng **Kem dưỡng trẻ hóa peptide 24K Gold Desembre Luxury Gold** cao cấp. Tỷ lệ chốt cực cao vì tệp khách làm HIFU là tệp khách VIP, sẵn sàng chi trả mức giá trị lớn!"
  },
  "rf": {
    "label": "Máy RF / Giảm béo",
    "tag": "TƯ VẤN GIẢM BÉO & SĂN CHẮC",
    "desc": "Spa có máy RF hoặc máy giảm béo cơ thể/mặt ➡️ Liệu trình tiêu mỡ cần kem massage và gel dẫn hỗ trợ hóa lỏng mỡ thừa.",
    "script": "Giới thiệu dòng **Kem massage giảm béo nóng Desembre** kết hợp với RF để tăng hiệu quả đốt mỡ x3 lần và Serum nâng cơ peptide."
  }
}'::jsonb;

-- Reload postgrest schema
NOTIFY pgrst, 'reload schema';
