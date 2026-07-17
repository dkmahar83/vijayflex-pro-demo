const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const path = require('path')

let client = null
let clientReady = false
let clientStatus = 'disconnected' // 'disconnected' | 'qr_pending' | 'ready'
let lastQR = null

// Demo-deployment safety switch — jab true ho, WhatsApp client kabhi
// initialize nahi hota aur koi bhi send-attempt turant clear error deta hai.
// Isse frontend ko bhi ek explicit 'disabled' status milta hai, misleading
// "initializing..."/"connecting..." dikhne ke bajaye.
const DEMO_DISABLED = process.env.DISABLE_WHATSAPP === 'true'

function getClient() {
  return client
}

function getStatus() {
  if (DEMO_DISABLED) {
    return { status: 'disabled', ready: false, disabled: true }
  }
  return { status: clientStatus, ready: clientReady, disabled: false }
}

function getLastQR() {
  return lastQR
}

// Purana session delete karo (corrupted/detached frame ke baad) aur fresh QR ke liye reinit karo
function clearSessionAndReinit(oldClient) {
  // Purana client safely destroy karne ki koshish karo
  if (oldClient) {
    try { oldClient.destroy() } catch (e) { /* already dead, ignore */ }
  }

  setTimeout(() => {
    try {
      const authPath = path.join(__dirname, '.wwebjs_auth')
      const cachePath = path.join(__dirname, '.wwebjs_cache')
      if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true })
      if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true })
      console.log('Old WhatsApp session cleared.')
    } catch (e) {
      console.log('Could not clear session folders:', e.message)
    }

    console.log('Re-initializing WhatsApp — new QR will appear shortly...')
    initWhatsApp()
  }, 3000)
}

function initWhatsApp() {
  // Defense-in-depth — index.js already skip karta hai is function ka call
  // jab DISABLE_WHATSAPP=true ho, lekin agar kabhi kahi aur se (galti se)
  // ye call ho jaye, yahan bhi hard-stop hai. Puppeteer/Chromium demo ke
  // Render environment mein available nahi hota, isliye ye kabhi try bhi
  // nahi hona chahiye.
  if (DEMO_DISABLED) {
    console.log('WhatsApp init skipped (DISABLE_WHATSAPP=true)')
    clientStatus = 'disabled'
    return
  }

  if (client) {
    console.log('WhatsApp already initialized, skipping.')
    return
  }

  console.log('Initializing WhatsApp client...')
  clientStatus = 'initializing'

  try {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      }
    })

    client.on('qr', (qr) => {
      console.log('WhatsApp QR ready — scan at localhost:5173/whatsapp')
      lastQR = qr
      clientStatus = 'qr_pending'
      clientReady = false
    })

    client.on('ready', () => {
      console.log('✅ WhatsApp ready')
      clientStatus = 'ready'
      clientReady = true
      lastQR = null
    })

    client.on('authenticated', () => {
      clientStatus = 'authenticated'
    })

    client.on('auth_failure', () => {
      console.log('WhatsApp auth failed — clearing session for fresh QR')
      clientStatus = 'auth_failed'
      clientReady = false
      const c = client
      client = null
      clearSessionAndReinit(c)
    })

    client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason)
      clientStatus = 'disconnected'
      clientReady = false
      const c = client
      client = null

      // Sirf 'LOGOUT' (user ne phone se manually WhatsApp-Web session hataayi)
      // genuinely corrupted/invalid session hai — usi case mein full wipe+fresh-QR
      // chahiye. Baaki reasons (NAVIGATION, CONFLICT, temporary drop) transient
      // hain — inpe seedha reconnect try karo, session delete mat karo, warna
      // har chhoti internet-hiccup pe shop-owner ko dubara QR scan karna padega.
      if (reason === 'LOGOUT') {
        clearSessionAndReinit(c)
      } else {
        try { if (c) c.destroy() } catch (e) { /* already dead */ }
        setTimeout(initWhatsApp, 3000)
      }
    })

    client.initialize().catch(err => {
      console.log('WhatsApp init crashed (detached frame / Chrome issue):', err.message)
      clientStatus = 'disconnected'
      clientReady = false
      const c = client
      client = null
      clearSessionAndReinit(c)
    })

  } catch (err) {
    console.log('WhatsApp unavailable:', err.message)
    clientStatus = 'unavailable'
    client = null
  }
}

