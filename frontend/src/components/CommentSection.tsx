import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  buildDeleteCommentPayload,
  buildInitGlobalCommentStorePayload,
  buildPostCommentPayload,
  getCommentsForContent,
  hasGlobalCommentStore,
  type CommentItem,
} from '../lib/aptos'
import { ACCESS_LEVELS } from '../lib/constants'

interface Props {
  creatorAddr: string
  contentId: number
  accessLevel: number
  hasAccess: boolean
}

export default function CommentSection({ creatorAddr, contentId, accessLevel, hasAccess }: Props) {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const [comments, setComments] = useState<CommentItem[]>([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open] = useState(true)
  const [loadingComments, setLoadingComments] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canComment = connected && (accessLevel === ACCESS_LEVELS.FREE || hasAccess)
  const MAX_CHARS = 500

  // load shared comments for this content
  useEffect(() => {
    if (!open) return
    if (accessLevel !== ACCESS_LEVELS.FREE && !hasAccess) {
      setComments([])
      return
    }

    setLoadingComments(true)
    getCommentsForContent(creatorAddr, contentId)
      .then((data) => setComments(data))
      .finally(() => setLoadingComments(false))
  }, [open, creatorAddr, contentId, accessLevel, hasAccess])

  async function handleDeleteComment(commentId: number) {
    if (!connected || !account?.address) return

    const previous = comments
    setComments((prev) => prev.filter((c) => c.id !== commentId))

    try {
      const payload = buildDeleteCommentPayload(creatorAddr, contentId, commentId)
      await signAndSubmitTransaction({ data: payload })
      toast.success('Comment deleted')
    } catch (e) {
      setComments(previous)
      toast.error('Failed to delete comment')
      console.error(e)
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return
    if (!connected || !account?.address) {
      toast.error('Connect your wallet first')
      return
    }
    if (accessLevel !== ACCESS_LEVELS.FREE && !hasAccess) {
      toast.error('Subscribe or purchase this content to comment')
      return
    }
    if (text.length > MAX_CHARS) {
      toast.error(`Comment must be ${MAX_CHARS} characters or less`)
      return
    }

    setSubmitting(true)

    // optimistic insert
    const optimistic: CommentItem = {
      id: Date.now(),
      fanAddr: String(account.address),
      contentId,
      text: text.trim(),
      postedAt: Math.floor(Date.now() / 1000),
    }
    setComments((prev) => [...prev, optimistic])
    const savedText = text.trim()
    setText('')

    try {
      if (String(account.address) === creatorAddr) {
        const hasStore = await hasGlobalCommentStore(creatorAddr)
        if (!hasStore) {
          const initPayload = buildInitGlobalCommentStorePayload()
          await signAndSubmitTransaction({ data: initPayload })
        }
      }

      const payload = buildPostCommentPayload(creatorAddr, contentId, savedText)
      await signAndSubmitTransaction({ data: payload })
      toast.success('Comment posted')
      // refresh shared thread from chain
      const fresh = await getCommentsForContent(creatorAddr, contentId)
      setComments(fresh)
    } catch (e: unknown) {
      // revert optimistic
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      setText(savedText)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('rejected') || msg.includes('cancel')) {
        // silent
      } else if (msg.includes('NO_ACCESS') || msg.includes('21')) {
        toast.error('You need access to comment on this content')
      } else if (msg.includes('TOO_LONG') || msg.includes('22')) {
        toast.error('Comment is too long (max 500 chars)')
      } else if (msg.includes('E_NOT_INITIALIZED') || msg.includes('1')) {
        toast.error('Comment store is not initialized for this creator yet')
      } else {
        toast.error('Failed to post comment')
        console.error(e)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Comments
          </span>
          {comments.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>
              {comments.length}
            </span>
          )}
        </div>

        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div>

              {/* Comment input */}
              {canComment ? (
                <div style={{ marginBottom: 16 }}>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment… (Ctrl+Enter to post)"
                    maxLength={MAX_CHARS}
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                      padding: '8px 10px',
                      resize: 'vertical',
                      outline: 'none',
                      lineHeight: 1.5,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: text.length > MAX_CHARS * 0.9 ? 'var(--red)' : 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {text.length}/{MAX_CHARS}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSubmit}
                      disabled={submitting || !text.trim() || text.length > MAX_CHARS}
                    >
                      {submitting ? '…' : 'Post'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px', marginBottom: 12,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-3)',
                }}>
                  {!connected
                    ? 'Connect wallet to comment'
                    : 'Subscribe or purchase to comment'}
                </div>
              )}

              {!canComment && accessLevel === ACCESS_LEVELS.FREE && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                  Comments are visible to everyone on free content.
                </div>
              )}

              {/* Comment list */}
              {loadingComments ? (
                <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '8px 0' }}>Loading…</div>
              ) : comments.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '8px 0', fontFamily: 'var(--font-mono)' }}>
                  No comments yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-3)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: c.fanAddr === String(account?.address) ? 'var(--accent)' : 'var(--text-3)',
                        }}>
                          {c.fanAddr === String(account?.address) ? 'You' : shortAddr(c.fanAddr)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                            {new Date(c.postedAt * 1000).toLocaleDateString()}
                          </span>
                          {c.fanAddr === String(account?.address) && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => void handleDeleteComment(c.id)}
                              style={{ fontSize: 10, padding: '2px 6px', color: '#ff8a8a' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {c.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
