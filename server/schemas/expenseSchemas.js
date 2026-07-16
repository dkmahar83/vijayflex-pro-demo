const { z } = require('zod')

const emptyToNull = (val) => (val === '' || val === undefined ? null : val)

const createExpenseSchema = z.object({
  category: z.string().trim().min(1, 'category is required'),
  amount: z.coerce.number().positive('amount must be greater than 0'),
  expense_date: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  paid_to_type: z.preprocess(emptyToNull, z.enum(['vendor', 'employee']).nullable()).optional(),
  paid_to_id: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()).optional(),
  payment_mode: z.preprocess(emptyToNull, z.enum(['cash', 'upi']).optional()),
  upi_account: z.string().optional().nullable(),
  utr_number: z.string().optional().nullable(),
  denomination_breakdown: z.record(z.any()).optional().nullable(),
  customer_id: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()).optional(),
  customer_name: z.string().optional().nullable()
}).refine(
  data => data.category !== 'Commission' || !!data.customer_id,
  { message: 'Commission ke liye customer select karna zaroori hai', path: ['customer_id'] }
)

module.exports = { createExpenseSchema }