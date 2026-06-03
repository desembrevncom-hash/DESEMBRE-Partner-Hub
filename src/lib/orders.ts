export type CartItem = {
  productId: string | number;
  name: string;
  unitPrice: number;
  quantity: number;
  size?: string;
  sizeType?: "retail" | "salon";
};

export type OrderCreationInput = {
  items: CartItem[];
  customerName: string;
  role: "admin" | "sale" | "guest";
  includeVat: boolean;
  vatRate?: number;
};

export function calculateOrderTotal(items: CartItem[]) {
  return items.reduce((total, item) => {
    return total + item.unitPrice * item.quantity;
  }, 0);
}

export function validateAndPrepareOrder(input: OrderCreationInput) {
  if (!input.items || input.items.length === 0) {
    return { ok: false as const, error: "Giỏ hàng rỗng, không thể tạo đơn hàng." };
  }

  const cleanName = (input.customerName || "").trim();
  if (!cleanName) {
    return { ok: false as const, error: "Vui lòng nhập tên khách hàng." };
  }

  const subtotal = calculateOrderTotal(input.items);
  const discountRate = input.role === "sale" ? 0.4 : 0;
  const priceAfterDiscount = Math.round(subtotal * (1 - discountRate));

  const vatRate = input.vatRate ?? 0.08;
  const vatAmount = input.includeVat ? Math.round(priceAfterDiscount * vatRate) : 0;
  const total = priceAfterDiscount + vatAmount;

  return {
    ok: true as const,
    data: {
      customerName: cleanName,
      subtotal,
      discountRate,
      vatRate: input.includeVat ? vatRate : 0,
      vatAmount,
      total,
      itemCount: input.items.reduce((acc, item) => acc + item.quantity, 0),
    },
  };
}
