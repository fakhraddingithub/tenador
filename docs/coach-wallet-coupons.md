# Shared coach wallet and funded coupons

There is one balance: `User.walletBalance`. The old coach dashboard already read
this field, so no balance migration or addition of two balances is appropriate.
`CoachWalletTransaction` remains the reporting ledger for student purchase credit;
the user wallet merges it with review credits and the general wallet ledger.

## Creating a coupon

`POST /api/coach/coupons` authenticates the current active coach. The service
validates integer Tomans and the existing admin coupon code syntax. In one required
MongoDB transaction it claims a permanent `CoachCouponIssue` retry key, conditionally
debits the shared balance, creates a normal `Coupon`, and writes a wallet debit.
The existing unique `Coupon.code` index protects coach/admin namespace collisions.
No new index is needed for financial correctness; standard model indexes improve
history queries. A read-only deployment check confirmed the unique code index and
replica-set support at implementation time.

Funded coupons have a fixed amount, `usageLimit: 1`, no per-user restriction, no
minimum, no date limits and apply to all products. They retain creator ID/name.
Admin edit/delete endpoints protect these financial records against modification
or removal. They still appear in the admin coupon list with their actual usage.

## Consumption and remainder policy

The order stores the creator name as a historical snapshot. Checkout revalidates
prices and atomically changes `Coupon.usedAt` from null while creating the order,
payments, wallet debit (if any) and used-product reservation. Two users racing to
redeem one code cannot both succeed. Failed persistence rolls everything back.
Coupon-funded checkout uses the same permanent retry receipts as wallet checkout,
including when the requested wallet debit is zero.

Consumption occurs on final order creation, including orders with pending bank
receipts. Canceling/deleting an order does not reactivate its code or remove usage
history. The creator's history keeps the buyer name, timestamp and tracking code
without exposing phone/email/address information.

If the coupon exceeds the order value, the applied discount is capped to the order
and the unused face value returns to the creator's wallet in the same transaction.
`returnedAmount` and a separate wallet credit record explain that return. The code
is still consumed once. This policy is disclosed on the issuance form.

A coupon covering the complete order needs no receipt or installment document;
the order has zero payable and is paid/processing. No fictitious cash or wallet
payment is created. Normal wallet and bank payment totals remain unchanged.

## Coach purchase credit

Manual credit and its existing coach ledger now commit atomically. Automatic
credit is granted inside settlement transactions, with an order claim preventing
duplicate payment. Both pricing engines and settlement share the rule calculator.
Coach scope, priority, product/category/series scope, date bounds, minimum purchase
and first-purchase conditions are respected. Rule counters update with settlement.

`coachCreditEligible` is enabled for new checkout orders and genuine payment
transitions. Existing already-paid orders are not silently backfilled: historic
automatic balance changes may lack a ledger, and repaying them would duplicate
money. Existing balances and credit history are retained.

Canceling or deleting an order reverses automatic coach credit atomically and
records the reversal. If the coach has already spent that credit, cancellation or
deletion returns a conflict requiring the credit to be settled first; it never
creates an unbacked buyer refund or a negative available wallet balance. Manual
credit is not automatically reversed. Reopening an order does not grant twice.

## Checks

- `npm run test:coach-wallet`: disposable real MongoDB replica-set financial tests,
  concurrency, failure rollback, access control, privacy and history pagination.
- `npm run test:wallet-orders`: existing spending plus coupon/zero-total checkout.
- `npm run test:order-deletion`, `npm run test:review-credit`: adjacent regressions.
- `npx next build --webpack --experimental-build-mode compile`: module compilation
  without a production prerender/deployment or a real purchase.
