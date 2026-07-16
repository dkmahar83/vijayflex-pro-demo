const { z } = require('zod')

const vendorItemSchema = z.object({
  name: z.string().optional(),
  qty: z.coerce.number().optional(),
  unit: z.string().optional(),
  rate: z.coerce.number().optional(),
  amount: z.coerce.number().optional()
})

const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  phone: z.string().optional().nullable(),
  shop_type: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
})

const updateVendorSchema = createVendorSchema

const vendorPurchaseSchema = z.object({
  amount: z.coerce.number().positive('amount is required'),
  description: z.string().optional().nullable(),
  transaction_date: z.string().optional().nullable(),
  items: z.array(vendorItemSchema).optional().default([])
})

const vendorPaymentSchema = z.object({
  amount: z.coerce.number().positive('amount is required'),
  description: z.string().optional().nullable(),
  transaction_date: z.string().optional().nullable(),
  payment_method: z.preprocess(v => (v === '' ? undefined : v), z.enum(['cash', 'upi', 'bank']).optional()),
  upi_account: z.string().optional().nullable(),
  bank_transfer_type: z.string().optional().nullable()
})

module.exports = { createVendorSchema, updateVendorSchema, vendorPurchaseSchema, vendorPaymentSchema }