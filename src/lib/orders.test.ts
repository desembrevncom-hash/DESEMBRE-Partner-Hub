import { describe, expect, it } from "vitest";
import { calculateOrderTotal, validateAndPrepareOrder } from "./orders";

describe("calculateOrderTotal", () => {
  it("calculates total for one item", () => {
    const total = calculateOrderTotal([
      {
        productId: "p1",
        name: "Product A",
        unitPrice: 100000,
        quantity: 2,
      },
    ]);

    expect(total).toBe(200000);
  });

  it("calculates total for multiple items", () => {
    const total = calculateOrderTotal([
      {
        productId: "p1",
        name: "Product A",
        unitPrice: 100000,
        quantity: 2,
      },
      {
        productId: "p2",
        name: "Product B",
        unitPrice: 50000,
        quantity: 1,
      },
    ]);

    expect(total).toBe(250000);
  });

  it("returns 0 for empty cart", () => {
    const total = calculateOrderTotal([]);

    expect(total).toBe(0);
  });
});

describe("validateAndPrepareOrder", () => {
  it("fails if cart is empty", () => {
    const result = validateAndPrepareOrder({
      items: [],
      customerName: "Nguyễn Văn A",
      role: "sale",
      includeVat: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Giỏ hàng rỗng, không thể tạo đơn hàng.");
  });

  it("fails if customer name is empty", () => {
    const result = validateAndPrepareOrder({
      items: [
        {
          productId: "p1",
          name: "Product A",
          unitPrice: 100000,
          quantity: 1,
        },
      ],
      customerName: "   ",
      role: "sale",
      includeVat: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Vui lòng nhập tên khách hàng.");
  });

  it("successfully prepares valid order for sale role with VAT", () => {
    const result = validateAndPrepareOrder({
      items: [
        {
          productId: "p1",
          name: "Product A",
          unitPrice: 100000,
          quantity: 2, // subtotal = 200,000
        },
        {
          productId: "p2",
          name: "Product B",
          unitPrice: 50000,
          quantity: 1, // subtotal += 50,000 => 250,000
        },
      ],
      customerName: "Spa Thùy Dung",
      role: "sale",
      includeVat: true, // discount 40% => 150,000. VAT 8% => 12,000. total = 162,000
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.subtotal).toBe(250000);
      expect(result.data.discountRate).toBe(0.4);
      expect(result.data.vatAmount).toBe(12000);
      expect(result.data.total).toBe(162000);
      expect(result.data.itemCount).toBe(3);
    }
  });
});
