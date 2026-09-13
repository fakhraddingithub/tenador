# Wallet checkout

All amounts are integer Tomans. Checkout prices, coupons and installment terms
are recomputed by the server. The client sends `walletAmount`, an expected gross
total (`expectedTotal`), and a stable random `checkoutKey` for that checkout.

## Accounting

- `Order.totalPrice` remains the price after product/coupon discounts, before
  payments. Wallet spending does not reduce revenue or increase coupon discounts.
- `Order.walletPaid` is the wallet amount currently applied to the order.
  `walletPaidOriginal` preserves the original debit after refunds.
- A confirmed `Payment` with method `WALLET` participates in existing paid-total
  calculations. Never subtract `walletPaid` again after summing confirmed payments.
- The bank receipt covers `totalPrice - walletPaid`. For installments, principal
  is `totalPrice - walletPaid - downPayment`, with the existing interest rules.
- Full wallet payment needs no receipt or installment documents. The order is
  paid and processing immediately. A later price increase can be paid by receipt.

## Atomicity and retries

`services/walletOrder.service.js` commits the conditional balance decrement,
order, confirmed wallet payment, pending external payment/installment, used-item
reservation, ledger and retry receipt in one MongoDB transaction. Wallet checkout
fails closed if transactions are unavailable; there is no standalone fallback.
MongoDB must support transactions (replica set or supported sharded deployment).

`WalletCheckout._id` hashes the authenticated user and checkout key. Its default
unique index prevents duplicate debits even before optional indexes are created.
Identical retries return the original receipt; changing a committed request's
payload returns 409. The ledger and retry receipt survive order deletion. Keep
these records when archiving orders or restoring financial backups.

## Refund behavior

- Admin cancellation or permanent deletion refunds the remaining wallet payment
  in the same transaction as the order mutation, once only.
- Lowering the order price refunds wallet credit exceeding the new total after
  other confirmed payments. Cash refunds are outside this mechanism.
- Rejecting a bank receipt leaves the wallet payment applied. Cancel the order
  to return that credit. Reopening an order never silently debits the wallet again.
- Wallet payments cannot be manually edited, approved or rejected as bank receipts.
- Refunds reduce the applied wallet Payment amount and append an immutable credit
  ledger entry. `meta.originalAmount` and `meta.refundedAmount` preserve the history.

## Verification

`npm run test:wallet-orders` covers real replica-set transactions, concurrent
spending, retries, partial/full/installment payments, write failures, refunds,
checkout validation, payment review races and wallet-history isolation.
`npm run test:order-deletion` also covers wallet refund rollback and retained retry
receipts through the actual order-deletion service.
`npm run test:review-credit` verifies the existing reward subsystem separately.

Tests use disposable local MongoDB instances, not production balances. Existing
legacy online callbacks are not used to settle wallet-funded orders.
