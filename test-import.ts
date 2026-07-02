import { adaptMappedRow, validateImportRow } from "./src/lib/customers/importValidation";

const mappedData = {
  historical_order_count: "null",
};

const adapted = adaptMappedRow(mappedData, {}, 0);
const validated = validateImportRow(adapted);

console.log("adapted.historical_order_count:", adapted.historical_order_count);
console.log("validated errors:", validated.validation_errors);
