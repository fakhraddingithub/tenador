export const BANK_ACCOUNT_SETTING_KEY = "bank_account_details";

const FIELD_LIMITS = {
  ownerName: 120,
  cardNumber: 32,
  accountNumber: 64,
  iban: 34,
};

function normalizeField(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * SiteSetting.value is a Mixed field. Only the four values required by the
 * checkout UI may cross the customer-facing API boundary.
 */
export function normalizeBankAccountDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const details = Object.fromEntries(
    Object.entries(FIELD_LIMITS).map(([field, maxLength]) => [
      field,
      normalizeField(value[field], maxLength),
    ]),
  );

  if (!details.cardNumber && !details.accountNumber && !details.iban) return null;
  return details;
}
