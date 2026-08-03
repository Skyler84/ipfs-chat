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
  }

  return (
    <form className={`chatInputComposer${hasExtras ? ' hasExtras' : ''}`} onSubmit={handleSubmit}>
      {hasExtras && <div className='chatInputExtras'>{children}</div>}
      <input
        id={inputId}
        className='chatInputField'
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        type='text'
        placeholder={placeholder}
        disabled={disabled}
      />
      <button id={sendButtonId} className='chatInputSendButton' type='submit' disabled={disabled}>Send</button>
    </form>
  )
}

export default ChatInput
