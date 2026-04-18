import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'

import {
  getFollowing,
  getRecentCommentActivityForFan,
  getUserProfile,
  getCreatorProfile,
  type CommentActivityItem,
  type CreatorProfile,
  type UserProfile,
} from '../lib/aptos'

type FanProfileWithBanner = UserProfile & { banner_shelby_cid?: string }
import { resolveContentUrl } from '../lib/shelby'
import UserProfileModal from '../components/UserProfileModal'

export default function FanProfile() {
  const { address } = useParams<{ address: string }>()
  const { account } = useWallet()

  const normalizedAddress = (address || '').trim()
  const viewerAddress = String(account?.address || '')
  const isOwnProfile = !!viewerAddress && viewerAddress.toLowerCase() === normalizedAddress.toLowerCase()

  const [profile, setProfile] = useState<FanProfileWithBanner | null>(null)
  const [followingCount, setFollowingCount] = useState(0)
  const [supportedCreators, setSupportedCreators] = useState<CreatorProfile[]>([])
  const [recentComments, setRecentComments] = useState<CommentActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!normalizedAddress) {
      setLoading(false)
      return
    }
    void loadProfile()
  }, [normalizedAddress])

  async function loadProfile() {
    setLoading(true)
    try {
      const [profileData, following, comments] = await Promise.all([
        getUserProfile(normalizedAddress),
        getFollowing(normalizedAddress),
        getRecentCommentActivityForFan(normalizedAddress, 6),
      ])
      setProfile(profileData)
      setFollowingCount(following.length)
      setRecentComments(comments)

      const creatorProfiles = await Promise.all(
        following.slice(0, 6).map(async (creatorAddr) => getCreatorProfile(creatorAddr))
      )
      setSupportedCreators(creatorProfiles.filter((item): item is CreatorProfile => !!item))
    } catch (e) {
      console.error(e)
      setProfile(null)
      setFollowingCount(0)
      setSupportedCreators([])
      setRecentComments([])
    } finally {
      setLoading(false)
    }
  }

  const avatarUrl = profile?.avatar_shelby_cid ? resolveContentUrl(profile.avatar_shelby_cid) : ''
  const bannerUrl = profile?.banner_shelby_cid ? resolveContentUrl(profile.banner_shelby_cid) : ''
  const shortAddr = normalizedAddress
    ? `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}`
    : ''

  if (loading) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px clamp(16px, 4vw, 32px)' }}>
        <div className="skeleton" style={{ height: 220, width: '100%', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 88, height: 88, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 220, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: 180 }} />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '72px 16px', textAlign: 'center' }}>
        <div className="section-eyebrow">Fan</div>
        <h2 style={{ marginBottom: 10 }}>Profile not found</h2>
        <p style={{ margin: '0 auto 18px' }}>This fan has not created a CULT profile yet.</p>
        {isOwnProfile && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            Create your profile
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 28px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(20,18,17,0.96) 0%, rgba(13,12,11,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}>
          <div style={{ height: 220, position: 'relative', background: bannerUrl ? `linear-gradient(180deg, rgba(5,5,5,0.12), rgba(5,5,5,0.44)), url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(254,119,201,0.16) 0%, rgba(254,119,201,0.05) 35%, rgba(255,255,255,0.03) 100%)' }}>
            <div style={{ position: 'absolute', inset: 0, background: bannerUrl ? 'linear-gradient(180deg, rgba(8,8,7,0.08) 0%, rgba(8,8,7,0.52) 100%)' : 'radial-gradient(circle at 20% 24%, rgba(254,119,201,0.16), transparent 34%), radial-gradient(circle at 78% 28%, rgba(254,119,201,0.08), transparent 28%)' }} />
          </div>

          <div style={{ padding: '0 clamp(18px, 4vw, 32px) 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -44, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid var(--bg)', background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '1.8rem', overflow: 'hidden' }}>
                  {!avatarUrl && (profile.display_name.charAt(0).toUpperCase() || '◌')}
                </div>
                <div style={{ paddingTop: 18 }}>
                  <div className="section-eyebrow">Fan</div>
                  <h2 style={{ marginBottom: 4 }}>{profile.display_name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {profile.handle && <span className="badge mono" style={{ fontSize: 10 }}>@{profile.handle}</span>}
                    <span className="badge mono" style={{ fontSize: 10 }}>{shortAddr}</span>
                    {isOwnProfile && <span className="badge badge-accent">You</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {isOwnProfile && (
                  <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>
                    Edit profile
                  </button>
                )}
                <Link className="btn btn-sm" to="/explore">Explore creators</Link>
              </div>
            </div>

            {profile.bio && (
              <p style={{ maxWidth: 620, marginBottom: 20, color: 'var(--text-2)', lineHeight: 1.7 }}>{profile.bio}</p>
            )}

            {!bannerUrl && (
              <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--text-3)' }}>
                Fan banner is supported when present in profile data.
              </div>
            )}

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1 }}>{followingCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Following</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1 }}>{new Date(profile.created_at * 1000).getFullYear()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Joined</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, marginTop: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="card"
          >
            <div style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
              <div className="section-eyebrow">Supporting</div>
              <h3 style={{ marginBottom: 14 }}>Creators in their circle</h3>
              {supportedCreators.length === 0 ? (
                <p>No followed creators yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {supportedCreators.map((creator) => {
                    const creatorAvatar = creator.avatar_shelby_cid ? resolveContentUrl(creator.avatar_shelby_cid) : ''
                    return (
                      <Link key={creator.creator_addr} to={`/u/${creator.handle}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {!creatorAvatar && '✦'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{creator.display_name}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>@{creator.handle}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="card"
          >
            <div style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
              <div className="section-eyebrow">Recent comments</div>
              <h3 style={{ marginBottom: 14 }}>What they’ve been saying</h3>
              {recentComments.length === 0 ? (
                <p>No recent comment activity yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentComments.map((item) => {
                    const creatorAvatar = item.creatorAvatarCid ? resolveContentUrl(item.creatorAvatarCid) : ''
                    return (
                      <Link key={item.id} to={`/u/${item.creatorHandle}`} style={{ display: 'block', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0 }}>
                            {!creatorAvatar && '✦'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{item.creatorName}</div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{item.contentTitle}</div>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
                          “{item.text.length > 120 ? `${item.text.slice(0, 120)}…` : item.text}”
                        </p>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          {new Date(item.postedAt * 1000).toLocaleString()}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {editing && (
        <UserProfileModal
          profile={profile}
          onSuccess={() => void loadProfile()}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
