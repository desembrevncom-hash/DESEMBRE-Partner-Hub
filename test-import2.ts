const mappedData = { historical_order_count: "null" };

// the code from the OLD build
const historical_order_count = mappedData.historical_order_count ? parseInt(mappedData.historical_order_count, 10) : null;
console.log("if 'null':", historical_order_count, Number.isNaN(historical_order_count as any) ? "INVALID_NUMBER" : historical_order_count);

const mappedData2 = { historical_order_count: "" };
const historical_order_count2 = mappedData2.historical_order_count ? parseInt(mappedData2.historical_order_count, 10) : null;
console.log("if '':", historical_order_count2, Number.isNaN(historical_order_count2 as any) ? "INVALID_NUMBER" : historical_order_count2);

const mappedData3 = { historical_order_count: null };
const historical_order_count3 = mappedData3.historical_order_count ? parseInt(mappedData3.historical_order_count as any, 10) : null;
console.log("if null:", historical_order_count3, Number.isNaN(historical_order_count3 as any) ? "INVALID_NUMBER" : historical_order_count3);

