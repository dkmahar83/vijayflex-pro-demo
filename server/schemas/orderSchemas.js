const { z } = require('zod')

const orderItemSchema = z.object({
  item_name: z.string().trim().min(1, 'item_name is required'),
  quantity: z.coerce.number().positive('quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'unit_price cannot be negative'),
  length: z.coerce.number().optional().nullable(),
  breadth: z.coerce.number().optional().nullable(),
  item_date: z.string().optional().nullable()
})

const createOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive('customer_id is required'),
  description: z.string().optional().nullable(),
  advance_paid: z.coerce.number().min(0).optional(),
  advance_payment_mode: z.enum(['cash', 'upi']).optional(),
  advance_upi_account: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  discount_amount: z.coerce.number().min(0).optional(),
  discount_note: z.string().optional().nullable(),
  advance_denomination_breakdown: z.record(z.any()).optional().nullable(),
  advance_payment_date: z.string().optional().nullable()
}).refine(
  data => !(data.advance_paid > 0) || !!data.advance_payment_mode,
  { message: 'advance_payment_mode is required when advance_paid > 0', path: ['advance_payment_mode'] }
).refine(
  data => !(data.advance_paid > 0 && data.advance_payment_mode === 'upi') || !!data.advance_upi_account,
  { message: 'advance_upi_account is required when payment mode is UPI', path: ['advance_upi_account'] }
)

const updateOrderSchema = z.object({
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  advance_paid: z.coerce.number().min(0).optional(),
  advance_payment_mode: z.enum(['cash', 'upi']).optional().nullable(),
  advance_upi_account: z.string().optional().nullable(),
  discount_amount: z.coerce.number().min(0).optional(),
  discount_note: z.string().optional().nullable()
})

const updateOrderItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item required')
})

module.exports = { createOrderSchema, updateOrderSchema, updateOrderItemsSchema }