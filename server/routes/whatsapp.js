const express = require('express')
const router = express.Router()
const db = require('../db/database')
const PDFDocument = require('pdfkit')
const axios = require('axios')
const { getStatus, getLastQR, sendBillToCustomer } = require('../whatsapp')
const { getUpiAccountName } = require('../config/upiAccounts')

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getStatus())
})

// GET /api/whatsapp/qr
router.get('/qr', (req, res) => {
  if (process.env.DISABLE_WHATSAPP === 'true') {
    return res.json({ qr: null, disabled: true, message: 'Disabled in Demo due to security reasons' })
  }
  const qr = getLastQR()
  if (!qr) return res.json({ qr: null, message: 'No QR pending or already connected' })
  res.json({ qr })
})

// POST /api/whatsapp/send-bill/:orderId
router.post('/send-bill/:orderId', async (req, res) => {
  // Demo-safety guard — koi bhi PDF-fetch/WhatsApp-call try karne se pehle
  // hi block, taaki galti se koi partial-attempt bhi na ho.
  if (process.env.DISABLE_WHATSAPP === 'true') {
    return res.status(403).json({ error: 'Disabled in Demo due to security reasons', disabled: true })
  }

  const { orderId } = req.params

  try {
    db.get(`
      SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
      WHERE orders.id = ?
    `, [orderId], async (err, order) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (!order.phone) return res.status(400).json({ error: 'Customer has no phone number. Add phone number in customer profile first.' })

      try {
        // Fetch the SAME PDF that the download button uses
        const pdfResponse = await axios.get(
          `http://localhost:${process.env.PORT || 5000}/api/pdf/bill/${orderId}`,
          {
            responseType: 'arraybuffer',
            headers: { Authorization: req.headers.authorization }
          }
        )

        const pdfBuffer = Buffer.from(pdfResponse.data)

        // Calculate paid amount
        const paidAmount = (order.total_amount || 0) - (order.balance_due || 0)

        // Send via WhatsApp
        const { upiId } = req.body

        const result = await sendBillToCustomer({
          phone: order.phone,
          customerName: order.firm_name,
          orderId: order.id,
          totalAmount: order.total_amount,
          advancePaid: order.advance_paid || 0,
          balanceDue: order.balance_due || 0,
          pdfBuffer,
          upiId: upiId || null
        })

        // Activity log save karo
        if (upiId && (order.balance_due || 0) > 0) {
          const label = getUpiAccountName(upiId)

          const activity = `📲 Payment request of ₹${order.balance_due} sent via UPI QR (${label}) on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`

          db.run(
            `INSERT INTO order_activity_log (order_id, activity) VALUES (?, ?)`,
            [order.id, activity],
            (err) => { if (err) console.error('Activity log error:', err.message) }
          )
        }

        res.json({
          success: true,
          message: `Bill sent to ${order.firm_name} (${result.phone}) on WhatsApp ✅`,
          phone: result.phone
        })

      } catch (innerErr) {
        res.status(500).json({ error: innerErr.message })
      }
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Shared PDF builder — same as pdf.js
function buildPDF(doc, order, items, payments) {
  const PRIMARY = '#1a1a2e'
  const GREEN = '#27ae60'
  const RED = '#e74c3c'
  const GRAY = '#888888'
  const LIGHT = '#f8f8f8'
  const pageWidth = doc.page.width - 100

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(22).font('Helvetica-Bold').text('VijayFlex Pro', 50, 20)
  doc.fill('#aaaaaa').fontSize(10).font('Helvetica').text('Pilibangan, Rajasthan', 50, 46).text('Professional Flex Printing Services', 50, 60)
  doc.fill('#ffffff').fontSize(12).font('Helvetica-Bold').text(`BILL #${order.id}`, 0, 28, { align: 'right', width: doc.page.width - 50 })
  doc.fill('#aaaaaa').fontSize(9).font('Helvetica').text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), 0, 46, { align: 'right', width: doc.page.width - 50 })

  // Customer info
  const infoTop = 100
  doc.rect(50, infoTop, pageWidth, 90).fill(LIGHT).stroke('#eeeeee')
  doc.fill(PRIMARY).fontSize(9).font('Helvetica-Bold').text('BILL TO', 65, infoTop + 12)
  doc.fill(PRIMARY).fontSize(14).font('Helvetica-Bold').text(order.firm_name, 65, infoTop + 26)
  if (order.contact_name) doc.fill(GRAY).fontSize(10).font('Helvetica').text(`Contact: ${order.contact_name}`, 65, infoTop + 46)
  if (order.phone) doc.fill(GRAY).fontSize(10).text(`Phone: ${order.phone}`, 65, infoTop + 62)
  const metaX = 350
  doc.fill(GRAY).fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS', metaX, infoTop + 12)
  doc.fill(PRIMARY).fontSize(10).font('Helvetica').text(`Order #: ${order.id}`, metaX, infoTop + 26).text(`Status: ${(order.status || 'pending').replace('_', ' ').toUpperCase()}`, metaX, infoTop + 40)
  if (order.description) doc.fill(GRAY).fontSize(9).text(order.description, metaX, infoTop + 68, { width: 180 })

  // Items table
  const tableTop = infoTop + 110
  doc.rect(50, tableTop, pageWidth, 28).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(9).font('Helvetica-Bold')
  doc.text('ITEM', 65, tableTop + 10)
  doc.text('QTY', 290, tableTop + 10)
  doc.text('RATE', 360, tableTop + 10)
  doc.text('AMOUNT', 430, tableTop + 10)

  let rowY = tableTop + 28
  let totalAmount = 0
  items.forEach((item, i) => {
    const subtotal = parseFloat(item.subtotal) || (item.quantity * item.unit_price)
    totalAmount += subtotal
    if (i % 2 === 0) doc.rect(50, rowY, pageWidth, 28).fill('#fafafa')
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text(item.item_name || '—', 65, rowY + 9, { width: 220 })
    doc.fill(GRAY).fontSize(9).font('Helvetica').text(String(item.quantity), 290, rowY + 9).text(`₹${item.unit_price}`, 360, rowY + 9)
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text(`₹${subtotal.toFixed(0)}`, 430, rowY + 9)
    doc.moveTo(50, rowY + 28).lineTo(50 + pageWidth, rowY + 28).strokeColor('#eeeeee').stroke()
    rowY += 28
  })

  // Totals
  const totalsTop = rowY + 16
  const col4 = 430
  doc.fill(GRAY).fontSize(10).font('Helvetica').text('Subtotal:', 350, totalsTop, { width: 100, align: 'right' })
  doc.fill(PRIMARY).fontSize(10).font('Helvetica').text(`₹${totalAmount.toFixed(0)}`, col4, totalsTop)
  let currentY = totalsTop + 20
  if (order.advance_paid > 0) {
    doc.fill(GRAY).fontSize(10).text('Advance:', 350, currentY, { width: 100, align: 'right' })
    doc.fill(GREEN).fontSize(10).text(`- ₹${order.advance_paid}`, col4, currentY)
    currentY += 20
  }
  if (payments && payments.length > 0) {
    const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0)
    doc.fill(GRAY).fontSize(10).text('Payments:', 350, currentY, { width: 100, align: 'right' })
    doc.fill(GREEN).fontSize(10).text(`- ₹${paymentsTotal}`, col4, currentY)
    currentY += 20
  }
  doc.moveTo(350, currentY).lineTo(50 + pageWidth, currentY).strokeColor(PRIMARY).lineWidth(1).stroke()
  currentY += 8
  const balColor = order.balance_due > 0 ? RED : GREEN
  doc.rect(340, currentY, pageWidth - 290, 36).fill(order.balance_due > 0 ? '#fff5f5' : '#f0fff4')
  doc.fill(balColor).fontSize(13).font('Helvetica-Bold').text('BALANCE DUE:', 350, currentY + 10, { width: 100, align: 'right' }).text(`₹${order.balance_due}`, col4, currentY + 10)

  // Footer
  const footerY = doc.page.height - 80
  doc.rect(0, footerY, doc.page.width, 80).fill(PRIMARY)
  doc.fill('#ffffff').fontSize(12).font('Helvetica-Bold').text('Thank you for your business!', 50, footerY + 18)
  doc.fill('#aaaaaa').fontSize(9).font('Helvetica').text('VijayFlex Pro — Pilibangan, Rajasthan', 50, footerY + 38)
}

// POST /api/whatsapp/send-statement/:customerId
router.post('/send-statement/:customerId', async (req, res) => {
  if (process.env.DISABLE_WHATSAPP === 'true') {
    return res.status(403).json({ error: 'Disabled in Demo due to security reasons', disabled: true })
  }

  const { customerId } = req.params

  db.get(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL`, [customerId], async (err, customer) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    if (!customer.phone) return res.status(400).json({ error: 'Customer ka phone number nahi hai' })

    db.all(`SELECT * FROM orders WHERE customer_id = ? AND deleted_at IS NULL`, [customerId], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message })

      db.all(`SELECT * FROM payments WHERE customer_id = ?`, [customerId], (err, allPayments) => {
        if (err) return res.status(500).json({ error: err.message })

        db.all(`
          SELECT * FROM cash_income
          WHERE customer_id = ?
            AND (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance'))
        `, [customerId], async (err, cashIncomes) => {
          if (err) return res.status(500).json({ error: err.message })

          const totalBilled   = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
          const totalAdvance  = orders.reduce((s, o) => s + parseFloat(o.advance_paid || 0), 0)
          const totalPayments = allPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
          const totalCash     = cashIncomes.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
          const totalDiscount = orders.reduce((s, o) => s + parseFloat(o.discount_amount || 0), 0)
          const totalDue      = totalBilled - (totalAdvance + totalPayments + totalCash) - totalDiscount

          try {
            const pdfResponse = await axios.get(
              `http://localhost:${process.env.PORT || 5000}/api/pdf/statement/${customerId}`,
              { responseType: 'arraybuffer', headers: { Authorization: req.headers.authorization } }
            )
            const pdfBuffer = Buffer.from(pdfResponse.data)
            const { upiId } = req.body

            let formattedPhone = customer.phone.replace(/\D/g, '')
            if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1)
            // Length-based — root whatsapp.js (sendBillToCustomer) mein jo fix diya
            // tha, wo yahan cover nahi karta kyunki ye route apna khud ka client-call
            // use karta hai. Same ambiguous startsWith('91') bug yahan duplicate tha.
            if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone

            const { getClient, getStatus } = require('../whatsapp')
            const { MessageMedia } = require('whatsapp-web.js')
            const QRCode = require('qrcode')
            const status = getStatus()
            if (!status.ready) throw new Error('WhatsApp not connected. Please scan QR code first.')
            const waClient = getClient()

            // send-bill (sendBillToCustomer ke through) already getNumberId se confirm
            // karta hai number WhatsApp pe hai ya nahi — yahan missing thi, add kar di
            // taaki dono routes consistent behave karein (silent-wrong-send se bachne ke liye).
            const numberId = await waClient.getNumberId(formattedPhone)
            if (!numberId) throw new Error(`WhatsApp account nahi mila: ${formattedPhone}`)
            const chatId = numberId._serialized

            const message = `📋 *Account Statement — ${customer.firm_name}*\n\n` +
              `Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n` +
              (totalDue > 0 ? `⚠️ *Balance Due: ₹${totalDue.toFixed(0)}*\n\n` : `✅ *Account is Clear*\n\n`) +
              `Please find your complete account statement attached.\n\n_VijayFlex Pro, Pilibangan_`

            await waClient.sendMessage(chatId, message)

            if (totalDue > 0 && upiId) {
              const upiString = `upi://pay?pa=${upiId}&pn=VijayFlex%20Pro&am=${totalDue.toFixed(0)}&cu=INR&tn=Account%20Balance`
              if (totalDue > 2000) {
                await waClient.sendMessage(chatId,
                  `💳 *Payment Link — ₹${totalDue.toFixed(0)}*\n\n${upiString}\n\n_VijayFlex Pro, Pilibangan_`
                )
              } else {
                const qrBuffer = await QRCode.toBuffer(upiString, { type: 'png', width: 400 })
                const qrMedia  = new MessageMedia('image/png', qrBuffer.toString('base64'), `PayNow.png`)
                await waClient.sendMessage(chatId, qrMedia)
                await waClient.sendMessage(chatId, `📲 *Scan to Pay Balance ₹${totalDue.toFixed(0)}*`)
              }
            }

            const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), `Statement-${customer.firm_name}.pdf`)
            await waClient.sendMessage(chatId, media)

            res.json({ success: true, message: `Statement sent to ${customer.firm_name} ✅`, phone: formattedPhone })

          } catch (err) {
            res.status(500).json({ error: err.message })
          }
        })
      })
    })
  })
})

module.exports = router