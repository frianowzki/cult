import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.08 } },
  },
  item: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  },
}

const FEATURES = [
  {
    icon: '◎',
    title: 'Shelby Storage',
    desc: 'Content lives on decentralized hot storage. No servers, no takedowns.',
  },
  {
    icon: '⬡',
    title: 'Aptos Speed',
    desc: 'Sub-second finality. Subscriptions and purchases settle instantly on-chain.',
  },
  {
    icon: '✦',
    title: 'Three-Tier Memberships',
    desc: 'Fan, Member, Inner Circle. Creators define pricing and perks.',
  },
  {
    icon: '◈',
    title: '95% to Creators',
    desc: 'The platform takes 5%. The rest goes directly to your wallet.',
  },
  {
    icon: '▣',
    title: 'All Content Types',
    desc: 'Videos, images, audio, written posts. One platform for every format.',
  },
  {
    icon: '⊕',
    title: 'Direct Tips',
    desc: 'Fans tip in Shelby USD. Fast, direct, no middlemen.',
  },
]

export default function Home() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <section
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'center',
          padding: '36px 20px 24px',
          position: 'relative',
          overflow: 'hidden',
          gap: 20,
          background: 'transparent',
          flex: 1,
        }}
      >
        <div className="cult-hero-bg">
          <div className="cult-hero-layer a" />
          <div className="cult-hero-layer b" />
          <div className="cult-hero-layer c" />
          <div className="cult-hero-sweep" />
          <div className="cult-hero-grain" />
          <div className="cult-hero-vignette" />
        </div>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(68vw, 640px)',
            height: 'min(68vw, 640px)',
            border: '1px solid color-mix(in srgb, var(--accent) 10%, transparent)',
            borderRadius: '50%',
            pointerEvents: 'none',
            opacity: 0.7,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(96vw, 980px)',
            height: 'min(96vw, 980px)',
            border: '1px solid color-mix(in srgb, var(--accent) 6%, transparent)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <motion.div
          variants={stagger.container}
          initial="initial"
          animate="animate"
          style={{
            position: 'relative',
            maxWidth: 860,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            transform: 'translateY(-8px)',
          }}
        >
          <motion.h1
            variants={stagger.item}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 300,
              fontStyle: 'normal',
              marginBottom: 18,
              color: 'var(--text)',
              textAlign: 'center',
              lineHeight: 1.06,
            }}
          >
            Where creators build
            <br />
            <em style={{
              fontStyle: 'italic',
              background: 'linear-gradient(90deg, var(--accent-3) 0%, var(--accent) 52%, var(--accent-2) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>devoted followings</em>
          </motion.h1>

          <motion.p
            variants={stagger.item}
            style={{ fontSize: '1.02rem', maxWidth: 620, margin: '0 auto 22px', lineHeight: 1.65, textAlign: 'center' }}
          >
            CULT is a decentralized creator platform on Aptos. Upload content to Shelby Serves,
            monetize with subscriptions, pay-per-view, and direct tips — all on-chain.
          </motion.p>

          <motion.div
            variants={stagger.item}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 6 }}
          >
            <Link to="/explore" className="btn btn-primary btn-lg">
              Explore Creators
            </Link>
            <Link to="/dashboard" className="btn btn-lg">
              Start Creating
            </Link>
          </motion.div>
        </motion.div>

        <div
          style={{
            width: '100%',
            maxWidth: 1120,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            border: 'none',
            background: 'transparent',
            backdropFilter: 'none',
          }}
        >
          {FEATURES.slice(0, 4).map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.05, duration: 0.35 }}
              className="home-feature-card"
            >
              <div
                className="home-feature-icon"
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text)',
                  marginBottom: 6,
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-2)' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
