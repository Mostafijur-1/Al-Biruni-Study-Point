import mongoose, { type Document, type Model, Schema, Types } from "mongoose";

export type LedgerCounterpartyRole = "student" | "teacher" | "vendor";
export type LedgerInvoiceKind = "student-fee" | "teacher-payroll" | "operating-expense";

interface ScopedRecord { organizationId: Types.ObjectId; branchId: Types.ObjectId; createdAt: Date }

export interface IFeePlan extends Document, ScopedRecord {
  code: string; name: string; amountTk: number; billingCycle: "monthly"; activeFrom: string; activeTo?: string; status: "active" | "inactive"; createdBy: Types.ObjectId; updatedAt: Date;
}
export interface IStudentFeeAssignment extends Document, ScopedRecord {
  studentId: Types.ObjectId; feePlanId: Types.ObjectId; amountTk: number; effectiveFrom: string; effectiveTo?: string; status: "active" | "ended"; assignedBy: Types.ObjectId; updatedAt: Date;
}
export interface IFinanceInvoice extends Document, ScopedRecord {
  counterpartyId: Types.ObjectId; counterpartyRole: LedgerCounterpartyRole; kind: LedgerInvoiceKind; period: string; invoiceNumber: string; currency: "BDT"; totalTk: number; issuedAt: Date; dueAt?: Date; createdBy: Types.ObjectId; legacySource?: { collection: string; id: string };
}
export interface IFinanceInvoiceLine extends Document, ScopedRecord {
  invoiceId: Types.ObjectId; lineNo: number; description: string; quantity: number; unitAmountTk: number; amountTk: number; feePlanId?: Types.ObjectId; createdBy: Types.ObjectId;
}
export interface ICashTransaction extends Document, ScopedRecord {
  counterpartyId: Types.ObjectId; counterpartyRole: LedgerCounterpartyRole; direction: "in" | "out"; type: "payment" | "refund" | "reversal"; amountTk: number; occurredAt: Date; method: "cash"; reference?: string; note?: string; recordedBy: Types.ObjectId; idempotencyKey: string; payloadHash: string; reversesTransactionId?: Types.ObjectId; legacySource?: { collection: string; id: string };
}
export interface IPaymentAllocation extends Document, ScopedRecord {
  transactionId: Types.ObjectId; invoiceId: Types.ObjectId; amountTk: number; allocatedBy: Types.ObjectId;
}
export interface ILedgerAdjustment extends Document, ScopedRecord {
  invoiceId: Types.ObjectId; type: "discount" | "charge" | "correction" | "reversal"; amountTk: number; effect: "debit" | "credit"; reason: string; occurredAt: Date; recordedBy: Types.ObjectId; idempotencyKey: string; payloadHash: string; reversesAdjustmentId?: Types.ObjectId;
}
export interface ILedgerExpense extends Document, ScopedRecord {
  invoiceId: Types.ObjectId; category: "room-rent" | "electricity" | "other"; vendorName: string; period: string; amountTk: number; incurredAt: Date; note?: string; createdBy: Types.ObjectId; legacySource?: { collection: string; id: string };
}
export interface ICashReceipt extends Document, ScopedRecord {
  transactionId: Types.ObjectId; receiptNumber: string; issuedAt: Date; issuedBy: Types.ObjectId;
}

const scope = {
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
};
const legacySource = { collection: { type: String, trim: true, maxlength: 80 }, id: { type: String, trim: true, maxlength: 200 } };

function immutable<T>(schema: Schema<T>, label: string) {
  schema.pre("save", function () { if (!this.isNew && this.isModified()) throw new Error(`${label} records are immutable; append a reversal or adjustment.`); });
  for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
    schema.pre(operation, async function () { if (await this.model.exists(this.getFilter())) throw new Error(`${label} records are immutable; append a reversal or adjustment.`); });
  }
}