async function sendBillToCustomer({ phone, customerName, orderId, totalAmount, advancePaid, balanceDue, pdfBuffer, upiId }) {
  if (DEMO_DISABLED) {
    throw new Error('Disabled in Demo due to security reasons')
  }
  if (!clientReady || !client) {
    throw new Error('WhatsApp not connected. Please scan QR code first.')
  }

  // Format phone number — Indian numbers need 91 prefix
  let formattedPhone = phone.replace(/\D/g, '') // remove non-digits
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1)
  }
  // Length-based hi reliable hai — startsWith('91') check ambiguous tha:
  // ek genuine 10-digit number jo khud '91...' se shuru hota hai (jaise 9198765432)
  // usse already-prefixed maan leta tha, aur galat 10-digit number WhatsApp ko
  // bhej deta tha (misdelivery risk — bill/UPI-link kisi aur ko chala jaana).
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone
  }
  // agar already 12-digit (91 + 10) hai to as-is chhodo; kisi aur length ka
  // number ho to bhi as-is bhejte hain — getNumberId khud fail karega aur
  // 'WhatsApp account nahi mila' error milega, jo galat-number-pe-send se
  // kahin behtar hai.
  const numberId = await client.getNumberId(formattedPhone)
  if (!numberId) {
    throw new Error(`WhatsApp account nahi mila: ${formattedPhone}`)
  }
  const chatId = numberId._serialized   

  // Compose message
  const paidSoFar = advancePaid + (totalAmount - advancePaid - balanceDue)
  const message = `🖨️ *VijayFlex Pro — Bill #${orderId}*

Dear *${customerName}*,

Your order bill is attached below.

💰 Order Total: ₹${totalAmount}
✅ Amount Paid: ₹${paidSoFar}
${balanceDue > 0 ? `⚠️ Balance Due: ₹${balanceDue}` : '✅ Fully Paid'}

Thank you for choosing us!
_VijayFlex Pro, Pilibangan_`

  // Send text message first
  await client.sendMessage(chatId, message)


  // UPI payment — deep link (>2000) ya QR (<=2000)
  if (balanceDue > 0 && upiId) {
    const upiString = `upi://pay?pa=${upiId}&pn=VijayFlex%20Pro&am=${balanceDue}&cu=INR&tn=Bill%20${orderId}`

    if (balanceDue > 2000) {
      await client.sendMessage(
        chatId,
        `💳 *Payment Request — Bill #${orderId}*\n\n` +
        `Balance Due: *₹${balanceDue}*\n\n` +
        `Use the link below to complete your payment 👇\n\n` +
        `${upiString}\n\n` +
        `_VijayFlex Pro, Pilibangan_`
      )
    } else {
      const QRCode = require('qrcode')
      const qrBuffer = await QRCode.toBuffer(upiString, { type: 'png', width: 400 })
      const qrMedia = new MessageMedia('image/png', qrBuffer.toString('base64'), `PayNow-${orderId}.png`)
      await client.sendMessage(chatId, qrMedia)
      await client.sendMessage(chatId, `📲 *Scan to Pay the Balance ₹${balanceDue}*`)
    }
  }

  // Send PDF if buffer provided
  if (pdfBuffer) {
    const media = new MessageMedia(
      'application/pdf',
      pdfBuffer.toString('base64'),
      `Bill-${orderId}.pdf`
    )
    await client.sendMessage(chatId, media)
  }

  return { success: true, phone: formattedPhone }
}

module.exports = { initWhatsApp, getClient, getStatus, getLastQR, sendBillToCustomer }