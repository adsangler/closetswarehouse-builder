export const extraPartQuantityError = 'Extra-part quantities must be positive whole numbers. Remove invalid added parts and add them again with a valid quantity.';

export function isPositiveWholeQuantity(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function validateExtraPartQuantities(items = []) {
  return Array.isArray(items) && items.every(item => isPositiveWholeQuantity(item?.quantity))
    ? '' : extraPartQuantityError;
}
