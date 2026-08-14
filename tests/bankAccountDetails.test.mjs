import test from "node:test";
import assert from "node:assert/strict";

import {
  BANK_ACCOUNT_SETTING_KEY,
  normalizeBankAccountDetails,
} from "../utils/bankAccountDetails.js";

test("bank details endpoint uses the fixed setting key", () => {
  assert.equal(BANK_ACCOUNT_SETTING_KEY, "bank_account_details");
});

test("only whitelisted bank account fields are returned", () => {
  assert.deepEqual(
    normalizeBankAccountDetails({
      ownerName: "  فروشگاه تنادور  ",
      cardNumber: "6037990000000000",
      accountNumber: "123456",
      iban: "IR120000000000000000000000",
      internalNote: "must not leak",
      apiSecret: "must not leak",
    }),
    {
      ownerName: "فروشگاه تنادور",
      cardNumber: "6037990000000000",
      accountNumber: "123456",
      iban: "IR120000000000000000000000",
    },
  );
});

test("invalid or incomplete settings are represented as not configured", () => {
  assert.equal(normalizeBankAccountDetails(null), null);
  assert.equal(normalizeBankAccountDetails([]), null);
  assert.equal(normalizeBankAccountDetails({ ownerName: "تنادور" }), null);
});

test("non-string values and oversized fields are not exposed verbatim", () => {
  const details = normalizeBankAccountDetails({
    ownerName: { unexpected: true },
    cardNumber: "1".repeat(100),
  });

  assert.equal(details.ownerName, "");
  assert.equal(details.cardNumber, "1".repeat(32));
  assert.equal(details.accountNumber, "");
  assert.equal(details.iban, "");
});
