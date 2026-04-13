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
    <div>
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '96px 20px 72px',
          position: 'relative',
          overflow: 'hidden',
          gap: 40,
          background: '#080807',
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
            border: '1px solid rgba(200,169,110,0.05)',
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
            border: '1px solid rgba(200,169,110,0.025)',
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
  maxWidth: 800,
  width: '100%',
}}
        >
          <motion.h1
            variants={stagger.item}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 300,
              fontStyle: 'italic',
              marginBottom: 24,
              color: 'var(--text)',
            }}
          >
            Where creators build
            <br />
            <em style={{ color: 'var(--accent)' }}>devoted followings</em>
          </motion.h1>

          <motion.p
            variants={stagger.item}
            style={{ fontSize: '1.1rem', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7 }}
          >
            CULT is a decentralized creator platform on Aptos. Upload content to Shelby Serves,
            monetize with subscriptions, pay-per-view, and direct tips — all on-chain.
          </motion.p>

          <motion.div
            variants={stagger.item}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <Link to="/explore" className="btn btn-primary btn-lg">
              Explore Creators
            </Link>
            <Link to="/dashboard" className="btn btn-lg">
              Start Creating
            </Link>
          </motion.div>
        </motion.div>

      </section>

      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '80px 32px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ marginBottom: 56, textAlign: 'center' }}>
          <div className="section-eyebrow">How it works</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}>
            Built for the on-chain era
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 1,
            border: '1px solid var(--border)',
          }}
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              style={{
                padding: '36px 32px',
                background: 'var(--bg-2)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '1.5rem',
                  color: 'var(--accent)',
                  marginBottom: 16,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text)',
                  marginBottom: 8,
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: '80px 32px',
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="section-eyebrow">Join CULT</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, marginBottom: 32 }}>
          Ready to build your circle?
        </h2>
        <Link to="/dashboard" className="btn btn-primary btn-lg">
          Register as Creator
        </Link>
      </section>
    </div>
  )
}
