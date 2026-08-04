import React from 'react'
import './ChatInput.css'

const ChatInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'message',
  disabled = false,
  inputId = 'chatMessageInput',
  sendButtonId = 'chatSendButton',
  children
}) => {
  const hasExtras = children != null

  const handleSubmit = (event) => {
    event.preventDefault()

    if (disabled) {
      return
    }

    onSubmit?.()
    
    // Clear textarea and restore size
    const textArea = document.getElementById(inputId)
    if (textArea) {
      textArea.style.height = 'auto'
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const form = event.target.form
      if (form) {
        form.requestSubmit()
      }
    }
  }

  const growTextArea = (event) => {
    const textArea = event.target
    textArea.style.height = 'auto'
    textArea.style.height = `${textArea.scrollHeight}px`
  }

  return (
    <form className={`chatInputComposer${hasExtras ? ' hasExtras' : ''}`} onSubmit={handleSubmit}>
      {hasExtras && <div className='chatInputExtras'>{children}</div>}
      <textarea
        id={inputId}
        className='chatInputField'
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
        onInput={growTextArea}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          resize: 'none',
          maxHeight: '2000px',
          overflowY: 'auto',
          flex: '1',
          fieldSizing: 'content'
        }}
      />
      <button id={sendButtonId} className='chatInputSendButton' type='submit' disabled={disabled}>Send</button>
    </form>
  )
}

export default ChatInput
