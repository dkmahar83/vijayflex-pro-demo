const express = require('express')
const router = express.Router()
const db = require('../db/database')
const PDFDocument = require('pdfkit')

// ══════════════════════════════════════════
//  SHOP CONFIG — apni details yahan bharo
// ══════════════════════════════════════════
const SHOP = {
  nameFontPath: './assets/fonts/Algerian.ttf',
  name        : 'Vijay Flex & Offset',
  ownerName   : 'Vijay Singh',
  mobile      : '+91 9950580621',
  mobile2     : '+91 8824387294',
  address     : 'Near New Bus Stand, Aggarwal Dharamshala Road, Pilibangan, Rajasthan (335803)',
  tagline     : 'All Type of Printing Solutions',
  logoPath    : './assets/Logo.png',
  watermarkPath : './assets/Watermark.png',
  signaturePath : './assets/Signature.png',
}

// GET /api/pdf/bill/:orderId
router.get('/bill/:orderId', (req, res) => {
  const { orderId } = req.params

  db.get(`
    SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?
  `, [orderId], (err, order) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [orderId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message })

      db.all(`SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date ASC, id ASC`, [orderId], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message })

        db.all(`SELECT * FROM cheques WHERE order_id = ? ORDER BY received_date ASC`, [orderId], (err, cheques) => {
          if (err) return res.status(500).json({ error: err.message })

          renderBill(res, order, items, payments, cheques || [])
        })
      })
    })
  })
})

