import axios from 'axios'

const api = axios.create({
  baseURL: `http://${window.location.hostname}:5000/api`
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('flexshop_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('flexshop_token')
      localStorage.removeItem('flexshop_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (username, password) =>
  axios.post(`http://${window.location.hostname}:5000/api/auth/login`, { username, password })
export const verifyToken = (token) =>
  axios.post(`http://${window.location.hostname}:5000/api/auth/verify`, { token })

// Dashboard
export const getDashboard = () => api.get('/dashboard')

// Customers
export const getCustomers = (search) => api.get('/customers', { params: search ? { search } : {} })
export const createCustomer = (data) => api.post('/customers', data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`)
export const getCustomerProfile = (id) => api.get(`/customers/${id}`)
export const addOpeningBalance = (id, data) => api.post(`/customers/${id}/opening-balance`, data)
export const uploadCustomerPhoto = (id, file) => {
  const formData = new FormData()
  formData.append('photo', file)
  return api.post(`/customers/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deleteCustomerPhoto = (id) => api.delete(`/customers/${id}/photo`)

// Orders
export const getOrders = (params) => api.get('/orders', { params })
export const createOrder = (data) => api.post('/orders', data)
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data)
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status })
export const getOrderDetail = (id) => api.get(`/orders/${id}`)
export const deleteOrder = (id) => api.delete(`/orders/${id}`)
export const addPayment = (data) => api.post('/payments', data)
export const getOrderPhotos = (orderId) => api.get(`/orders/${orderId}/photos`)
export const uploadOrderPhoto = (orderId, file, caption) => {
  const formData = new FormData()
  formData.append('photo', file)
  if (caption) formData.append('caption', caption)
  return api.post(`/orders/${orderId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deleteOrderPhoto = (orderId, photoId) => api.delete(`/orders/${orderId}/photos/${photoId}`)

// Employees
export const getEmployees = () => api.get('/employees')
export const createEmployee = (data) => api.post('/employees', data)
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data)
export const deleteEmployee = (id) => api.delete(`/employees/${id}`)
export const updateEmployeeSalary = (id, data) => api.put(`/employees/${id}/salary`, data)
export const getEmployeeProfile = (id) => api.get(`/employees/profile/${id}`)
export const markAttendance = (data) => api.post('/employees/attendance', data)
export const getAttendance = (employeeId, params) => api.get(`/employees/attendance/${employeeId}`, { params })
export const getSalary = (employeeId, params) => api.get(`/employees/salary/${employeeId}`, { params })
export const generateSalary = (data) => api.post('/employees/generate-salary', data)

// Daily Sales
export const getDailySales = (params) => api.get('/daily', { params })
export const createDailySale = (data) => api.post('/daily', data)
export const updateDailySale = (id, data) => api.put(`/daily/${id}`, data)
export const deleteDailySale = (id) => api.delete(`/daily/${id}`)
export const getDailySummary = (month, year) => api.get('/daily/summary', { params: { month, year } })
export const getTodaySales = () => api.get('/daily/today')
export const getDailyLedgerByDate = (date) => api.get(`/daily/ledger/date?date=${date}&_=${Date.now()}`)
export const saveCashIncome = (data) => api.post('/daily/cash-income', data)
export const getCashDrawer = (date) => api.get(`/daily/cash-drawer?date=${date}`)
export const getDenominationDrawer = () => api.get('/daily/denomination-drawer')
export const setDrawerBaseline = (data) => api.post('/daily/denomination-drawer/set-baseline', data)
export const deleteLedgerEntry = (password, type, id) => api.delete('/daily/entry', { data: { password, type, id } })
export const getSetting = (key) => api.get(`/settings/${key}`)
export const setSetting = (key, value) => api.put(`/settings/${key}`, { value })
export const getGallaHistory = () => api.get('/daily/denomination-drawer/history')

// Expenses
export const getExpenses = (month, year) => api.get('/expenses', { params: { month, year } })
export const createExpense = (data) => api.post('/expenses', data)
export const addExpense = (data) => api.post('/expenses', data)
export const deleteExpense = (id) => api.delete(`/expenses/${id}`)

// Cheques
export const getCheques = (params) => api.get('/cheques', { params })
export const getCheque = (id) => api.get(`/cheques/${id}`)
export const addCheque = (data) => api.post('/cheques', data)
export const updateCheque = (id, data) => api.put(`/cheques/${id}`, data)
export const updateChequeStatus = (id, status) => api.put(`/cheques/${id}/status`, { status })
export const deleteCheque = (id) => api.delete(`/cheques/${id}`)
export const getChequeSummary = (params) => api.get('/cheques/summary', { params })

// UPI
export const getUPI = () => api.get('/upi')
export const getUpiTransactions = (params) => api.get('/upi', { params })
export const getUpiSummary = (month, year) => api.get('/upi/summary', { params: { month, year } })
export const addUpiTransaction = (data) => api.post('/upi', data)
export const createUPI = (data) => api.post('/upi', data)
export const deleteUPI = (id) => api.delete(`/upi/${id}`)

// Vendors
export const getVendors = () => api.get('/vendors')
export const getVendor = (id) => api.get(`/vendors/${id}`)
export const addVendor = (data) => api.post('/vendors', data)
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data)
export const deleteVendor = (id) => api.delete(`/vendors/${id}`)
export const addVendorPurchase = (id, data) => api.post(`/vendors/${id}/purchase`, data)
export const addVendorPayment = (id, data) => api.post(`/vendors/${id}/payment`, data)

// Inventory

// ════════════════════════════════════════════════════════════════════════════
// FLEX
// ════════════════════════════════════════════════════════════════════════════
export const getFlexStock    = ()           => api.get('/inventory/flex')
export const addFlexStock    = (data)       => api.post('/inventory/flex', data)
export const useFlexStock    = (id, data)   => api.put(`/inventory/flex/${id}/use`, data)
export const updateFlexStock = (id, data)   => api.put(`/inventory/flex/${id}`, data)
export const deleteFlexStock = (id)         => api.delete(`/inventory/flex/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// STAMPS
// ════════════════════════════════════════════════════════════════════════════
export const getStamps    = ()         => api.get('/inventory/stamps')
export const addStamp     = (data)     => api.post('/inventory/stamps', data)
export const updateStamp  = (id, data) => api.put(`/inventory/stamps/${id}`, data)
export const deleteStamp  = (id)       => api.delete(`/inventory/stamps/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// CHEMICALS
// ════════════════════════════════════════════════════════════════════════════
export const getChemicals    = ()         => api.get('/inventory/chemicals')
export const addChemical     = (data)     => api.post('/inventory/chemicals', data)
export const updateChemical  = (id, data) => api.put(`/inventory/chemicals/${id}`, data)
export const deleteChemical  = (id)       => api.delete(`/inventory/chemicals/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// PHOTO FRAMES
// ════════════════════════════════════════════════════════════════════════════
export const getFrames    = ()         => api.get('/inventory/frames')
export const addFrame     = (data)     => api.post('/inventory/frames', data)
export const updateFrame  = (id, data) => api.put(`/inventory/frames/${id}`, data)
export const deleteFrame  = (id)       => api.delete(`/inventory/frames/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// INK & SOLVENT
// ════════════════════════════════════════════════════════════════════════════
export const getInkStock    = ()         => api.get('/inventory/ink')
export const addInkStock    = (data)     => api.post('/inventory/ink', data)
export const updateInkStock = (id, data) => api.put(`/inventory/ink/${id}`, data)
export const deleteInkStock = (id)       => api.delete(`/inventory/ink/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// INVENTORY LOG
// ════════════════════════════════════════════════════════════════════════════
export const getInventoryLog = () => api.get('/inventory/log')

// ════════════════════════════════════════════════════════════════════════════
// DYNAMIC CATEGORIES  (NEW)
// ════════════════════════════════════════════════════════════════════════════
export const getInventoryCategories  = ()         => api.get('/inventory/categories')
export const addInventoryCategory    = (data)     => api.post('/inventory/categories', data)
export const deleteInventoryCategory = (id)       => api.delete(`/inventory/categories/${id}`)

// ════════════════════════════════════════════════════════════════════════════
// DYNAMIC ITEMS  (NEW)
// ════════════════════════════════════════════════════════════════════════════
export const getDynamicItems    = (catId)           => api.get(`/inventory/categories/${catId}/items`)
export const addDynamicItem     = (catId, data)     => api.post(`/inventory/categories/${catId}/items`, data)
export const updateDynamicItem  = (catId, id, data) => api.put(`/inventory/categories/${catId}/items/${id}`, data)
export const deleteDynamicItem  = (catId, id)       => api.delete(`/inventory/categories/${catId}/items/${id}`)


// Reports
export const getReports = (params) => api.get('/reports', { params })
export const getMonthlyReport = (month, year) => api.get('/daily/report', { params: { month, year } })
export const getYearlyReport = (year) => api.get('/daily/report/yearly', { params: { year } })
export const getDues = () => api.get('/payments/dues')

// WhatsApp
export const getWhatsAppStatus = () => api.get('/whatsapp/status')
export const sendBillWhatsApp = (orderId, upiId) => api.post(`/whatsapp/send-bill/${orderId}`, { upiId: upiId || null })
export const getWhatsAppQR = () => api.get('/whatsapp/qr')

// PDF
export const generatePDF = (orderId) => api.get(`/pdf/bill/${orderId}`, { responseType: 'blob' })
export const generateCustomerStatement = (customerId) => api.get(`/pdf/statement/${customerId}`, { responseType: 'blob' })
export const sendStatementWhatsApp = (customerId, upiId) => api.post(`/whatsapp/send-statement/${customerId}`, { upiId })

// Recycle Bin
export const getRecycleBin = () => api.get('/customers/deleted/recent')
export const restoreCustomer = (id) => api.put(`/customers/${id}/restore`)

// Commission
export const getCommissionHistory = (customerId) =>
  api.get(`/commission${customerId ? `?customer_id=${customerId}` : ''}`)
export const getCommissionBalance = (customerId) =>
  api.get(`/commission/balance/${customerId}`)
export const creditCommission = (data) => api.post('/commission/credit', data)
export const returnCommission = (data) => api.post('/commission/return', data)

// Backup
export const downloadBackup = () => api.get('/backup/download', { responseType: 'blob' })

// UPI QR History
export const getUpiQrHistory = () => api.get('/upi-qr-history')
export const addUpiQrHistory = (data) => api.post('/upi-qr-history', data)
export const toggleUpiQrPaid = (id) => api.put(`/upi-qr-history/${id}/toggle-paid`)
export const deleteUpiQrHistory = (id) => api.delete(`/upi-qr-history/${id}`)
export const clearUpiQrHistory = () => api.delete('/upi-qr-history')

export default api