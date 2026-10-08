# 10: REVENUE_LEDGER_SPEC (proposal)

Directive: v3 §1 (FORECAST ≠ INVOICE ≠ COLLECTED ≠ PROFIT ≠ OWNER-DISTRIBUTABLE CASH), §26–§27,
§29 (Oct 8–12 "revenue ledger"); v2 §1.10–20, §16 (monthly income definition), §17 (cash
waterfall), §25 (reconciliation), §22 (owner payout needs explicit authority).

## PURPOSE

Make every revenue figure traceable to evidence. No state may be promoted without that evidence.

## CURRENT STATE

- Revenue ledger and reconciliation: NOT_PRESENT (E20).
- Verified cash collected to date: **UNKNOWN**. MRR: **UNKNOWN**.
- The repo is public (E19), so ledger data must never be committed.

## PROPOSED MODEL

**States.** These are strictly separate. FORECAST is a separate track and never counts as revenue.

```text
FORECAST ─(quote evidence)→ QUOTED ─(invoice/receivable evidence)→ INVOICED ─(payment evidence)→ COLLECTED
COLLECTED ─(refund/chargeback evidence)→ REFUNDED (full or partial; partial = reversing entry)
COLLECTED ─(payout/bank match evidence)→ RECONCILED
RECONCILED (month closed) ─(waterfall computation)→ contributes to OWNER_DISTRIBUTABLE_CASH_CANDIDATE
```

**Required evidence per transition.** A transition without its evidence is rejected.

| Transition | Required evidence (stored as `Evidence` refs) | Must NOT count as evidence |
| --- | --- | --- |
| → FORECAST | Assumptions record (inputs, source, author, date) | — (FORECAST is never revenue) |
| FORECAST → QUOTED | **Either** a quote/proposal document to an identified counterparty plus a send record (authority ref + message ID, spec 09) **or**, for self-serve, an APPROVED plan price (spec 01) | Draft quotes; verbal intent; "approved deal" without document (v2 §1.16) |
| QUOTED → INVOICED | **Either** an issued invoice (number, date, amount, counterparty) **or** a signed provider checkout/order event (signature-verified webhook id) **or** a program-reported receivable (partner report export with date) for affiliate/ad networks | Invoice drafts; checkout *started*; trial start (v2 §1.18) |
| INVOICED → COLLECTED | Signature-verified provider payment-success event id **or** bank credit line (date, amount, reference) **or** network payment remittance | Invoice sent (v2 §1.17); dashboard "estimated earnings" |
| COLLECTED → REFUNDED | Provider refund/chargeback event id **or** bank debit line | Refund *requested* |
| COLLECTED → RECONCILED | Payout/bank statement line matched to one or more COLLECTED entries; amount minus fees equals payout, **or** the variance is recorded with an explanation (v2 §25) | Provider balance alone, before payout |
| RECONCILED → OWNER_DISTRIBUTABLE_CASH_CANDIDATE (monthly) | Closed month; complete cost ledger (all expense entries evidenced); founder-set tax-reserve and business-reserve rules (F13); computation per the v2 §16–§17 waterfall | Any unreconciled entry; any FORECAST |

**Owner payout.** OWNER_DISTRIBUTABLE_CASH_CANDIDATE is a **report value only**. Executing a
payout needs explicit PAYMENT authority (v2 §16, §22; F13). GILDEN never moves money.

**Bookkeeping rules.**

- Append-only, with corrections by reversing entries.
- Amounts in minor units with a currency code.
- FX rate source and date are recorded at reconciliation; the FX source is `<FOUNDER_DECISION>` (F02).
- Every entry carries an attribution key or `UNATTRIBUTED` (spec 04).
- Every entry links back to its CRM opportunity or plan.

**Cost side.** Expense entries (hosting, provider fees, software, compute, model/API, marketing,
contractors) carry the same evidence discipline: an invoice or bank debit. That makes the v3 §42
monthly P&L computable.

## DATA MODEL

```text
LedgerEntry { entry_id, stream: ADS|SPONSOR|AFFILIATE|PRO|TEAM|ENTERPRISE|HOSTED|API_OEM|MARKETPLACE|SERVICES|OTHER,
              state, amount_minor, currency, counterparty_ref, plan_id?|campaign_id?|program_id?|opportunity_id?,
              attribution_key|UNATTRIBUTED, evidence_refs[], previous_entry_id?, created_at, created_by }
Transition  { from_state, to_state, entry_id, evidence_refs[] (non-empty, type-checked per table), at, actor }
Evidence    { evidence_id, type: QUOTE_DOC|SEND_RECORD|INVOICE|PROVIDER_EVENT|PARTNER_REPORT|BANK_LINE|PAYOUT_LINE|ASSUMPTIONS|CONTRACT,
              ref (id/number), sha256 of stored artifact, stored_at (off-repo location), captured_at }
ExpenseEntry { expense_id, category, amount_minor, currency, evidence_refs[], period }
MonthClose  { month, reconciled_net_cash, refunds, fees, costs, tax_reserve, business_reserve,
              owner_distributable_cash_candidate, unreconciled_count (must be 0 or listed), closed_by, founder_ack_ref }
```

## AUTHORITY BOUNDARY

GILDEN may:

- record entries from evidence;
- propose reconciliations;
- compute the candidate figure.

The founder decides (F13, F02):

- the reserve rules;
- the month-close acknowledgement;
- the storage location;
- any payout.

## PRIVACY BOUNDARY

- Counterparty data is minimal (business identity).
- No SPE end-user content.
- Payment card data is never stored; the provider holds it.
- All ledger data is kept off the public repo (E19).

## SECURITY BOUNDARY

- Evidence artifacts are hashed (sha256) and kept at the off-repo store.
- The ledger is integrity-checked by a hash chain over entries (proposal).
- Webhook-derived entries require verified signatures and idempotency.

## ZERO-COST IMPACT

A local or private store costs nothing. Accounting software would be a cost, conflicting with E7
(C12).

## FOUNDER DECISIONS REQUIRED

F13 (storage, reserves, month-close owner, payout authority), F02 (currency, FX, tax), F03
(provider event source).

## IMPLEMENTATION DEPENDENCIES

- Spec 02 (entitlement events).
- Spec 03 (commercial events).
- Spec 04 (attribution).
- Spec 09 (opportunities).
- Provider choice (F03).
- Bank or statement access is founder-provided only; GILDEN never opens accounts.

## QUALIFICATION PLAN

1. A transition with missing or wrong-type evidence is rejected (test per table row).
2. FORECAST never appears in revenue totals.
3. A duplicate provider event produces no duplicate entry.
4. Partial refund reversal is correct.
5. Month close is blocked while unreconciled entries exist, unless they are listed.
6. The candidate equals the waterfall computation on fixtures.
7. A public repo scan finds no ledger data.

## ROLLBACK / DISABLE PATH

- The ledger is append-only and never "rolled back".
- Errors are fixed with reversing entries.
- Ingestion can be paused per source.

## UNKNOWN / HOLD

- All amounts to date: UNKNOWN.
- Reserve percentages: `<FOUNDER_DECISION>`.
- Tax treatment: UNKNOWN (legal/tax).

## ACCEPTANCE CRITERIA

- [ ] The seven states accepted as distinct.
- [ ] The evidence-per-transition table accepted.
- [ ] Payout-needs-authority accepted.
- [ ] Off-repo storage accepted.
- [ ] F13 decided.
