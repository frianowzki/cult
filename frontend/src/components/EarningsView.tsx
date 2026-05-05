import { useMemo } from 'react'
import { motion } from 'framer-motion'

import type { PurchaseHistoryItem } from '../lib/aptos-types'
import { unitsToUsd } from '../lib/aptos'

interface Props {
  creatorAddr: string
  totalEarned: number
  purchaseHistory: PurchaseHistoryItem[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function EarningsView({ creatorAddr, totalEarned, purchaseHistory }: Props) {
  // ── Revenue by source ─────────────────────────────────────────────────────
  const revenueBySource = useMemo(() => {
    let subscription = 0
    let purchase = 0
    let tip = 0

    for (const item of purchaseHistory) {
      if (item.kind === 0) {
        subscription += item.amount_paid
      } else if (item.kind === 1) {
        purchase += item.amount_paid
      } else if (item.kind === 2) {
        tip += item.amount_paid
      }
    }

    return { subscription, purchase, tip }
  }, [purchaseHistory])

  // ── Monthly earnings (last 6 months) ──────────────────────────────────────
  const monthlyEarnings = useMemo(() => {
    const now = new Date()
    const months: {
      key: string
      label: string
      year: number
      month: number
      subscription: number
      purchase: number
      tip: number
      total: number
    }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({
        key,
        label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        subscription: 0,
        purchase: 0,
        tip: 0,
        total: 0,
      })
    }

    for (const item of purchaseHistory) {
      if (!item.timestamp) continue
      const d = new Date(item.timestamp * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const bucket = months.find((m) => m.key === key)
      if (!bucket) continue

      if (item.kind === 0) {
        bucket.subscription += item.amount_paid
      } else if (item.kind === 1) {
        bucket.purchase += item.amount_paid
      } else if (item.kind === 2) {
        bucket.tip += item.amount_paid
      }
      bucket.total += item.amount_paid
    }

    return months
  }, [purchaseHistory])

  const hasTipRevenue = revenueBySource.tip > 0

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Total Earned ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{
          padding: '32px 28px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(254,119,201,0.08), rgba(254,119,201,0.02))',
          border: '1px solid rgba(254,119,201,0.16)',
        }}
      >
        <div className="section-eyebrow">Total Earned</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 3.8rem)',
            fontWeight: 300,
            color: 'var(--accent)',
            lineHeight: 1.1,
            margin: '12px 0 8px',
          }}
        >
          ${unitsToUsd(totalEarned)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Lifetime earnings from {purchaseHistory.length} transaction{purchaseHistory.length === 1 ? '' : 's'}
        </div>
      </motion.div>

      {/* ── Revenue Breakdown by Source ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card"
        style={{ padding: '22px 24px' }}
      >
        <div className="section-eyebrow">Revenue Sources</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 18 }}>
          Breakdown by source
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasTipRevenue
              ? 'repeat(3, 1fr)'
              : 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          {/* Subscription revenue */}
          <div style={{ padding: '16px 18px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 16, marginBottom: 10 }}>
              ◎
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 300,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              ${unitsToUsd(revenueBySource.subscription)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Subscriptions
            </div>
            {totalEarned > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {Math.round((revenueBySource.subscription / totalEarned) * 100)}% of total
              </div>
            )}
          </div>

          {/* Purchase revenue */}
          <div style={{ padding: '16px 18px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 16, marginBottom: 10 }}>
              ▣
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 300,
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              ${unitsToUsd(revenueBySource.purchase)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Content Purchases
            </div>
            {totalEarned > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {Math.round((revenueBySource.purchase / totalEarned) * 100)}% of total
              </div>
            )}
          </div>

          {/* Tip revenue */}
          {hasTipRevenue && (
            <div style={{ padding: '16px 18px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 16, marginBottom: 10 }}>
                ◇
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  fontWeight: 300,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                ${unitsToUsd(revenueBySource.tip)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Tips
              </div>
              {totalEarned > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {Math.round((revenueBySource.tip / totalEarned) * 100)}% of total
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revenue breakdown bar */}
        {totalEarned > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                height: 8,
                borderRadius: 4,
                overflow: 'hidden',
                background: 'var(--bg-3)',
              }}
            >
              {revenueBySource.subscription > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(revenueBySource.subscription / totalEarned) * 100}%` }}
                  transition={{ duration: 0.6 }}
                  style={{ background: 'var(--accent)', height: '100%' }}
                />
              )}
              {revenueBySource.purchase > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(revenueBySource.purchase / totalEarned) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  style={{ background: 'rgba(254,119,201,0.5)', height: '100%' }}
                />
              )}
              {revenueBySource.tip > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(revenueBySource.tip / totalEarned) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{ background: 'rgba(254,119,201,0.3)', height: '100%' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Subscriptions', color: 'var(--accent)' },
                { label: 'Purchases', color: 'rgba(254,119,201,0.5)' },
                ...(hasTipRevenue ? [{ label: 'Tips', color: 'rgba(254,119,201,0.3)' }] : []),
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Monthly Earnings Table ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card"
        style={{ padding: '22px 24px' }}
      >
        <div className="section-eyebrow">Monthly</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 18 }}>
          Monthly earnings
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gap: 0, minWidth: 480 }}>
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: hasTipRevenue
                  ? '1fr 100px 100px 80px 110px'
                  : '1fr 110px 110px 120px',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <div>Month</div>
              <div style={{ textAlign: 'right' }}>Subscriptions</div>
              <div style={{ textAlign: 'right' }}>Purchases</div>
              {hasTipRevenue && <div style={{ textAlign: 'right' }}>Tips</div>}
              <div style={{ textAlign: 'right' }}>Total</div>
            </div>

            {/* Rows */}
            {monthlyEarnings.map((month, i) => (
              <motion.div
                key={month.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: hasTipRevenue
                    ? '1fr 100px 100px 80px 110px'
                    : '1fr 110px 110px 120px',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{month.label}</div>
                <div className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                  {month.subscription > 0 ? `$${unitsToUsd(month.subscription)}` : '—'}
                </div>
                <div className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                  {month.purchase > 0 ? `$${unitsToUsd(month.purchase)}` : '—'}
                </div>
                {hasTipRevenue && (
                  <div className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                    {month.tip > 0 ? `$${unitsToUsd(month.tip)}` : '—'}
                  </div>
                )}
                <div
                  className="mono"
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: month.total > 0 ? 'var(--accent)' : 'var(--text-3)',
                  }}
                >
                  {month.total > 0 ? `$${unitsToUsd(month.total)}` : '—'}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Withdraw Earnings ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
        style={{ padding: '22px 24px' }}
      >
        <div className="section-eyebrow">Withdraw</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 14 }}>
          Withdraw Earnings
        </h3>

        <div
          style={{
            padding: '18px 20px',
            border: '1px solid var(--border)',
            background: 'var(--bg-2)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Total Earned
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8rem',
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                ${unitsToUsd(totalEarned)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Wallet
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: 'var(--accent)',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {creatorAddr}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              background: 'rgba(254,119,201,0.06)',
              border: '1px solid rgba(254,119,201,0.12)',
              fontSize: 12,
              color: 'var(--text-2)',
              lineHeight: 1.6,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
              ◈
            </span>
            <div>
              <strong>Direct wallet deposits.</strong> All earnings from subscriptions and content purchases are sent directly to your connected Aptos wallet on each transaction. There is no platform balance to withdraw — you already hold every dollar earned on-chain.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 300, lineHeight: 1, marginBottom: 6 }}>
              {purchaseHistory.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Total Transactions
            </div>
          </div>
          <div style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 300, lineHeight: 1, marginBottom: 6 }}>
              ${unitsToUsd(purchaseHistory.length > 0 ? totalEarned / purchaseHistory.length : 0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Avg per Transaction
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
