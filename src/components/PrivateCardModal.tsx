import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { JournalEntry, PrivateCard } from '../types'
import {
  buildPrivateCandidates,
  createPrivateCard,
  privateCardEligible,
  privateCardToTarotCard,
} from '../lib/private-card'
import { useFocusTrap } from '../lib/useFocusTrap'
import TarotCard from './TarotCard'

interface Props {
  open: boolean
  entries: JournalEntry[]
  privateCard: PrivateCard | null
  onClose: () => void
  onCreate: (card: PrivateCard) => void
  onDelete: () => void
  onQueue: () => void
}

export default function PrivateCardModal({
  open,
  entries,
  privateCard,
  onClose,
  onCreate,
  onDelete,
  onQueue,
}: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const [round, setRound] = useState(0)
  const candidates = useMemo(
    () => buildPrivateCandidates(entries, round),
    [entries, round],
  )
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? '')
  const [name, setName] = useState(candidates[0]?.name ?? '')
  const selected =
    candidates.find((image) => image.id === selectedId) ?? candidates[0]

  useEffect(() => {
    if (!open) return
    const node = modalRef.current
    if (node) node.scrollTop = 0
  }, [open, privateCard])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const setModalRef = useCallback(
    (node: HTMLDivElement | null) => {
      modalRef.current = node
      trapRef.current = node
    },
    [trapRef],
  )

  if (!open) return null

  const eligible = privateCardEligible(entries)
  const preview = selected
    ? privateCardToTarotCard(
        createPrivateCard(selected, name.trim() || selected.name, entries),
      )
    : null
  const createdCard = privateCard
    ? privateCardToTarotCard(privateCard)
    : null

  const choose = (id: string) => {
    const image = candidates.find((item) => item.id === id)
    if (!image) return
    setSelectedId(id)
    setName(image.name)
  }

  const nextRound = () => {
    const next = round + 1
    setRound(next)
    const image = buildPrivateCandidates(entries, next)[0]
    if (image) {
      setSelectedId(image.id)
      setName(image.name)
    }
  }

  const nameMismatch =
    Boolean(selected) &&
    Boolean(name.trim()) &&
    ![...new Set(selected?.name ?? '')].some((char) => name.includes(char))

  const create = () => {
    if (!selected || nameMismatch) return
    onCreate(createPrivateCard(selected, name.trim() || selected.name, entries))
  }

  return createPortal(
    <div className="modal-veil private-veil" role="presentation">
      <section
        className="modal private-card-modal ornate-corners"
        ref={setModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-card-title"
        tabIndex={-1}
      >
        <header className="modal-head private-card-head">
          <div>
            <span className="eyebrow">PRIVATE CARD · 第79张</span>
            <h2 id="private-card-title">
              {privateCard ? '你的第79张' : '让它从你的语言里长出来'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="关闭第79张"
          >
            ×
          </button>
        </header>

        {privateCard ? (
          <div className="private-view">
            <div className="private-preview">
              {createdCard && (
                <TarotCard card={createdCard} faceUp size="md" />
              )}
              <span className="private-preview-caption">
                {privateCard.pending
                  ? '下一次抽牌会先遇见它'
                  : '已经进入你的牌组'}
              </span>
            </div>
            <div className="private-view-copy">
              <p className="private-lead">
                {privateCard.prompt}
              </p>
              <div className="private-keywords">
                {privateCard.keywords.map((word) => (
                  <span key={word}>{word}</span>
                ))}
              </div>
              <p className="private-note">
                它来自你最近三次非危机记录，只保存在这台设备；使用时会作为你带来的图像进入解读，不是固定牌义。
              </p>
              <div className="private-actions">
                {!privateCard.pending && (
                  <button type="button" className="ghost-btn small" onClick={onQueue}>
                    让它再进一次牌堆
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-btn small private-delete"
                  onClick={() => {
                    if (window.confirm('删除这张私牌？它会从本机和之后的抽牌中消失。')) {
                      onDelete()
                    }
                  }}
                >
                  删除私牌
                </button>
              </div>
            </div>
          </div>
        ) : eligible ? (
          <>
            <p className="private-lead">
              三次照见之后，牌组可以多一张只属于你的牌。它不来自塔罗牌义，而来自你写下的意象；只在这台设备上保存。
            </p>
            <div className="private-creator">
              <div className="private-choice-column">
                <span className="field-label">选一个意象</span>
                <div className="private-choices" role="group" aria-label="私牌意象">
                  {candidates.map((image) => (
                    <button
                      type="button"
                      key={image.id}
                      className={`private-choice ${selectedId === image.id ? 'is-selected' : ''}`}
                      aria-pressed={selectedId === image.id}
                      onClick={() => choose(image.id)}
                    >
                      <span className="private-choice-symbol" aria-hidden="true">
                        {image.symbol}
                      </span>
                      <span className="private-choice-copy">
                        <strong>{image.name}</strong>
                        <em>{image.keywords.join(' · ')}</em>
                      </span>
                    </button>
                  ))}
                </div>
                <button type="button" className="inline-link private-shuffle" onClick={nextRound}>
                  换一组意象
                </button>
                <label className="private-name-field">
                  <span className="field-label">给它一个名字</span>
                  <input
                    value={name}
                    maxLength={10}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={selected?.name ?? '给这张牌一个名字'}
                    aria-label="给第79张命名"
                  />
                  <span className="field-hint">
                    最多 10 个字；至少保留意象里的一个字，符号和追问会保留。
                  </span>
                  {nameMismatch && (
                    <span className="field-hint private-name-warning" role="status">
                      名字需要和「{selected?.name}」有一处相连，才能不拆散这个意象。
                    </span>
                  )}
                </label>
              </div>
              <div className="private-preview">
                {preview && <TarotCard card={preview} faceUp size="md" />}
                <span className="private-preview-caption">预览 · 只属于你</span>
              </div>
            </div>
            <div className="private-actions">
              <button type="button" className="ghost-btn small" onClick={nextRound}>
                换一个
              </button>
              <button type="button" className="text-btn small" onClick={onClose}>
                暂时不要
              </button>
              <button
                type="button"
                className="primary-btn small"
                onClick={create}
                disabled={nameMismatch}
              >
                成为我的第79张
              </button>
            </div>
          </>
        ) : (
          <p className="private-lead">
            还需要三次非危机的照见，才能从你的语言里长出一张牌。先留几次记录，再回来。
          </p>
        )}
      </section>
    </div>,
    document.body,
  )
}
