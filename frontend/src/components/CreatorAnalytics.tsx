import { useMemo } from 'react'
import { motion } from 'framer-motion'

import type { Content, PurchaseHistoryItem } from '../lib/aptos-types'
import { unitsToUsd } from '../lib/aptos'
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_ICONS } from '../lib/constants'

interface Props {
  contents: Content[]
  purchaseHistory: PurchaseHistoryItem[]
  totalEarned: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getMonthKey(ts: number): string {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTH_LABELS[Number(m) - 1]} ${y.slice(2)}`
}

export default function CreatorAnalytics({ contents, purchaseHistory, totalEarned }: Props) {
  // ── Revenue over time (last 6 months) ────────────────────────────────────
  const revenueChart = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; revenue: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: MONTH_LABELS[d.getMonth()], revenue: 0 })
    }

    for (const item of purchaseHistory) {
      if (!item.timestamp) continue
      const key = getMonthKey(item.timestamp)
      const bucket = months.find((m) => m.key === key)
      if (bucket) bucket.revenue += item.amount_paid
    }

    const maxRevenue = Math.max(...months.map((m) => m.revenue), 1)
    return { months, maxRevenue }
  }, [purchaseHistory])

  // ── Content type breakdown ────────────────────────────────────────────────
  const contentBreakdown = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const c of contents) {
      counts[c.content_type] = (counts[c.content_type] || 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ type: Number(type), count }))
      .sort((a, b) => b.count - a.count)
  }, [contents])

  // ── Top performing content ────────────────────────────────────────────────
  const topContent = useMemo(() => {
    const revenueMap: Record<number, { sales: number; revenue: number }> = {}
    for (const item of purchaseHistory) {
      if (item.kind !== 1) continue // only direct content purchases
      const id = item.content_id
      if (!revenueMap[id]) revenueMap[id] = { sales: 0, revenue: 0 }
      revenueMap[id].sales += 1
      revenueMap[id].revenue += item.amount_paid
    }

    return contents
      .map((c) => ({
        content: c,
        sales: revenueMap[c.id]?.sales || 0,
        revenue: revenueMap[c.id]?.revenue || 0,
      }))
      .filter((item) => item.sales > 0 || item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales)
      .slice(0, 5)
  }, [contents, purchaseHistory])

  // ── Engagement summary ────────────────────────────────────────────────────
  const totalSales = purchaseHistory.length
  const avgRevenuePerSale = totalSales > 0 ? totalEarned / totalSales : 0

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Engagement Summary Cards ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {[
          { label: 'Total Revenue', value: `$${unitsToUsd(totalEarned)}`, icon: '◈' },
          { label: 'Total Sales', value: totalSales, icon: '◎' },
          { label: 'Avg Revenue / Sale', value: `$${unitsToUsd(avgRevenuePerSale)}`, icon: '◇' },
          { label: 'Content Posts', value: contents.length, icon: '▣' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card"
            style={{ padding: '20px 22px' }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 18, marginBottom: 12 }}>
              {stat.icon}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                fontWeight: 300,
                color: 'var(--text)',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Revenue Over Time Bar Chart ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
        style={{ padding: '22px 24px' }}
      >
        <div className="section-eyebrow">Revenue</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 20 }}>
          Revenue over time
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            height: 180,
            paddingBottom: 28,
            position: 'relative',
          }}
        >
          {/* Y-axis grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <div
              key={pct}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${28 + pct * (180 - 28)}px`,
                height: 1,
                background: 'var(--border)',
                opacity: 0.5,
              }}
            />
          ))}

          {revenueChart.months.map((month, i) => {
            const heightPct = revenueChart.maxRevenue > 0
              ? (month.revenue / revenueChart.maxRevenue) * 100
              : 0

            return (
              <div
                key={month.key}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {/* Value label */}
                {month.revenue > 0 && (
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap' }}
                  >
                    ${unitsToUsd(month.revenue)}
                  </div>
                )}

                {/* Bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPct, 2)}%` }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                  style={{
                    width: '100%',
                    maxWidth: 60,
                    background: month.revenue > 0
                      ? 'linear-gradient(180deg, var(--accent), rgba(254,119,201,0.5))'
                      : 'var(--bg-3)',
                    borderRadius: '3px 3px 0 0',
                    minHeight: 2,
                  }}
                />

                {/* Month label */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    fontSize: 10,
                    color: 'var(--text-3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {month.label}
                </div>
              </div>
            )
          })}
        </div>

        {purchaseHistory.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
            No revenue data yet. Sales will appear here once fans start purchasing.
          </div>
        )}
      </motion.div>

      {/* ── Content Type Breakdown + Top Content ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Content Type Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
          style={{ padding: '22px 24px' }}
        >
          <div className="section-eyebrow">Content</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 16 }}>
            Content breakdown
          </h3>

          {contentBreakdown.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {contentBreakdown.map(({ type, count }) => {
                const pct = contents.length > 0 ? (count / contents.length) * 100 : 0
                return (
                  <div key={type}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 14 }}>
                          {CONTENT_TYPE_ICONS[type] || '•'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {CONTENT_TYPE_LABELS[type] || 'Unknown'}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {count} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: 'var(--bg-3)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: 'var(--accent)',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-3)', margin: 0 }}>No content published yet.</p>
          )}
        </motion.div>

        {/* Top Performing Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card"
          style={{ padding: '22px 24px' }}
        >
          <div className="section-eyebrow">Performance</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 16 }}>
            Top performing content
          </h3>

          {topContent.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {topContent.map((item, i) => (
                <div
                  key={item.content.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    paddingBottom: 12,
                    borderBottom: i < topContent.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>
                        {CONTENT_TYPE_ICONS[item.content.content_type] || '•'}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.content.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {item.sales} sale{item.sales === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>
                      ${unitsToUsd(item.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-3)', margin: 0 }}>
              No paid content sales yet. Your top posts will appear here once fans start purchasing.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
