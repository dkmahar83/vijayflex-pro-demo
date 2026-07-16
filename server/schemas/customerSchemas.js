const { z } = require('zod')

const createCustomerSchema = z.object({
  firm_name: z.string().trim().min(1, 'firm_name is required'),
  contact_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable()
})

// PUT /:id ke liye bhi same — firm_name required.
// NOTE: ye original route se ek badlaav hai (route mein pehle koi check nahi tha).
// Bina iske, undefined firm_name aane par sqlite3 crash karta tha ("can not bind of undefined").
// Ab wo case route tak pahunchne se pehle hi clean 400 error dega.
const updateCustomerSchema = createCustomerSchema

const openingBalanceSchema = z.object({
  amount: z.coerce.number().positive('Valid amount required'),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
})

module.exports = { createCustomerSchema, updateCustomerSchema, openingBalanceSchema }