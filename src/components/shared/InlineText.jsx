import React, { useRef, useState } from 'react'

/**
 * InlineText — click the text to edit it in place. The text becomes an input;
 * Enter or clicking away saves, Escape cancels. No edit button.
 * `className` is applied to both the display span and the editing input so they
 * look identical.
 */
export default function InlineText({ value, onChange, className = '', placeholder = '…', multiline = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelled = useRef(false)

  const start = () => {
    setDraft(value || '')
    cancelled.current = false
    setEditing(true)
  }

  const finish = () => {
    setEditing(false)
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (draft !== (value || '')) onChange(draft)
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      cancelled.current = true
      e.currentTarget.blur()
    } else if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  if (editing) {
    const props = {
      autoFocus: true,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: finish,
      onKeyDown: onKey,
      className,
    }
    return multiline ? <textarea {...props} /> : <input {...props} />
  }

  return (
    <span onClick={start} className={`cursor-text ${className}`}>
      {value ? value : <span className="text-stone-300">{placeholder}</span>}
    </span>
  )
}