function renderBill(res, order, items, payments, cheques) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${order.order_number || `bill-${order.id}`}.pdf`)
  doc.pipe(res)

  // ── COLORS ──
  const PRIMARY    = '#1a1a2e'
  const ACCENT     = '#2ecc71'
  const GREEN      = '#27ae60'
  const RED        = '#e74c3c'
  const PURPLE     = '#8e44ad'
  const ORANGE     = '#e67e22'
  const GRAY       = '#888888'
  const LIGHT_GRAY = '#f4f4f4'
  const WHITE      = '#ffffff'

  const PAGE_W  = doc.page.width
  const MARGIN  = 50
  const CONTENT = PAGE_W - MARGIN * 2   // 495pt usable width

  const FOOTER_H = 72
  const BODY_LIMIT = doc.page.height - FOOTER_H - 16   // keep 16pt breathing room above footer

  const rs = (val) => `Rs. ${parseFloat(val || 0).toFixed(0)}`

  const hRule = (y, color = '#dddddd', width = 1) => {
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y)
       .strokeColor(color).lineWidth(width).stroke()
  }

  const safeText = (text, maxChars) =>
    text && text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : (text || '—')

  // Format a datetime (or date) string into "DD Mon YYYY" + "HH:MM" pieces
  const fmtDateTime = (raw) => {
    if (!raw) return { date: '—', time: '' }
    const d = new Date(String(raw).replace(' ', 'T'))
    if (isNaN(d)) return { date: String(raw).split(' ')[0], time: '' }
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    return { date, time }
  }

  // ══════════════════════════════════════════
  //  HEADER — Jai Mata Di banner, logo left, big name, decorative tagline, address w/ pin
  // ══════════════════════════════════════════
  const HEADER_H = 150
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(PRIMARY)
  doc.rect(0, HEADER_H - 3, PAGE_W, 3).fill(ACCENT)

  let logoW = 0
  if (SHOP.logoPath) {
    try {
      doc.image(SHOP.logoPath, MARGIN, 26, { width: 95, height: 95 })
      logoW = 108
    } catch (e) { /* logo missing — skip */ }
  }

  let nameFont = 'Helvetica-Bold'
  if (SHOP.nameFontPath) {
    try {
      doc.registerFont('ShopNameFont', SHOP.nameFontPath)
      nameFont = 'ShopNameFont'
    } catch (e) { /* font file missing — fallback used */ }
  }

  const nameX = MARGIN + logoW
  const nameW = PAGE_W - nameX - MARGIN
  const centerX = nameX + nameW / 2

  const diamond = (cx, cy, r, color) => {
    doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]).fill(color)
  }

  const decorLine = (text, y, fontSize, font, color, lineColor) => {
    doc.fontSize(fontSize).font(font)
    const w = doc.widthOfString(text)
    const textStartX = centerX - w / 2
    const textEndX = centerX + w / 2
    const gap = 14

    doc.moveTo(nameX + 6, y).lineTo(textStartX - gap, y).strokeColor(lineColor).lineWidth(1).stroke()
    diamond(textStartX - gap + 7, y, 3, lineColor)
    doc.circle(textStartX - gap - 3, y, 1.3).fill(lineColor)

    doc.moveTo(textEndX + gap, y).lineTo(nameX + nameW - 6, y).strokeColor(lineColor).lineWidth(1).stroke()
    diamond(textEndX + gap - 7, y, 3, lineColor)
    doc.circle(textEndX + gap + 3, y, 1.3).fill(lineColor)

    doc.fill(color).text(text, textStartX, y - fontSize / 2 - 1, { lineBreak: false })
  }

  decorLine('JAI MATA DI', 22, 11, 'Helvetica-Bold', WHITE, ACCENT)

  const contactLine = SHOP.mobile2
    ? `${SHOP.ownerName}  |  ${SHOP.mobile}  /  ${SHOP.mobile2}`
    : `${SHOP.ownerName}  |  ${SHOP.mobile}`
  doc.fill(ACCENT).fontSize(10).font('Helvetica-Bold')
     .text(contactLine, nameX, 44, { align: 'right', width: nameW, lineBreak: false })

  // Auto-shrink shop name font so it always fits on one line in the available width
  let shopNameSize = 44
  doc.font(nameFont)
  while (shopNameSize > 18 && doc.fontSize(shopNameSize).widthOfString(SHOP.name) > nameW - 10) {
    shopNameSize -= 1
  }
  doc.fill(WHITE).fontSize(shopNameSize).font(nameFont)
     .text(SHOP.name, nameX, 60, { align: 'center', width: nameW, lineBreak: false })

  decorLine(SHOP.tagline.toUpperCase(), 118, 13, 'Helvetica-Bold', ACCENT, ACCENT)

  doc.fontSize(10).font('Helvetica')
  const addrW = doc.widthOfString(SHOP.address)
  const pinX = centerX - addrW / 2 - 12
  const pinY = 135

  // teardrop map-pin icon
  const pr = 4.5
  doc.save()
  doc.path(`M ${pinX} ${pinY - pr - 3}
            C ${pinX + pr + 2} ${pinY - pr - 3} ${pinX + pr + 2} ${pinY + pr - 1} ${pinX} ${pinY + pr + 4}
            C ${pinX - pr - 2} ${pinY + pr - 1} ${pinX - pr - 2} ${pinY - pr - 3} ${pinX} ${pinY - pr - 3}
            Z`)
     .fill(ACCENT)
  doc.circle(pinX, pinY - 2, 1.6).fill(PRIMARY)
  doc.restore()

  doc.fill('#dddddd').fontSize(10).font('Helvetica')
     .text(SHOP.address, centerX - addrW / 2, pinY - 5, { lineBreak: false })

  // ══════════════════════════════════════════
  //  INVOICE STRIP — icon-style badges for invoice # and date
  // ══════════════════════════════════════════
  const STRIP_TOP = HEADER_H + 16
  const STRIP_H   = 32

  const iconBoxW = 30
  doc.rect(MARGIN, STRIP_TOP, iconBoxW, STRIP_H).fill(PRIMARY)

  // hand-drawn document/page icon with folded top-right corner
  const docCX = MARGIN + iconBoxW / 2, docCY = STRIP_TOP + STRIP_H / 2
  const dw = 12, dh = 15, fold = 4
  const dLeft = docCX - dw / 2, dTop = docCY - dh / 2
  doc.save()
  doc.path(`M ${dLeft} ${dTop}
            L ${dLeft + dw - fold} ${dTop}
            L ${dLeft + dw} ${dTop + fold}
            L ${dLeft + dw} ${dTop + dh}
            L ${dLeft} ${dTop + dh}
            Z`)
     .strokeColor(ACCENT).lineWidth(1.1).stroke()
  doc.path(`M ${dLeft + dw - fold} ${dTop} L ${dLeft + dw - fold} ${dTop + fold} L ${dLeft + dw} ${dTop + fold}`)
     .strokeColor(ACCENT).lineWidth(1).stroke()
  // text lines inside the page
  doc.moveTo(dLeft + 2.5, dTop + 7).lineTo(dLeft + dw - 2, dTop + 7).strokeColor(ACCENT).lineWidth(0.8).stroke()
  doc.moveTo(dLeft + 2.5, dTop + 10).lineTo(dLeft + dw - 2, dTop + 10).strokeColor(ACCENT).lineWidth(0.8).stroke()
  doc.moveTo(dLeft + 2.5, dTop + 13).lineTo(dLeft + dw - 5, dTop + 13).strokeColor(ACCENT).lineWidth(0.8).stroke()
  doc.restore()

  const invoiceLabel = `INVOICE #${order.order_number || order.id}`
  doc.fontSize(13).font('Helvetica-Bold')
  const invW = doc.widthOfString(invoiceLabel)
  doc.fill(LIGHT_GRAY).rect(MARGIN + iconBoxW, STRIP_TOP, invW + 36, STRIP_H).fill(LIGHT_GRAY)
  doc.fill(PRIMARY).fontSize(13).font('Helvetica-Bold')
     .text(invoiceLabel, MARGIN + iconBoxW + 16, STRIP_TOP + 9, { lineBreak: false })

  const dateText = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  doc.fontSize(11).font('Helvetica')
  const dateValW = doc.widthOfString(dateText)
  const dateLabelW = doc.widthOfString('Date : ', { font: 'Helvetica-Bold', fontSize: 11 })
  const dateBoxW = 30 + 14 + dateLabelW + dateValW + 16
  const dateBoxX = MARGIN + CONTENT - dateBoxW

  doc.moveTo(dateBoxX - 14, STRIP_TOP).lineTo(dateBoxX - 14, STRIP_TOP + STRIP_H)
     .strokeColor('#cccccc').lineWidth(1).stroke()

  doc.fill(PRIMARY).rect(dateBoxX, STRIP_TOP, 30, STRIP_H).fill(PRIMARY)
  const calX = dateBoxX + 15, calY = STRIP_TOP + STRIP_H / 2
  const cw = 16, ch = 14
  const cLeft = calX - cw / 2, cTop = calY - ch / 2 + 2

  // body
  doc.roundedRect(cLeft, cTop, cw, ch, 2).strokeColor(ACCENT).lineWidth(1.1).stroke()
  // header bar
  doc.rect(cLeft, cTop, cw, 4).fill(ACCENT)
  // top ring tabs
  doc.rect(cLeft + 3, cTop - 2.5, 1.6, 4).fill(ACCENT)
  doc.rect(cLeft + cw - 4.6, cTop - 2.5, 1.6, 4).fill(ACCENT)
  // grid dots
  doc.fill(ACCENT)
  doc.circle(cLeft + 4, cTop + 8, 0.8).fill(ACCENT)
  doc.circle(cLeft + 8, cTop + 8, 0.8).fill(ACCENT)
  doc.circle(cLeft + 12, cTop + 8, 0.8).fill(ACCENT)
  doc.circle(cLeft + 4, cTop + 11.5, 0.8).fill(ACCENT)
  doc.circle(cLeft + 8, cTop + 11.5, 0.8).fill(ACCENT)

  doc.fill(LIGHT_GRAY).rect(dateBoxX + 30, STRIP_TOP, dateBoxW - 30, STRIP_H).fill(LIGHT_GRAY)
  doc.fill(PRIMARY).fontSize(11).font('Helvetica-Bold')
     .text('Date : ', dateBoxX + 46, STRIP_TOP + 11, { continued: true, lineBreak: false })
  doc.fill(GREEN).font('Helvetica-Bold').text(dateText, { lineBreak: false })

  hRule(STRIP_TOP + STRIP_H + 14, '#dddddd')

  // ══════════════════════════════════════════
  //  WATERMARK
  // ══════════════════════════════════════════
  if (SHOP.watermarkPath) {
    try {
      const FOOTER_H_RESERVED = 72
      const wmBoxY = STRIP_TOP + STRIP_H + 10
      const wmBoxH = doc.page.height - wmBoxY - FOOTER_H_RESERVED
      doc.opacity(0.6)
      doc.image(SHOP.watermarkPath, MARGIN, wmBoxY, { fit: [CONTENT, wmBoxH], align: 'center', valign: 'center' })
      doc.opacity(1)
    } catch (e) { /* skip */ }
  }

  // ══════════════════════════════════════════
  //  CUSTOMER + ORDER INFO
  // ══════════════════════════════════════════
  const INFO_TOP = STRIP_TOP + STRIP_H + 24
  const INFO_H   = 78
  doc.rect(MARGIN, INFO_TOP, CONTENT, INFO_H).fill(LIGHT_GRAY)
  hRule(INFO_TOP + INFO_H, '#dddddd')

  doc.fill(GRAY).fontSize(8).font('Helvetica-Bold')
     .text('BILL TO', MARGIN + 14, INFO_TOP + 12)

  doc.fill(PRIMARY).fontSize(15).font('Helvetica-Bold')
     .text(safeText(order.firm_name, 35), MARGIN + 14, INFO_TOP + 26)

  let infoLineY = INFO_TOP + 48
  if (order.contact_name) {
    doc.fill(GRAY).fontSize(9).font('Helvetica')
       .text(`Contact : ${order.contact_name}`, MARGIN + 14, infoLineY)
    infoLineY += 14
  }
  if (order.phone) {
    doc.fill(GRAY).fontSize(9).text(`Phone   : ${order.phone}`, MARGIN + 14, infoLineY)
  }

  const META_X = MARGIN + CONTENT * 0.58
  doc.fill(GRAY).fontSize(8).font('Helvetica-Bold')
     .text('ORDER DETAILS', META_X, INFO_TOP + 12)

  const statusText  = (order.status || 'pending').replace(/_/g, ' ').toUpperCase()
  const statusColor = order.status === 'delivered' ? GREEN
                     : order.status === 'cancelled' ? RED
                     : '#e67e22'

  doc.fill(PRIMARY).fontSize(10).font('Helvetica')
     .text(`Order # : ${order.order_number || order.id}`, META_X, INFO_TOP + 26)

  doc.fill(statusColor).fontSize(10).font('Helvetica-Bold')
     .text(`Status  : ${statusText}`, META_X, INFO_TOP + 40)

  if (order.description) {
    doc.fill(PRIMARY).fontSize(11).font('Helvetica-Bold')
       .text(safeText(order.description, 40), META_X, INFO_TOP + 56, { width: 180 })
  }

  // ══════════════════════════════════════════
  //  ITEMS TABLE — # | Item | Date | L | B | Qty | Rate | Amount
  // ══════════════════════════════════════════
  const COL_NO   = MARGIN + 6
  const COL_ITEM = MARGIN + 28
  const COL_DATE = MARGIN + 162
  const COL_L    = MARGIN + 222
  const COL_B    = MARGIN + 258
  const COL_QTY  = MARGIN + 296
  const COL_RATE = MARGIN + 350
  const COL_AMT  = MARGIN + 415

  const TBL_TOP = INFO_TOP + INFO_H + 18

  const TBL_HEADER_H = 20
  const drawTableHeader = (y) => {
    doc.rect(MARGIN, y, CONTENT, TBL_HEADER_H).fill(PRIMARY)
    doc.fill(WHITE).fontSize(7.5).font('Helvetica-Bold')
    doc.text('#',        COL_NO,   y + 6)
    doc.text('ITEM / DESCRIPTION', COL_ITEM, y + 6)
    doc.text('DATE',     COL_DATE, y + 6)
    doc.text('L(ft)',    COL_L,    y + 6)
    doc.text('B(ft)',    COL_B,    y + 6)
    doc.text('QTY/SQFT', COL_QTY,  y + 6)
    doc.text('RATE',     COL_RATE, y + 6)
    doc.text('AMOUNT',   COL_AMT,  y + 6)
  }

  drawTableHeader(TBL_TOP)

  let rowY = TBL_TOP + 26
  let totalAmount = 0

  items.forEach((item, index) => {
    const subtotal = parseFloat(item.subtotal) || (parseFloat(item.quantity) * parseFloat(item.unit_price))
    totalAmount += subtotal

    const ROW_H = 16

    if (rowY + ROW_H > BODY_LIMIT) {
      doc.addPage()
      rowY = 60
      drawTableHeader(rowY - TBL_HEADER_H)
    }

    if (index % 2 === 0) doc.rect(MARGIN, rowY, CONTENT, ROW_H).fill('#fafafa')

    const itemDate = item.item_date
      ? new Date(item.item_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
      : (order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—')

    doc.fill(GRAY).fontSize(8).font('Helvetica')
       .text(String(index + 1), COL_NO, rowY + 5)

    doc.fill(PRIMARY).fontSize(9).font('Helvetica-Bold')
       .text(safeText(item.item_name, 22), COL_ITEM, rowY + 5, { width: 130 })

    doc.fill(GRAY).fontSize(7.5).font('Helvetica')
       .text(itemDate, COL_DATE, rowY + 5, { width: 56 })

    doc.fill(GRAY).fontSize(8).font('Helvetica')
       .text(item.length ? String(item.length) : '—', COL_L, rowY + 5)
       .text(item.breadth ? String(item.breadth) : '—', COL_B, rowY + 5)
       .text(String(item.quantity), COL_QTY, rowY + 5)
       .text(`${parseFloat(item.unit_price).toFixed(0)}`, COL_RATE, rowY + 5)

    doc.fill(PRIMARY).fontSize(9).font('Helvetica-Bold')
       .text(rs(subtotal), COL_AMT, rowY + 5)

    hRule(rowY + ROW_H, '#eeeeee')
    rowY += ROW_H
  })

  // ══════════════════════════════════════════
  //  TOTALS SECTION
  // ══════════════════════════════════════════
  const TOT_TOP = rowY + 16
  const LBL_X   = MARGIN + CONTENT - 220
  const VAL_X   = MARGIN + CONTENT - 90

  const drawTotalRow = (label, value, y, bold = false, color = PRIMARY) => {
    doc.fill(GRAY).fontSize(10).font('Helvetica')
       .text(label, LBL_X, y, { width: 120, align: 'right' })
    doc.fill(color).fontSize(bold ? 12 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(value, VAL_X, y, { width: 85, align: 'right' })
  }

  drawTotalRow('Subtotal :', rs(totalAmount), TOT_TOP)
  let curY = TOT_TOP + 20

  if (parseFloat(order.advance_paid) > 0) {
    const modeLabel = order.advance_payment_mode === 'upi' ? ' (UPI)' : ' (Cash)'
    drawTotalRow(`Advance${modeLabel} :`, `- ${rs(order.advance_paid)}`, curY, false, GREEN)
    curY += 20
  }

  if (payments && payments.length > 0) {
    const paymentsTotal = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    drawTotalRow('Payments :', `- ${rs(paymentsTotal)}`, curY, false, GREEN)
    curY += 20
  }

  const clearedCheques = cheques.filter(c => c.status === 'cleared')
  if (clearedCheques.length > 0) {
    const clearedTotal = clearedCheques.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
    drawTotalRow('Cheques (cleared) :', `- ${rs(clearedTotal)}`, curY, false, GREEN)
    curY += 20
  }

  if (parseFloat(order.discount_amount) > 0) {
    const dLabel = order.discount_note ? `Discount (${order.discount_note}) :` : 'Discount / Round-off :'
    drawTotalRow(dLabel, `- ${rs(order.discount_amount)}`, curY, false, GREEN)
    curY += 20
  }

  doc.moveTo(LBL_X, curY).lineTo(MARGIN + CONTENT, curY)
     .strokeColor(PRIMARY).lineWidth(1.2).stroke()
  curY += 10

  const balanceDue   = parseFloat(order.balance_due || 0)
  const balanceColor = balanceDue > 0 ? RED : GREEN
  const balanceBg    = balanceDue > 0 ? '#fff0f0' : '#f0fff4'

  doc.rect(LBL_X - 10, curY, CONTENT - (LBL_X - MARGIN) + 10, 38).fill(balanceBg)
  doc.fill(balanceColor).fontSize(13).font('Helvetica-Bold')
     .text('BALANCE DUE :', LBL_X, curY + 12, { width: 120, align: 'right' })
     .text(rs(balanceDue), VAL_X, curY + 12, { width: 85, align: 'right' })

  curY += 56

  // ══════════════════════════════════════════
  //  NOTES
  // ══════════════════════════════════════════
  if (order.notes) {
    doc.fill(GRAY).fontSize(9).font('Helvetica-Bold').text('NOTES:', MARGIN, curY)
    doc.fill(GRAY).fontSize(9).font('Helvetica')
       .text(order.notes, MARGIN, curY + 14, { width: CONTENT })
    curY += 40
  }

  // ══════════════════════════════════════════
  //  PAYMENT HISTORY — date+time, mode, UPI/cheque details
  // ══════════════════════════════════════════
  const hasAdvance  = parseFloat(order.advance_paid) > 0
  const hasPayments = payments && payments.length > 0
  const hasCheques  = cheques && cheques.length > 0

  if (hasAdvance || hasPayments || hasCheques) {
    // page-break check for the section header
    if (curY > BODY_LIMIT - 30) {
      doc.addPage()
      curY = 60
    }

    curY += 6
    hRule(curY, '#dddddd')
    curY += 12

    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
       .text('Payment History', MARGIN, curY)
    curY += 18

    const checkPageBreak = (lineH = 19) => {
      if (curY + lineH > BODY_LIMIT) {
        doc.addPage()
        curY = 60
      }
    }

    const drawPaymentLine = (label, amount, dt, modeText, color) => {
      checkPageBreak()
      doc.fill(color).fontSize(9).font('Helvetica-Bold')
         .text(`+  ${rs(amount)}`, MARGIN + 14, curY, { continued: false })
      doc.fill(GRAY).fontSize(7.5).font('Helvetica')
         .text(`${label}   |   ${dt.date}${dt.time ? ', ' + dt.time : ''}`, MARGIN + 14, curY + 11)
      doc.fill('#555555').fontSize(7.5).font('Helvetica')
         .text(modeText, MARGIN + 280, curY + 11, { width: 215 })
      curY += 19
    }

    if (hasAdvance) {
      const dt = fmtDateTime(order.created_at)
      const modeText = order.advance_payment_mode === 'upi'
        ? `UPI`
        : `Cash`
      drawPaymentLine('Advance Payment', order.advance_paid, dt, modeText, GREEN)
    }

    if (hasPayments) {
      payments.forEach(p => {
        const dt = fmtDateTime(p.created_at || p.payment_date)
        let modeText = 'Cash'
        if (p.payment_mode === 'upi') modeText = `UPI — ${p.upi_account || 'account n/a'}`
        const noteText = p.note ? `Payment — ${p.note}` : 'Payment'
        drawPaymentLine(noteText, p.amount, dt, modeText, GREEN)
      })
    }

    if (hasCheques) {
      cheques.forEach(c => {
        const dt = fmtDateTime(c.received_date)
        const statusLabel = c.status === 'cleared' ? 'Cleared'
                           : c.status === 'bounced' ? 'Bounced'
                           : c.status === 'deposited' ? 'Deposited' : 'Received'
        const modeText = `Cheque${c.cheque_number ? ' #' + c.cheque_number : ''}${c.bank_name ? ' — ' + c.bank_name : ''}  [${statusLabel}]`
        const color = c.status === 'cleared' ? GREEN : (c.status === 'bounced' ? RED : ORANGE)
        drawPaymentLine('Cheque Payment', c.amount, dt, modeText, color)
      })
    }

    if (parseFloat(order.discount_amount) > 0) {
      checkPageBreak()
      doc.fill(ORANGE).fontSize(9).font('Helvetica')
         .text(
           `\u2702  Discount : ${rs(order.discount_amount)}${order.discount_note ? '  —  ' + order.discount_note : '  (Round-off)'}`,
           MARGIN + 14, curY
         )
      curY += 16
    }
  }

  // ══════════════════════════════════════════
  //  FOOTER — absolute bottom on every page
  // ══════════════════════════════════════════
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const FOOTER_Y = doc.page.height - FOOTER_H

    // Signature — bottom-right, just above the footer band, last page only
    if (i === range.start + range.count - 1 && SHOP.signaturePath) {
      try {
        const sigW = 100, sigH = 42
        const sigX = PAGE_W - MARGIN - sigW
        const sigY = FOOTER_Y - sigH - 22
        doc.image(SHOP.signaturePath, sigX, sigY, { width: sigW, height: sigH })
        doc.moveTo(sigX, sigY + sigH + 4).lineTo(sigX + sigW, sigY + sigH + 4)
           .strokeColor('#aaaaaa').lineWidth(0.8).stroke()
        doc.fill(GRAY).fontSize(8).font('Helvetica')
           .text('Authorized Signatory', sigX, sigY + sigH + 8, { width: sigW, align: 'center', lineBreak: false })
      } catch (e) { /* signature missing — skip silently */ }
    }

    doc.rect(0, FOOTER_Y, PAGE_W, FOOTER_H).fill(PRIMARY)
    doc.rect(0, FOOTER_Y, PAGE_W, 3).fill(ACCENT)

    doc.fill(WHITE).fontSize(12).font('Helvetica-Bold')
       .text('Thank you for your business!', MARGIN, FOOTER_Y + 14, { lineBreak: false })

    doc.fill(ACCENT).fontSize(9).font('Helvetica-Bold')
       .text(`${SHOP.name}  |  ${SHOP.ownerName}  |  ${SHOP.mobile}`, MARGIN, FOOTER_Y + 34, { lineBreak: false })

    doc.fill('#aaaaaa').fontSize(9).font('Helvetica')
       .text(SHOP.address, MARGIN, FOOTER_Y + 50, { lineBreak: false })

    doc.fill('#aaaaaa').fontSize(8)
       .text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_W - MARGIN - 90, FOOTER_Y + 50, { width: 90, align: 'right', lineBreak: false })
  }

  doc.end()
}

