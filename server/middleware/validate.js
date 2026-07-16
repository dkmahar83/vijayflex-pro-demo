// Generic Zod validation middleware — kisi bhi schema ke saath reuse hoga
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const first = result.error.issues[0]
      const field = first.path.join('.') || 'body'
      return res.status(400).json({ error: `${field}: ${first.message}` })
    }
    req.body = result.data // coerced/cleaned data (e.g. "500" → 500)
    next()
  }
}

module.exports = validate