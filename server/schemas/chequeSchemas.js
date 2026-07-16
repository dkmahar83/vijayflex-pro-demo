const { z } = require('zod')

const createChequeSchema = z.object({
  cheque_number: z.string().optional().nullable(),
  firm_name: z.string().trim().min(1, 'firm_name and amount required'),
  customer_id: z.preprocess(v => (v === '' || v === undefined ? null : v), z.coerce.number().int().positive().nullable()).optional(),
  bank_name: z.string().optional().nullable(),
  amount: z.coerce.number().positive('firm_name and amount required'),
  received_date: z.string().optional().nullable(),
  order_id: z.preprocess(v => (v === '' || v === undefined ? null : v), z.coerce.number().int().positive().nullable()).optional(),
  notes: z.string().optional().nullable()
})

const updateChequeStatusSchema = z.object({
  status: z.enum(['received', 'deposited', 'cleared', 'bounced'])
})

const updateChequeSchema = z.object({
  cheque_number: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  received_date: z.string().optional().nullable()
})

module.exports = { createChequeSchema, updateChequeStatusSchema, updateChequeSchema }