// ══════════════════════════════════════════
// GET /api/pdf/statement/:customerId
// ══════════════════════════════════════════
router.get('/statement/:customerId', (req, res) => {
  const { customerId } = req.params

  db.get(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL`, [customerId], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    db.all(`
      SELECT * FROM orders
      WHERE customer_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC
    `, [customerId], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!orders || orders.length === 0)
        return res.status(400).json({ error: 'No orders found' })

      const orderIds = orders.map(o => o.id)
      const ph = orderIds.map(() => '?').join(',')

      db.all(`SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY order_id, id`, orderIds, (err, allItems) => {
        if (err) return res.status(500).json({ error: err.message })

        db.all(`
          SELECT p.*, o.description as order_desc, o.order_number
          FROM payments p
          LEFT JOIN orders o ON p.order_id = o.id
          WHERE p.customer_id = ?
          ORDER BY p.payment_date ASC, p.id ASC
        `, [customerId], (err, allPayments) => {
          if (err) return res.status(500).json({ error: err.message })

          db.all(`
            SELECT * FROM cash_income
            WHERE customer_id = ?
              AND (notes IS NULL OR (
                notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance')
                AND notes NOT LIKE 'Cheque Cleared%'
              ))
            ORDER BY income_date ASC
          `, [customerId], (err, cashIncomes) => {
            if (err) return res.status(500).json({ error: err.message })

            // Commission entries expenses table mein hain (customer_id linked),
            // cash_income mein nahi — Accounts page inhe customer ke against
            // count karta hai (Due badhta hai), isliye alag se fetch karke
            // Balance Due mein wapas add karna hai.
            db.all(`
              SELECT * FROM expenses
              WHERE customer_id = ? AND category = 'Commission'
              ORDER BY expense_date ASC, id ASC
            `, [customerId], (err, commissions) => {
              if (err) return res.status(500).json({ error: err.message })

              // Cheques table hi source-of-truth — cash_income ka 'Cheque Cleared%' row
              // ab exclude ho chuka hai upar, statement seedha yahan se sahi label +
              // order-link nikaalta hai.
              db.all(`
                SELECT * FROM cheques WHERE customer_id = ? ORDER BY received_date ASC
              `, [customerId], (err, cheques) => {
                if (err) return res.status(500).json({ error: err.message })

                renderCustomerStatement(res, customer, orders, allItems, allPayments, cashIncomes || [], commissions || [], cheques || [])
              })
            })
          })
        })
      })
    })
  })
})

function renderCustomerStatement(res, customer, orders, allItems, allPayments, cashIncomes, commissions, cheques) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
  const filename = `Statement-${customer.firm_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
  doc.pipe(res)

  const PRIMARY    = '#1a1a2e'
  const ACCENT     = '#2ecc71'
  const GREEN      = '#27ae60'
  const RED        = '#e74c3c'
  const ORANGE     = '#e67e22'
  const GRAY       = '#888888'
  const LIGHT_GRAY = '#f4f4f4'
  const WHITE      = '#ffffff'

  const PAGE_W   = doc.page.width
  const MARGIN   = 50
  const CONTENT  = PAGE_W - MARGIN * 2
  const FOOTER_H = 72
  const BODY_LIMIT = doc.page.height - FOOTER_H - 16

  const rs = (val) => `Rs. ${parseFloat(val || 0).toFixed(0)}`
  const hRule = (y, color = '#dddddd', lw = 1) => {
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y).strokeColor(color).lineWidth(lw).stroke()
  }
  const safeText = (t, max) => t && t.length > max ? t.substring(0, max - 1) + '…' : (t || '—')
  const fmtDate = (raw) => {
    if (!raw) return '—'
    const d = new Date(String(raw).replace(' ', 'T'))
    return isNaN(d) ? String(raw).split(' ')[0] : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const fmtDateTime = (raw) => {
    if (!raw) return { date: '—', time: '' }
    const d = new Date(String(raw).replace(' ', 'T'))
    if (isNaN(d)) return { date: String(raw).split(' ')[0], time: '' }
    return {
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
  }

  let currentY = 0
  const checkPageBreak = (needed = 30) => {
    if (currentY + needed > BODY_LIMIT) { doc.addPage(); currentY = 60 }
  }

  // ── HEADER (same as bill) ──
  const HEADER_H = 150
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(PRIMARY)
  doc.rect(0, HEADER_H - 3, PAGE_W, 3).fill(ACCENT)

  let logoW = 0
  if (SHOP.logoPath) {
    try { doc.image(SHOP.logoPath, MARGIN, 26, { width: 95, height: 95 }); logoW = 108 } catch (e) {}
  }

  let nameFont = 'Helvetica-Bold'
  if (SHOP.nameFontPath) {
    try { doc.registerFont('ShopNameFont', SHOP.nameFontPath); nameFont = 'ShopNameFont' } catch (e) {}
  }

  const nameX   = MARGIN + logoW
  const nameW   = PAGE_W - nameX - MARGIN
  const centerX = nameX + nameW / 2

  const diamond = (cx, cy, r, color) => {
    doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]).fill(color)
  }
  const decorLine = (text, y, fontSize, font, color, lineColor) => {
    doc.fontSize(fontSize).font(font)
    const w = doc.widthOfString(text)
    const tx = centerX - w / 2, te = centerX + w / 2, gap = 14
    doc.moveTo(nameX + 6, y).lineTo(tx - gap, y).strokeColor(lineColor).lineWidth(1).stroke()
    diamond(tx - gap + 7, y, 3, lineColor)
    doc.circle(tx - gap - 3, y, 1.3).fill(lineColor)
    doc.moveTo(te + gap, y).lineTo(nameX + nameW - 6, y).strokeColor(lineColor).lineWidth(1).stroke()
    diamond(te + gap - 7, y, 3, lineColor)
    doc.circle(te + gap + 3, y, 1.3).fill(lineColor)
    doc.fill(color).text(text, tx, y - fontSize / 2 - 1, { lineBreak: false })
  }

  decorLine('JAI MATA DI', 22, 11, 'Helvetica-Bold', WHITE, ACCENT)
  const contactLine = SHOP.mobile2
    ? `${SHOP.ownerName}  |  ${SHOP.mobile}  /  ${SHOP.mobile2}`
    : `${SHOP.ownerName}  |  ${SHOP.mobile}`
  doc.fill(ACCENT).fontSize(10).font('Helvetica-Bold')
     .text(contactLine, nameX, 44, { align: 'right', width: nameW, lineBreak: false })

  let shopNameSize = 44
  doc.font(nameFont)
  while (shopNameSize > 18 && doc.fontSize(shopNameSize).widthOfString(SHOP.name) > nameW - 10) shopNameSize--
  doc.fill(WHITE).fontSize(shopNameSize).font(nameFont)
     .text(SHOP.name, nameX, 60, { align: 'center', width: nameW, lineBreak: false })

  decorLine(SHOP.tagline.toUpperCase(), 118, 13, 'Helvetica-Bold', ACCENT, ACCENT)

  doc.fontSize(10).font('Helvetica')
  const addrW = doc.widthOfString(SHOP.address)
  const pinX  = centerX - addrW / 2 - 12, pinY = 135, pr = 4.5
  doc.save()
  doc.path(`M ${pinX} ${pinY-pr-3} C ${pinX+pr+2} ${pinY-pr-3} ${pinX+pr+2} ${pinY+pr-1} ${pinX} ${pinY+pr+4} C ${pinX-pr-2} ${pinY+pr-1} ${pinX-pr-2} ${pinY-pr-3} ${pinX} ${pinY-pr-3} Z`).fill(ACCENT)
  doc.circle(pinX, pinY - 2, 1.6).fill(PRIMARY)
  doc.restore()
  doc.fill('#dddddd').fontSize(10).font('Helvetica')
     .text(SHOP.address, centerX - addrW / 2, pinY - 5, { lineBreak: false })

  // ── STATEMENT TITLE STRIP ──
  const STRIP_TOP = HEADER_H + 16
  doc.rect(MARGIN, STRIP_TOP, CONTENT, 32).fill(LIGHT_GRAY)
  doc.fill(PRIMARY).fontSize(14).font('Helvetica-Bold')
     .text('ACCOUNT STATEMENT', MARGIN + 14, STRIP_TOP + 8, { lineBreak: false })
  doc.fill(GRAY).fontSize(10).font('Helvetica')
     .text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
           MARGIN, STRIP_TOP + 10, { align: 'right', width: CONTENT - 14, lineBreak: false })
  hRule(STRIP_TOP + 32 + 8)

  // ── WATERMARK ──
  if (SHOP.watermarkPath) {
    try {
      doc.opacity(0.06)
      doc.image(SHOP.watermarkPath, MARGIN, STRIP_TOP + 40, { fit: [CONTENT, doc.page.height - STRIP_TOP - 40 - FOOTER_H], align: 'center', valign: 'center' })
      doc.opacity(1)
    } catch (e) {}
  }

  // ── CUSTOMER INFO + SUMMARY ──
  const INFO_TOP = STRIP_TOP + 32 + 18
  doc.rect(MARGIN, INFO_TOP, CONTENT, 80).fill(LIGHT_GRAY)

  doc.fill(GRAY).fontSize(8).font('Helvetica-Bold').text('CUSTOMER', MARGIN + 14, INFO_TOP + 10)
  doc.fill(PRIMARY).fontSize(15).font('Helvetica-Bold')
     .text(safeText(customer.firm_name, 35), MARGIN + 14, INFO_TOP + 24)
  let cY = INFO_TOP + 46
  if (customer.contact_name) { doc.fill(GRAY).fontSize(9).font('Helvetica').text(`Contact : ${customer.contact_name}`, MARGIN + 14, cY); cY += 14 }
  if (customer.phone) doc.fill(GRAY).fontSize(9).text(`Phone   : ${customer.phone}`, MARGIN + 14, cY)

  // Opening Balance ab order nahi — customer.opening_balance field se seedha.
  const openingBalance  = parseFloat(customer.opening_balance || 0)
  const totalBilled     = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) + openingBalance
  const totalAdvance    = orders.reduce((s, o) => s + parseFloat(o.advance_paid || 0), 0)
  const totalPayments   = allPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalCash       = cashIncomes.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  const totalDiscount   = orders.reduce((s, o) => s + parseFloat(o.discount_amount || 0), 0)
  const totalCommission = commissions.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  // Cleared cheques ka paisa ab cash_income ke mirror-row se nahi (wo exclude ho chuka
  // hai), seedha cheques table se — order-linked aur standalone dono, ek hi baar count.
  const totalChequesCleared = cheques.filter(c => c.status === 'cleared').reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  const totalPaid       = totalAdvance + totalPayments + totalCash + totalChequesCleared
  // Balance Due = Total Billed − Total Paid − Discount + Commission.
  // Commission ("Commission Wapas Ki") shop se customer ko diya gaya cash hai,
  // order se related nahi — isliye Due mein wapas add hota hai (Accounts page
  // ke Total Due se exactly match karega). Discount iska ulta hai — maaf kiya
  // gaya amount, isliye subtract hota hai.
  const totalDue        = totalBilled - totalPaid - totalDiscount + totalCommission

  const sumX = MARGIN + CONTENT - 190
  doc.fill(GRAY).fontSize(8).font('Helvetica-Bold').text('SUMMARY', sumX, INFO_TOP + 10)
  ;[
    { label: 'Total Billed', value: rs(totalBilled), color: PRIMARY, bold: false },
    { label: 'Total Paid',   value: rs(totalPaid),   color: GREEN,   bold: false },
    { label: 'Balance Due',  value: rs(totalDue),     color: totalDue > 0 ? RED : GREEN, bold: true }
  ].forEach((row, i) => {
    const ry = INFO_TOP + 24 + i * 18
    doc.fill(GRAY).fontSize(9).font('Helvetica').text(row.label + ' :', sumX, ry, { width: 90 })
    doc.fill(row.color).fontSize(row.bold ? 11 : 9).font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(row.value, sumX + 95, ry, { width: 95, align: 'right' })
  })

  hRule(INFO_TOP + 80)
  currentY = INFO_TOP + 80 + 20

  // ── OPENING BALANCE — ab order nahi, ek chhoti highlighted line ──
  if (openingBalance > 0) {
    checkPageBreak(36)
    doc.rect(MARGIN, currentY, CONTENT, 30).fill('#f5f0ff')
    doc.rect(MARGIN, currentY, 4, 30).fill('#8e44ad')
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
       .text('Opening Balance (Purana Bakaya)', MARGIN + 14, currentY + 6, { lineBreak: false })
    doc.fill(GRAY).fontSize(8).font('Helvetica')
       .text(
         `${customer.opening_balance_notes || ''}${customer.opening_balance_date ? '  |  ' + fmtDate(customer.opening_balance_date) : ''}`,
         MARGIN + 14, currentY + 19, { width: CONTENT - 180, lineBreak: false }
       )
    doc.fill('#8e44ad').fontSize(12).font('Helvetica-Bold')
       .text(rs(openingBalance), MARGIN + CONTENT - 110, currentY + 9, { width: 96, align: 'right', lineBreak: false })
    currentY += 40
  }

  // ══════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════
  orders.forEach((order, orderIdx) => {
    const orderItems    = allItems.filter(i => i.order_id === order.id)
    const orderPayments = allPayments.filter(p => p.order_id === order.id)
    const orderCheques  = cheques.filter(c => c.order_id === order.id)

    checkPageBreak(80)

    // Order header bar
    const statusText  = (order.status || 'pending').replace(/_/g, ' ').toUpperCase()
    const statusColor = order.status === 'delivered' ? GREEN : order.status === 'cancelled' ? RED : ORANGE

    doc.rect(MARGIN, currentY, CONTENT, 26).fill(order.status === 'delivered' ? '#f0fff4' : '#f8f8f8')
    doc.rect(MARGIN, currentY, 4, 26).fill(statusColor)

    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold')
       .text(`Order ${order.order_number || '#' + order.id}`, MARGIN + 12, currentY + 7, { lineBreak: false })
    if (order.description) {
      doc.fill(GRAY).fontSize(9).font('Helvetica')
         .text(`  —  ${safeText(order.description, 38)}`, MARGIN + 12 + doc.widthOfString(`Order ${order.order_number || '#' + order.id}`) + 4, currentY + 8, { lineBreak: false })
    }
    doc.fill(GRAY).fontSize(8).font('Helvetica')
       .text(fmtDate(order.created_at), MARGIN + CONTENT - 120, currentY + 9, { width: 110, align: 'right', lineBreak: false })
    doc.fill(statusColor).fontSize(8).font('Helvetica-Bold')
       .text(statusText, MARGIN + CONTENT - 120, currentY + 18, { width: 110, align: 'right', lineBreak: false })

    currentY += 30

    // Items mini-table
    if (orderItems.length > 0) {
      doc.rect(MARGIN, currentY, CONTENT, 16).fill(PRIMARY)
      doc.fill(WHITE).fontSize(7).font('Helvetica-Bold')
      doc.text('ITEM', MARGIN + 6, currentY + 5)
      doc.text('QTY', MARGIN + 265, currentY + 5)
      doc.text('RATE', MARGIN + 330, currentY + 5)
      doc.text('AMOUNT', MARGIN + 415, currentY + 5)
      currentY += 16

      orderItems.forEach((item, i) => {
        checkPageBreak(18)
        const subtotal = parseFloat(item.subtotal) || (parseFloat(item.quantity) * parseFloat(item.unit_price))
        if (i % 2 === 0) doc.rect(MARGIN, currentY, CONTENT, 16).fill('#fafafa')
        doc.fill(PRIMARY).fontSize(8.5).font('Helvetica-Bold')
           .text(safeText(item.item_name, 40), MARGIN + 6, currentY + 4, { width: 255 })
        doc.fill(GRAY).fontSize(8).font('Helvetica')
           .text(String(item.quantity), MARGIN + 265, currentY + 4)
           .text(parseFloat(item.unit_price).toFixed(0), MARGIN + 330, currentY + 4)
        doc.fill(PRIMARY).fontSize(8.5).font('Helvetica-Bold')
           .text(rs(subtotal), MARGIN + 415, currentY + 4)
        hRule(currentY + 16, '#eeeeee', 0.5)
        currentY += 16
      })
    } else {
      doc.fill(GRAY).fontSize(9).font('Helvetica').text('(No items)', MARGIN + 6, currentY + 4)
      currentY += 18
    }

    // Order financial summary bar
    checkPageBreak(32)
    const oTotal    = parseFloat(order.total_amount || 0)
    const oAdvance  = parseFloat(order.advance_paid || 0)
    const oPmts     = orderPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const oDiscount = parseFloat(order.discount_amount || 0)
    const oBalance  = parseFloat(order.balance_due || 0)

    const oChequesCleared = orderCheques.filter(c => c.status === 'cleared').reduce((s, c) => s + parseFloat(c.amount || 0), 0)
    const sumCols = [
      { label: 'Total',    value: rs(oTotal),                               color: PRIMARY },
      { label: 'Advance',  value: oAdvance  > 0 ? `- ${rs(oAdvance)}`  : '—', color: oAdvance  > 0 ? GREEN  : GRAY },
      { label: 'Payments', value: oPmts     > 0 ? `- ${rs(oPmts)}`     : '—', color: oPmts     > 0 ? GREEN  : GRAY },
      { label: 'Cheques',  value: oChequesCleared > 0 ? `- ${rs(oChequesCleared)}` : '—', color: oChequesCleared > 0 ? GREEN : GRAY },
      { label: 'Discount', value: oDiscount > 0 ? `- ${rs(oDiscount)}` : '—', color: oDiscount > 0 ? ORANGE : GRAY },
      { label: 'Balance',  value: rs(oBalance),                             color: oBalance  > 0 ? RED    : GREEN },
    ]
    const colW = CONTENT / sumCols.length
    doc.rect(MARGIN, currentY, CONTENT, 30).fill(oBalance > 0 ? '#fff8f8' : '#f8fff8')
    sumCols.forEach((col, i) => {
      const cx = MARGIN + i * colW
      doc.fill(GRAY).fontSize(7.5).font('Helvetica').text(col.label, cx + 6, currentY + 5, { width: colW - 6 })
      doc.fill(col.color).fontSize(9).font('Helvetica-Bold').text(col.value, cx + 6, currentY + 17, { width: colW - 10 })
      if (i < sumCols.length - 1) {
        doc.moveTo(cx + colW, currentY + 4).lineTo(cx + colW, currentY + 26).strokeColor('#dddddd').lineWidth(0.5).stroke()
      }
    })
    currentY += 34

    // Order payment detail lines
    if (oAdvance > 0 || orderPayments.length > 0 || orderCheques.length > 0) {
      checkPageBreak(20)
      doc.fill(GRAY).fontSize(7.5).font('Helvetica-Bold')
         .text('Payment history for this order:', MARGIN + 6, currentY + 2)
      currentY += 14

      if (oAdvance > 0) {
        checkPageBreak(14)
        const advMode = order.advance_payment_mode === 'upi' ? 'UPI' : 'Cash'
        const advDt   = fmtDateTime(order.created_at)
        doc.fill(GREEN).fontSize(8).font('Helvetica-Bold').text(`+ ${rs(oAdvance)}`, MARGIN + 10, currentY + 2)
        doc.fill(GRAY).fontSize(7.5).font('Helvetica')
           .text(`Advance (${advMode})  |  ${advDt.date}${advDt.time ? ', ' + advDt.time : ''}`, MARGIN + 80, currentY + 2, { width: CONTENT - 90, lineBreak: false })
        currentY += 13
      }

      orderPayments.forEach(p => {
        checkPageBreak(14)
        const dt       = fmtDateTime(p.created_at || p.payment_date)
        const modeText = p.payment_mode === 'upi' ? `UPI${p.upi_account ? ' — ' + p.upi_account : ''}` : 'Cash'
        doc.fill(GREEN).fontSize(8).font('Helvetica-Bold').text(`+ ${rs(p.amount)}`, MARGIN + 10, currentY + 2)
        doc.fill(GRAY).fontSize(7.5).font('Helvetica')
           .text(`${modeText}  |  ${dt.date}${dt.time ? ', ' + dt.time : ''}${p.note ? '  |  ' + p.note : ''}  [Order ${p.order_number || '#' + p.order_id}]`,
                 MARGIN + 80, currentY + 2, { width: CONTENT - 90, lineBreak: false })
        currentY += 13
      })

      // Pehle yahan cheques bilkul missing the — isliye order-bill mein "Cheque Payment"
      // dikhta tha lekin statement mein disconnected "Cash" ban jaata tha.
      orderCheques.forEach(c => {
        checkPageBreak(14)
        const dt          = fmtDateTime(c.received_date)
        const statusLabel = c.status === 'cleared' ? 'Cleared' : c.status === 'bounced' ? 'Bounced' : c.status === 'deposited' ? 'Deposited' : 'Received'
        const modeText     = `Cheque${c.cheque_number ? ' #' + c.cheque_number : ''}${c.bank_name ? ' — ' + c.bank_name : ''}  [${statusLabel}]`
        const color        = c.status === 'cleared' ? GREEN : (c.status === 'bounced' ? RED : ORANGE)
        doc.fill(color).fontSize(8).font('Helvetica-Bold').text(`+ ${rs(c.amount)}`, MARGIN + 10, currentY + 2)
        doc.fill(GRAY).fontSize(7.5).font('Helvetica')
           .text(`${modeText}  |  ${dt.date}${dt.time ? ', ' + dt.time : ''}  [Order ${order.order_number || '#' + order.id}]`,
                 MARGIN + 80, currentY + 2, { width: CONTENT - 90, lineBreak: false })
        currentY += 13
      })
    }

    currentY += orderIdx < orders.length - 1 ? 10 : 16
    if (orderIdx < orders.length - 1) { hRule(currentY, '#cccccc', 0.8); currentY += 14 }
  })

  // ── OTHER ACCOUNT ENTRIES — cash_income (+, green) merged with Commission (−, red) ──
  // Ek hi date-sorted list mein, jaisa Accounts page ki "Complete Payment History" dikhati hai.
  const otherEntries = [
    ...cashIncomes.map(c => ({
      amount: parseFloat(c.amount || 0),
      sign: 1,
      date: c.income_date || c.created_at,
      mode: c.payment_mode === 'upi' ? `UPI${c.upi_account ? ' — ' + c.upi_account : ''}` : 'Cash',
      label: c.notes || null
    })),
    ...commissions.map(c => ({
      amount: parseFloat(c.amount || 0),
      sign: -1,
      date: c.expense_date,
      mode: c.payment_mode === 'upi' ? `UPI${c.upi_account ? ' — ' + c.upi_account : ''}` : 'Cash',
      label: 'Commission Wapas Ki' + (c.description ? ' — ' + c.description : '')
    })),
    // Sirf standalone (kisi order se link na hone waale) cleared cheques — order-linked
    // waale ab apne order ke "Payment history" mein dikhte hain, dono jagah dikhane se
    // double ho jaata.
    ...cheques.filter(c => !c.order_id && c.status === 'cleared').map(c => ({
      amount: parseFloat(c.amount || 0),
      sign: 1,
      date: c.received_date,
      mode: `Cheque${c.cheque_number ? ' #' + c.cheque_number : ''}${c.bank_name ? ' — ' + c.bank_name : ''}  [Cleared]`,
      label: c.notes || c.firm_name || null
    }))
  ].sort((a, b) => new Date(String(a.date).replace(' ', 'T')) - new Date(String(b.date).replace(' ', 'T')))

  if (otherEntries.length > 0) {
    checkPageBreak(40)
    hRule(currentY); currentY += 12
    doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text('Other Account Entries', MARGIN, currentY)
    currentY += 18
    otherEntries.forEach(e => {
      checkPageBreak(14)
      const dt    = fmtDateTime(e.date)
      const color = e.sign > 0 ? GREEN : RED
      const sign  = e.sign > 0 ? '+' : '-'
      doc.fill(color).fontSize(8).font('Helvetica-Bold').text(`${sign} ${rs(e.amount)}`, MARGIN + 10, currentY + 2)
      doc.fill(GRAY).fontSize(7.5).font('Helvetica')
         .text(`${e.mode}  |  ${dt.date}${e.label ? '  |  ' + e.label : ''}`, MARGIN + 80, currentY + 2, { width: CONTENT - 90, lineBreak: false })
      currentY += 13
    })
    currentY += 10
  }

  // ── FINAL BALANCE BOX ──
  checkPageBreak(60)
  hRule(currentY, PRIMARY, 1.5); currentY += 14

  const balColor = totalDue > 0 ? RED : GREEN
  doc.rect(MARGIN, currentY, CONTENT, 42).fill(totalDue > 0 ? '#fff0f0' : '#f0fff4')

  const thirdW = CONTENT / 3
  ;[
    { label: 'Total Billed', value: rs(totalBilled), color: PRIMARY, x: MARGIN + 14 },
    { label: 'Total Paid',   value: rs(totalPaid),   color: GREEN,   x: MARGIN + thirdW + 14 },
    { label: 'Balance Due',  value: rs(totalDue),    color: balColor, x: MARGIN + thirdW * 2 + 14 },
  ].forEach(col => {
    doc.fill(GRAY).fontSize(9).font('Helvetica').text(col.label, col.x, currentY + 8)
    doc.fill(col.color).fontSize(13).font('Helvetica-Bold').text(col.value, col.x, currentY + 22)
  })
  currentY += 56

  // ── FOOTER ──
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const FOOTER_Y = doc.page.height - FOOTER_H

    if (i === range.start + range.count - 1 && SHOP.signaturePath) {
      try {
        const sigW = 100, sigH = 42
        const sigX = PAGE_W - MARGIN - sigW, sigY = FOOTER_Y - sigH - 22
        doc.image(SHOP.signaturePath, sigX, sigY, { width: sigW, height: sigH })
        doc.moveTo(sigX, sigY + sigH + 4).lineTo(sigX + sigW, sigY + sigH + 4).strokeColor('#aaaaaa').lineWidth(0.8).stroke()
        doc.fill(GRAY).fontSize(8).font('Helvetica').text('Authorized Signatory', sigX, sigY + sigH + 8, { width: sigW, align: 'center', lineBreak: false })
      } catch (e) {}
    }

    doc.rect(0, FOOTER_Y, PAGE_W, FOOTER_H).fill(PRIMARY)
    doc.rect(0, FOOTER_Y, PAGE_W, 3).fill(ACCENT)
    doc.fill(WHITE).fontSize(12).font('Helvetica-Bold').text('Thank you for your business!', MARGIN, FOOTER_Y + 14, { lineBreak: false })
    doc.fill(ACCENT).fontSize(9).font('Helvetica-Bold').text(`${SHOP.name}  |  ${SHOP.ownerName}  |  ${SHOP.mobile}`, MARGIN, FOOTER_Y + 34, { lineBreak: false })
    doc.fill('#aaaaaa').fontSize(9).font('Helvetica').text(SHOP.address, MARGIN, FOOTER_Y + 50, { lineBreak: false })
    doc.fill('#aaaaaa').fontSize(8).text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_W - MARGIN - 90, FOOTER_Y + 50, { width: 90, align: 'right', lineBreak: false })
  }

  doc.end()
}
module.exports = router