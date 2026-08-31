# ABSP Cash Finance Ledger

Step 8 makes ABSP the authoritative **record** of fees, payroll, and operating expenses. Money continues to move in cash. The platform does not initiate, hold, settle, or verify electronic payments.

## Ledger model

- `FeePlan` and `StudentFeeAssignment` define prospective monthly student charges.
- `FinanceInvoice` and `FinanceInvoiceLine` freeze student fees, teacher payroll, and operating obligations for a period.
- `CashTransaction` records cash received or paid. Every request has a scope-local idempotency key and payload hash.
- `PaymentAllocation` connects some or all of a cash transaction to an invoice. Any remainder is unapplied cash/advance.
- `LedgerAdjustment` appends discounts, charges, or corrections without rewriting an invoice.
- `LedgerExpense` records the vendor/category evidence behind an operating-expense invoice.
- `CashReceipt` gives every cash transaction a stable receipt number.

Invoices, lines, cash transactions, allocations, adjustments, expenses, and receipts are immutable. Errors are corrected with a new adjustment or reversal transaction. Audit events are written for cash, adjustments, and fee assignments.

## Reconciliation behavior

- Partial payment leaves a positive invoice balance.
- Overpayment allocates only the invoice balance and reports the remainder as unapplied cash.
- A discount is a credit adjustment; an extra charge is a debit adjustment.
- A reversal creates an equal cash movement in the opposite direction and reverses the original allocation. The original transaction remains unchanged.
- Monthly summaries are rebuilt from invoices, adjustments, allocations, and cash transactions rather than saved totals.

All values are integer Bangladeshi taka under the current whole-taka policy. If fractional currency becomes necessary, add `amountMinor` fields in a versioned migration, backfill `amountTk * 100`, dual-read during reconciliation, and only then retire whole-taka writes.

## Safe rollout

`FINANCE_LEDGER_AUTHORITY_ENABLED=false` is the default. In this state the finance screen reports a ledger shadow/reconciliation result when one unambiguous active branch exists, while the legacy monthly tracker remains authoritative.

Inspect the opening migration first:

```text
npm run migrate:finance-ledger -- --environment=staging --database=<database> --limit=500
```

The dry run must have zero unresolved records and its opening expected/settled totals must match the reviewed legacy report. Then apply:

```text
npm run migrate:finance-ledger -- --environment=staging --database=<database> --limit=500 --apply --confirm=step8-finance-ledger-opening-v1
```

The migration uses deterministic identifiers and `$setOnInsert`, so retries do not duplicate invoices, cash, allocations, expenses, fee plans, assignments, or receipts. Enable ledger authority only after the returned reconciliation is approved. Rollback is setting the flag to `false`; immutable ledger evidence is retained.
