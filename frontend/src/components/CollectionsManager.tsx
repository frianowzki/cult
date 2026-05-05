import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Content } from '../lib/aptos-types'

/* ─── Types ─── */

export interface Collection {
  id: string
  name: string
  description: string
  contentIds: number[]
  createdAt: number
}

/* ─── LocalStorage helpers ─── */

function storageKey(creatorAddr: string) {
  return `cult:collections:${creatorAddr}`
}

function loadCollections(creatorAddr: string): Collection[] {
  try {
    const raw = localStorage.getItem(storageKey(creatorAddr))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCollections(creatorAddr: string, collections: Collection[]) {
  localStorage.setItem(storageKey(creatorAddr), JSON.stringify(collections))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/* ─── Component ─── */

interface Props {
  creatorAddr: string
  contents: Content[]
}

export default function CollectionsManager({ creatorAddr, contents }: Props) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddContent, setShowAddContent] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')

  useEffect(() => {
    setCollections(loadCollections(creatorAddr))
  }, [creatorAddr])

  const persist = useCallback(
    (next: Collection[]) => {
      setCollections(next)
      saveCollections(creatorAddr, next)
    },
    [creatorAddr],
  )

  /* ─── CRUD ─── */

  function handleCreate() {
    if (!formName.trim()) {
      toast.error('Collection name is required')
      return
    }
    const col: Collection = {
      id: generateId(),
      name: formName.trim(),
      description: formDesc.trim(),
      contentIds: [],
      createdAt: Date.now(),
    }
    persist([...collections, col])
    setFormName('')
    setFormDesc('')
    setShowCreate(false)
    toast.success('Collection created')
  }

  function handleUpdate(id: string) {
    if (!formName.trim()) {
      toast.error('Collection name is required')
      return
    }
    persist(
      collections.map((c) =>
        c.id === id ? { ...c, name: formName.trim(), description: formDesc.trim() } : c,
      ),
    )
    setEditingId(null)
    setFormName('')
    setFormDesc('')
    toast.success('Collection updated')
  }

  function handleDelete(id: string) {
    persist(collections.filter((c) => c.id !== id))
    if (expandedId === id) setExpandedId(null)
    toast.success('Collection deleted')
  }

  function handleAddContent(colId: string, contentId: number) {
    persist(
      collections.map((c) =>
        c.id === colId
          ? { ...c, contentIds: c.contentIds.includes(contentId) ? c.contentIds : [...c.contentIds, contentId] }
          : c,
      ),
    )
  }

  function handleRemoveContent(colId: string, contentId: number) {
    persist(
      collections.map((c) =>
        c.id === colId ? { ...c, contentIds: c.contentIds.filter((id) => id !== contentId) } : c,
      ),
    )
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const next = [...collections]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    persist(next)
  }

  function handleMoveDown(index: number) {
    if (index >= collections.length - 1) return
    const next = [...collections]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    persist(next)
  }

  /* ─── Helpers ─── */

  function startEdit(col: Collection) {
    setEditingId(col.id)
    setFormName(col.name)
    setFormDesc(col.description)
    setShowCreate(false)
  }

  function cancelForm() {
    setEditingId(null)
    setShowCreate(false)
    setFormName('')
    setFormDesc('')
  }

  function getContentById(id: number): Content | undefined {
    return contents.find((c) => c.id === id)
  }

  /* ─── Render ─── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          className="section-eyebrow"
          style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-3)' }}
        >
          Collections
        </h3>
        {!showCreate && !editingId && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowCreate(true)
              setFormName('')
              setFormDesc('')
            }}
            style={{ fontSize: 12 }}
          >
            + New Collection
          </button>
        )}
      </div>

      {/* ── Create / Edit Form ── */}
      <AnimatePresence>
        {(showCreate || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="card"
              style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <input
                className="input"
                placeholder="Collection name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <textarea
                className="input"
                placeholder="Description (optional)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={cancelForm}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => (editingId ? handleUpdate(editingId) : handleCreate())}
                >
                  {editingId ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collections List ── */}
      {collections.length === 0 && !showCreate && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--text-3)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        >
          No collections yet. Create one to group your content.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {collections.map((col, idx) => {
          const isExpanded = expandedId === col.id
          const colContent = col.contentIds.map(getContentById).filter(Boolean) as Content[]

          return (
            <motion.div
              key={col.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="card"
              style={{ overflow: 'hidden' }}
            >
              {/* ── Collection Header ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                }}
                onClick={() => setExpandedId(isExpanded ? null : col.id)}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: 'var(--text-3)',
                    transition: 'transform 0.2s',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                >
                  ▸
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {col.name}
                  </div>
                  {col.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 2,
                      }}
                    >
                      {col.description}
                    </div>
                  )}
                </div>
                <span className="badge" style={{ fontSize: 11, flexShrink: 0 }}>
                  {col.contentIds.length} items
                </span>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveUp(idx)
                    }}
                    style={{ fontSize: 11, padding: '4px 6px', opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Move down"
                    disabled={idx === collections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveDown(idx)
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 6px',
                      opacity: idx === collections.length - 1 ? 0.3 : 1,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(col)
                    }}
                    style={{ fontSize: 11, padding: '4px 6px' }}
                  >
                    ✎
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(col.id)
                    }}
                    style={{ fontSize: 11, padding: '4px 6px', color: '#f44' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* ── Expanded Content ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Content items */}
                      {colContent.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {colContent.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                background: 'var(--bg-2)',
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                            >
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-3)', flexShrink: 0 }}>
                                {item.content_type === 0 ? '▶' : item.content_type === 1 ? '◉' : item.content_type === 2 ? '♪' : '✦'}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: 'var(--text-2)',
                                }}
                              >
                                {item.title}
                              </span>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleRemoveContent(col.id, item.id)}
                                style={{ fontSize: 10, padding: '2px 6px', color: '#f44' }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 0' }}>
                          No content added yet.
                        </div>
                      )}

                      {/* Add content button / checklist */}
                      {showAddContent === col.id ? (
                        <div
                          className="card"
                          style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                              Add content
                            </span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setShowAddContent(null)}
                              style={{ fontSize: 10, padding: '2px 6px' }}
                            >
                              Done
                            </button>
                          </div>
                          {contents.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No content available.</div>
                          ) : (
                            contents.map((item) => {
                              const isIncluded = col.contentIds.includes(item.id)
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color: isIncluded ? 'var(--accent)' : 'var(--text-2)',
                                    background: isIncluded ? 'var(--accent-glow)' : 'transparent',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isIncluded}
                                    onChange={() =>
                                      isIncluded ? handleRemoveContent(col.id, item.id) : handleAddContent(col.id, item.id)
                                    }
                                    style={{ accentColor: 'var(--accent)' }}
                                  />
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                                    {item.content_type === 0 ? '▶' : item.content_type === 1 ? '◉' : item.content_type === 2 ? '♪' : '✦'}
                                  </span>
                                  <span
                                    style={{
                                      flex: 1,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {item.title}
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowAddContent(col.id)}
                          style={{ fontSize: 12, alignSelf: 'flex-start' }}
                        >
                          + Add Content
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
