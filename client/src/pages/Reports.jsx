import { useState, useEffect } from 'react'
import PageLock from '../components/PageLock'
import { getMonthlyReport, getYearlyReport, getDues } from '../services/api'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import SectionCard from '../components/ui/SectionCard'
import StatCard from '../components/ui/StatCard'
import { SecondaryButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, TFoot, Tr, Td } from '../components/ui/Table'
import {
  BarChart3, Calendar, CalendarDays, AlertTriangle,
  CheckCircle2, XCircle, Printer, Wallet, TrendingDown, TrendingUp, Coins,
} from 'lucide-react'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'

function Reports() {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear = String(new Date().getFullYear())

  const [activeTab, setActiveTab] = useState('monthly')
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)
  const [report, setReport] = useState(null)
  const [yearlyReport, setYearlyReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // Clear any leftover message the moment the tab changes — otherwise an
  // "Error loading report" banner could still show up on the Yearly or Dues tab.
  useEffect(() => {
    queueMicrotask(() => setMessage(''))
  }, [activeTab])

  function loadMonthlyReport() {
    setLoading(true)
    setReport(null)
    getMonthlyReport(filterMonth, filterYear)
      .then(res => { setReport(res.data); setLoading(false) })
      .catch(() => { setMessage('Error loading report.'); setLoading(false) })
  }

  function loadYearlyReport() {
    setLoading(true)
    setYearlyReport(null)
    getYearlyReport(filterYear)
      .then(res => { setYearlyReport(res.data); setLoading(false) })
      .catch(() => { setMessage('Error loading report.'); setLoading(false) })
  }

  const monthName = (m) => new Date(2000, parseInt(m) - 1)
    .toLocaleString('en-IN', { month: 'long' })

  const TABS = [
    { key: 'monthly', label: 'Monthly P&L',     icon: Calendar },
    { key: 'yearly',  label: 'Yearly Summary',  icon: CalendarDays },
    { key: 'dues',    label: 'All Dues',        icon: AlertTriangle },
  ]

  return (
    <PageLock pageKey="reports" pageTitle="Reports">
      <div className="space-y-6">
        {/* Print styles: force a plain black-on-white printout regardless of
            the app's dark theme — a printed report on a black background
            would be unreadable and waste ink. */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area {
              position: absolute; left: 0; top: 0; width: 100%; padding: 0;
              background: #fff !important; color: #000 !important;
            }
            .print-area * { background: #fff !important; color: #000 !important; border-color: #ccc !important; box-shadow: none !important; }
          }
        `}</style>

        <PageHeader
          title="Reports"
          subtitle="Monthly profit & loss, yearly summaries, and outstanding dues"
        />

        {message && (
          <p
            onClick={() => setMessage('')}
            className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl cursor-pointer text-sm"
          >
            {message}
          </p>
        )}

        {/* TABS */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ══════════════════ MONTHLY P&L ══════════════════ */}
        {activeTab === 'monthly' && (
          <div className="space-y-5">
            <Card className="!p-4 flex items-end gap-3 flex-wrap">
              <div className="w-[150px]">
                <select className={inputClasses} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="w-[100px]">
                <select className={inputClasses} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {['2024', '2025', '2026', '2027'].map(y => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
              <button
                onClick={loadMonthlyReport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all whitespace-nowrap"
              >
                Load Report
              </button>
              {report && (
                <SecondaryButton icon={Printer} onClick={() => window.print()}>Print</SecondaryButton>
              )}
            </Card>

            {loading && <SectionLoader label="Loading report..." />}

            {report && (
              <div className="print-area space-y-5">
                <h3 className="text-lg font-bold text-white">
                  {monthName(report.month)} {report.year} — P&L Report
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Income"
                    value={`₹${report.income.total}`}
                    valueClassName="text-emerald-400"
                    sub={`Orders: ₹${report.income.order_payments} · Cash: ₹${report.income.cash_income} · UPI: ₹${report.income.upi_income}`}
                    icon={TrendingUp}
                    tone="emerald"
                  />
                  <StatCard
                    label="Total Expenses"
                    value={`₹${report.expenses.total}`}
                    valueClassName="text-red-400"
                    sub={`${report.expenses.by_category.length} categor${report.expenses.by_category.length !== 1 ? 'ies' : 'y'}`}
                    icon={TrendingDown}
                    tone="red"
                  />
                  <StatCard
                    label="Net Profit"
                    value={`₹${report.net_profit}`}
                    valueClassName={report.net_profit >= 0 ? 'text-white' : 'text-red-400'}
                    sub={report.net_profit >= 0 ? 'Profitable' : 'Loss'}
                    icon={report.net_profit >= 0 ? CheckCircle2 : XCircle}
                    tone={report.net_profit >= 0 ? 'blue' : 'red'}
                  />
                  <StatCard
                    label="Total Outstanding Dues"
                    value={`₹${report.dues.total_outstanding}`}
                    valueClassName="text-red-400"
                    sub={`${report.dues.list.length} customer${report.dues.list.length !== 1 ? 's' : ''} pending`}
                    icon={Wallet}
                    tone="red"
                  />
                  {report.commission_income?.count > 0 && (
                    <StatCard
                      label="Commission Income (Kept)"
                      value={`₹${report.commission_income.total}`}
                      valueClassName="text-emerald-400"
                      sub={`${report.commission_income.count} entr${report.commission_income.count !== 1 ? 'ies' : 'y'} · already included in Total Income above`}
                      icon={Coins}
                      tone="emerald"
                    />
                  )}
                </div>

                <SectionCard title="Expense Breakdown">
                  {report.expenses.by_category.length === 0 ? (
                    <p className="text-slate-500 text-sm">No expenses this month.</p>
                  ) : (
                    <div>
                      {report.expenses.by_category.map(cat => {
                        const pct = report.expenses.total > 0
                          ? Math.round((cat.total / report.expenses.total) * 100) : 0
                        return (
                          <div key={cat.category} className="flex items-center gap-4 py-2.5 border-b border-slate-800/60 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <div className="font-bold text-sm text-white">{cat.category}</div>
                              <div className="text-xs text-slate-500">{cat.count} transaction{cat.count !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="w-[200px] max-w-full">
                              <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <div className="min-w-[50px] text-right text-slate-500 text-xs">{pct}%</div>
                            <div className="min-w-[80px] text-right font-bold text-red-400 font-mono">₹{cat.total}</div>
                          </div>
                        )
                      })}
                      <div className="flex items-center gap-4 py-3 mt-1 bg-slate-800/40 rounded-xl px-3">
                        <div className="flex-1 font-bold text-white">Total</div>
                        <div className="min-w-[80px] text-right font-bold text-red-400 font-mono text-base">₹{report.expenses.total}</div>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {report.dues.list.length > 0 && (
                  <SectionCard title="Pending Dues">
                    <Table minWidth="700px">
                      <THead>
                        <Th>Firm</Th><Th>Phone</Th><Th>Orders Due</Th>
                        <Th>Opening Balance</Th><Th>Total Due</Th><Th>Follow-up</Th>
                      </THead>
                      <TBody>
                        {report.dues.list.map(d => (
                          <Tr key={d.customer_id}>
                            <Td className="font-bold text-white">{d.firm_name}</Td>
                            <Td className="text-slate-300">{d.phone || '—'}</Td>
                            <Td className="text-slate-300">
                              {d.orders_due > 0
                                ? <>₹{d.orders_due} <span className="text-[11px] text-slate-500">({d.orders_due_count})</span></>
                                : '—'}
                            </Td>
                            <Td className="text-slate-300">{d.opening_balance > 0 ? `₹${d.opening_balance}` : '—'}</Td>
                            <Td><span className="font-mono font-bold text-red-400">₹{d.total_due}</span></Td>
                            <Td>
                              {d.follow_up_date ? (
                                <span className={`inline-flex items-center gap-1 ${d.follow_up_date <= new Date().toISOString().split('T')[0] ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                                  {d.follow_up_date}
                                  {d.follow_up_date <= new Date().toISOString().split('T')[0] && <AlertTriangle className="w-3 h-3" />}
                                </span>
                              ) : '—'}
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </SectionCard>
                )}
              </div>
            )}

            {!report && !loading && (
              <div className="text-center py-16 text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                Select a month and year, then click "Load Report"
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ YEARLY SUMMARY ══════════════════ */}
        {activeTab === 'yearly' && (
          <div className="space-y-5">
            <Card className="!p-4 flex items-end gap-3 flex-wrap">
              <div className="w-[100px]">
                <select className={inputClasses} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  {['2024', '2025', '2026', '2027'].map(y => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
              <button
                onClick={loadYearlyReport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all whitespace-nowrap"
              >
                Load Yearly Report
              </button>
              {yearlyReport && (
                <SecondaryButton icon={Printer} onClick={() => window.print()}>Print</SecondaryButton>
              )}
            </Card>

            {loading && <SectionLoader label="Loading yearly report..." />}

            {yearlyReport && (
              <div className="print-area space-y-5">
                <h3 className="text-lg font-bold text-white">{yearlyReport.year} — Yearly Summary</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label={`Total Income ${yearlyReport.year}`} value={`₹${yearlyReport.total_income}`} valueClassName="text-emerald-400" icon={TrendingUp} tone="emerald" />
                  <StatCard label={`Total Expenses ${yearlyReport.year}`} value={`₹${yearlyReport.total_expenses}`} valueClassName="text-red-400" icon={TrendingDown} tone="red" />
                  <StatCard
                    label={`Net Profit ${yearlyReport.year}`}
                    value={`₹${yearlyReport.net_profit}`}
                    valueClassName={yearlyReport.net_profit >= 0 ? 'text-white' : 'text-red-400'}
                    icon={yearlyReport.net_profit >= 0 ? CheckCircle2 : XCircle}
                    tone={yearlyReport.net_profit >= 0 ? 'blue' : 'red'}
                  />
                  {yearlyReport.commission_income?.count > 0 && (
                    <StatCard
                      label={`Commission Income (Kept) ${yearlyReport.year}`}
                      value={`₹${yearlyReport.commission_income.total}`}
                      valueClassName="text-emerald-400"
                      sub={`${yearlyReport.commission_income.count} entries · already included in Total Income above`}
                      icon={Coins}
                      tone="emerald"
                    />
                  )}
                </div>

                <SectionCard title="Month-wise Breakdown">
                  <Table minWidth="600px">
                    <THead>
                      <Th>Month</Th><Th>Income</Th><Th>Expenses</Th><Th>Net Profit</Th><Th>Status</Th>
                    </THead>
                    <TBody>
                      {yearlyReport.monthly_summary.map(m => (
                        <Tr key={m.month}>
                          <Td className="font-bold text-white">{m.month_name}</Td>
                          <Td className="font-bold text-emerald-400 font-mono">{m.income > 0 ? `₹${m.income}` : '—'}</Td>
                          <Td className="text-red-400 font-mono">{m.expenses > 0 ? `₹${m.expenses}` : '—'}</Td>
                          <Td className={`font-bold font-mono ${m.net >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {m.income > 0 || m.expenses > 0 ? `₹${m.net}` : '—'}
                          </Td>
                          <Td>
                            {m.income === 0 && m.expenses === 0 ? (
                              <span className="text-slate-600 text-xs">No data</span>
                            ) : m.net >= 0 ? (
                              <span className="text-emerald-400 text-xs inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Profit</span>
                            ) : (
                              <span className="text-red-400 text-xs inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Loss</span>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                    <TFoot>
                      <Tr>
                        <Td className="font-bold text-white">Total</Td>
                        <Td className="font-bold text-emerald-400 font-mono">₹{yearlyReport.total_income}</Td>
                        <Td className="font-bold text-red-400 font-mono">₹{yearlyReport.total_expenses}</Td>
                        <Td className={`font-bold font-mono text-base ${yearlyReport.net_profit >= 0 ? 'text-white' : 'text-red-400'}`}>
                          ₹{yearlyReport.net_profit}
                        </Td>
                        <Td></Td>
                      </Tr>
                    </TFoot>
                  </Table>
                </SectionCard>
              </div>
            )}

            {!yearlyReport && !loading && (
              <div className="text-center py-16 text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                Select a year and click "Load Yearly Report"
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ALL DUES ══════════════════ */}
        {activeTab === 'dues' && <DuesTab />}
      </div>
    </PageLock>
  )
}

function DuesTab() {
  const [dues, setDues] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalDue, setTotalDue] = useState(0)

  useEffect(() => {
    getDues()
      .then(res => {
        setDues(res.data)
        setTotalDue(res.data.reduce((s, d) => s + d.total_due, 0))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <SectionLoader label="Loading dues..." />

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-white font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4" /> All Pending Dues</h3>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl">
            <span className="text-slate-400 text-xs">Total Outstanding: </span>
            <strong className="text-red-400 text-lg font-mono">₹{totalDue}</strong>
          </div>
          {dues.length > 0 && (
            <SecondaryButton icon={Printer} onClick={() => window.print()}>Print</SecondaryButton>
          )}
        </div>
      </div>

      {dues.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl">
          <p className="text-emerald-400 text-lg font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> No pending dues!</p>
          <p className="text-sm text-slate-500 mt-2">All customers are up to date.</p>
        </div>
      ) : (
        <div className="print-area">
          <Card padded={false} className="overflow-hidden">
            <Table minWidth="750px">
              <THead>
                <Th className="pl-4">#</Th><Th>Firm</Th><Th>Phone</Th><Th>Orders Due</Th>
                <Th>Opening Balance</Th><Th>Total Due</Th><Th className="pr-4">Follow-up</Th>
              </THead>
              <TBody>
                {dues.map((d, i) => (
                  <Tr key={d.customer_id}>
                    <Td className="pl-4 text-slate-400">{i + 1}</Td>
                    <Td className="font-bold text-white">{d.firm_name}</Td>
                    <Td className="text-slate-300">{d.phone || '—'}</Td>
                    <Td className="text-slate-300">
                      {d.orders_due > 0
                        ? <>₹{d.orders_due} <span className="text-[11px] text-slate-500">({d.orders_due_count})</span></>
                        : '—'}
                    </Td>
                    <Td className="text-slate-300">{d.opening_balance > 0 ? `₹${d.opening_balance}` : '—'}</Td>
                    <Td><span className="font-mono font-bold text-base text-red-400">₹{d.total_due}</span></Td>
                    <Td className="pr-4">
                      {d.follow_up_date ? (
                        <span className={`inline-flex items-center gap-1 font-bold ${d.follow_up_date <= new Date().toISOString().split('T')[0] ? 'text-red-400' : 'text-slate-300'}`}>
                          {d.follow_up_date}
                          {d.follow_up_date <= new Date().toISOString().split('T')[0] && <AlertTriangle className="w-3 h-3" />}
                        </span>
                      ) : '—'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Reports
