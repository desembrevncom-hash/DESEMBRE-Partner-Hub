-- M56 Customer Location Normalization
-- AUDIT REPORT ONLY
-- DO NOT RUN ANY UPDATES ON PRODUCTION

-- 1. Find all customers with non-canonical city values
SELECT 
    id, 
    business_name, 
    contact_name, 
    phone, 
    city, 
    address 
FROM public.customers 
WHERE 
    (city IS NOT NULL AND city NOT IN (
        'Hà Nội', 'TP Huế', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn', 'Quảng Ninh', 
        'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 
        'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'TP Hải Phòng', 'Ninh Bình', 'Quảng Trị', 'TP Đà Nẵng', 
        'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'TP Hồ Chí Minh', 'Đồng Nai', 
        'Tây Ninh', 'TP Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang'
    ));

-- 2. Count of bad provinces to see the most common issues
SELECT 
    city AS raw_location, 
    COUNT(*) as affected_customers
FROM public.customers 
WHERE 
    (city IS NOT NULL) AND
    (city NOT IN (
        'Hà Nội', 'TP Huế', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn', 'Quảng Ninh', 
        'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 
        'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'TP Hải Phòng', 'Ninh Bình', 'Quảng Trị', 'TP Đà Nẵng', 
        'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'TP Hồ Chí Minh', 'Đồng Nai', 
        'Tây Ninh', 'TP Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang'
    ))
GROUP BY raw_location
ORDER BY affected_customers DESC;