const FeePlanSchema = new Schema<IFeePlan>({ ...scope, code: { type: String, required: true, trim: true, maxlength: 40 }, name: { type: String, required: true, trim: true, maxlength: 160 }, amountTk: { type: Number, required: true, min: 0, max: 10_000_000 }, billingCycle: { type: String, enum: ["monthly"], default: "monthly" }, activeFrom: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, activeTo: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, status: { type: String, enum: ["active", "inactive"], default: "active" }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
FeePlanSchema.index({ organizationId: 1, branchId: 1, code: 1 }, { unique: true });

const StudentFeeAssignmentSchema = new Schema<IStudentFeeAssignment>({ ...scope, studentId: { type: Schema.Types.ObjectId, ref: "User", required: true }, feePlanId: { type: Schema.Types.ObjectId, ref: "FeePlan", required: true }, amountTk: { type: Number, required: true, min: 0, max: 10_000_000 }, effectiveFrom: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, effectiveTo: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, status: { type: String, enum: ["active", "ended"], default: "active" }, assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
StudentFeeAssignmentSchema.index({ organizationId: 1, branchId: 1, studentId: 1, effectiveFrom: 1 }, { unique: true });

const FinanceInvoiceSchema = new Schema<IFinanceInvoice>({ ...scope, counterpartyId: { type: Schema.Types.ObjectId, required: true }, counterpartyRole: { type: String, enum: ["student", "teacher", "vendor"], required: true }, kind: { type: String, enum: ["student-fee", "teacher-payroll", "operating-expense"], required: true }, period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, invoiceNumber: { type: String, required: true, trim: true, maxlength: 80 }, currency: { type: String, enum: ["BDT"], default: "BDT" }, totalTk: { type: Number, required: true, min: 0, max: 100_000_000 }, issuedAt: { type: Date, required: true }, dueAt: Date, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, legacySource }, { timestamps: { createdAt: true, updatedAt: false } });
FinanceInvoiceSchema.index({ organizationId: 1, branchId: 1, invoiceNumber: 1 }, { unique: true });
FinanceInvoiceSchema.index({ organizationId: 1, branchId: 1, counterpartyId: 1, period: 1, kind: 1 }, { unique: true });
immutable(FinanceInvoiceSchema, "Finance invoice");

const FinanceInvoiceLineSchema = new Schema<IFinanceInvoiceLine>({ ...scope, invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice", required: true }, lineNo: { type: Number, required: true, min: 1 }, description: { type: String, required: true, trim: true, maxlength: 300 }, quantity: { type: Number, required: true, min: 1 }, unitAmountTk: { type: Number, required: true, min: 0 }, amountTk: { type: Number, required: true, min: 0 }, feePlanId: { type: Schema.Types.ObjectId, ref: "FeePlan" }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: { createdAt: true, updatedAt: false } });
FinanceInvoiceLineSchema.index({ invoiceId: 1, lineNo: 1 }, { unique: true });
immutable(FinanceInvoiceLineSchema, "Finance invoice line");

const CashTransactionSchema = new Schema<ICashTransaction>({ ...scope, counterpartyId: { type: Schema.Types.ObjectId, required: true }, counterpartyRole: { type: String, enum: ["student", "teacher", "vendor"], required: true }, direction: { type: String, enum: ["in", "out"], required: true }, type: { type: String, enum: ["payment", "refund", "reversal"], required: true }, amountTk: { type: Number, required: true, min: 1, max: 100_000_000 }, occurredAt: { type: Date, required: true }, method: { type: String, enum: ["cash"], default: "cash" }, reference: { type: String, trim: true, maxlength: 120 }, note: { type: String, trim: true, maxlength: 500 }, recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, idempotencyKey: { type: String, required: true, trim: true, maxlength: 200 }, payloadHash: { type: String, required: true, match: /^[a-f\d]{64}$/ }, reversesTransactionId: { type: Schema.Types.ObjectId, ref: "CashTransaction" }, legacySource }, { timestamps: { createdAt: true, updatedAt: false } });
CashTransactionSchema.index({ organizationId: 1, branchId: 1, idempotencyKey: 1 }, { unique: true });
CashTransactionSchema.index({ organizationId: 1, branchId: 1, occurredAt: -1 });
CashTransactionSchema.index({ reversesTransactionId: 1 }, { unique: true, partialFilterExpression: { reversesTransactionId: { $type: "objectId" } } });
CashTransactionSchema.pre("validate", function () { if (this.type === "reversal" && !this.reversesTransactionId) this.invalidate("reversesTransactionId", "A reversal must reference the original cash transaction."); });
immutable(CashTransactionSchema, "Cash transaction");

const PaymentAllocationSchema = new Schema<IPaymentAllocation>({ ...scope, transactionId: { type: Schema.Types.ObjectId, ref: "CashTransaction", required: true }, invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice", required: true }, amountTk: { type: Number, required: true, min: 1, max: 100_000_000 }, allocatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: { createdAt: true, updatedAt: false } });
PaymentAllocationSchema.index({ transactionId: 1, invoiceId: 1 }, { unique: true });
PaymentAllocationSchema.index({ invoiceId: 1, createdAt: 1 });
immutable(PaymentAllocationSchema, "Payment allocation");

const LedgerAdjustmentSchema = new Schema<ILedgerAdjustment>({ ...scope, invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice", required: true }, type: { type: String, enum: ["discount", "charge", "correction", "reversal"], required: true }, amountTk: { type: Number, required: true, min: 1, max: 100_000_000 }, effect: { type: String, enum: ["debit", "credit"], required: true }, reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 }, occurredAt: { type: Date, required: true }, recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, idempotencyKey: { type: String, required: true, trim: true, maxlength: 200 }, payloadHash: { type: String, required: true, match: /^[a-f\d]{64}$/ }, reversesAdjustmentId: { type: Schema.Types.ObjectId, ref: "LedgerAdjustment" } }, { timestamps: { createdAt: true, updatedAt: false } });
LedgerAdjustmentSchema.index({ organizationId: 1, branchId: 1, idempotencyKey: 1 }, { unique: true });
LedgerAdjustmentSchema.index({ invoiceId: 1, occurredAt: 1 });
immutable(LedgerAdjustmentSchema, "Ledger adjustment");

const LedgerExpenseSchema = new Schema<ILedgerExpense>({ ...scope, invoiceId: { type: Schema.Types.ObjectId, ref: "FinanceInvoice", required: true, unique: true }, category: { type: String, enum: ["room-rent", "electricity", "other"], required: true }, vendorName: { type: String, required: true, trim: true, maxlength: 160 }, period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, amountTk: { type: Number, required: true, min: 0, max: 100_000_000 }, incurredAt: { type: Date, required: true }, note: { type: String, trim: true, maxlength: 500 }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, legacySource }, { timestamps: { createdAt: true, updatedAt: false } });
LedgerExpenseSchema.index({ organizationId: 1, branchId: 1, period: 1, category: 1 });
immutable(LedgerExpenseSchema, "Ledger expense");

const CashReceiptSchema = new Schema<ICashReceipt>({ ...scope, transactionId: { type: Schema.Types.ObjectId, ref: "CashTransaction", required: true, unique: true }, receiptNumber: { type: String, required: true, trim: true, maxlength: 80 }, issuedAt: { type: Date, required: true }, issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: { createdAt: true, updatedAt: false } });
CashReceiptSchema.index({ organizationId: 1, branchId: 1, receiptNumber: 1 }, { unique: true });
immutable(CashReceiptSchema, "Cash receipt");

function model<T>(name: string, schema: Schema<T>) { return (mongoose.models[name] as Model<T> | undefined) || mongoose.model<T>(name, schema); }
export const FeePlan = model<IFeePlan>("FeePlan", FeePlanSchema);
export const StudentFeeAssignment = model<IStudentFeeAssignment>("StudentFeeAssignment", StudentFeeAssignmentSchema);
export const FinanceInvoice = model<IFinanceInvoice>("FinanceInvoice", FinanceInvoiceSchema);
export const FinanceInvoiceLine = model<IFinanceInvoiceLine>("FinanceInvoiceLine", FinanceInvoiceLineSchema);
export const CashTransaction = model<ICashTransaction>("CashTransaction", CashTransactionSchema);
export const PaymentAllocation = model<IPaymentAllocation>("PaymentAllocation", PaymentAllocationSchema);
export const LedgerAdjustment = model<ILedgerAdjustment>("LedgerAdjustment", LedgerAdjustmentSchema);
export const LedgerExpense = model<ILedgerExpense>("LedgerExpense", LedgerExpenseSchema);
export const CashReceipt = model<ICashReceipt>("CashReceipt", CashReceiptSchema);
