const { z } = require('zod')

const createPaymentSchema = z.object({
  order_id: z.coerce.number().int().positive('order_id is required'),
  customer_id: z.coerce.number().int().positive('customer_id is required'),
  amount: z.coerce.number().positive('amount must be greater than 0'),
  payment_date: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  payment_mode: z.enum(['cash', 'upi', 'cheque']).optional(),
  upi_account: z.string().optional().nullable(),
  cheque_number: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  denomination_breakdown: z.record(z.any()).optional().nullable()
}).refine(
  data => data.payment_mode !== 'upi' || !!data.upi_account,
  { message: 'upi_account is required when payment_mode is upi', path: ['upi_account'] }
)

module.exports = { createPaymentSchema }