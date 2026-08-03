import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import './ChatRoom.css'

const BOTTOM_SNAP_THRESHOLD_PX = 24

const isNearBottom = (element) => {
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  return distanceFromBottom <= BOTTOM_SNAP_THRESHOLD_PX
}

const ChatRoom = ({
  messages,
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
  inputPlaceholder = 'message',
  inputExtras
}) => {
  const listRef = useRef(null)
  const shouldStickToBottomRef = useRef(true)

  useEffect(() => {
    const listElement = listRef.current

    if (listElement == null) {
      return
    }

    if (shouldStickToBottomRef.current) {
      listElement.scrollTop = listElement.scrollHeight
    }
  }, [messages])

  const handleScroll = () => {
    const listElement = listRef.current

    if (listElement == null) {
      return
    }

    shouldStickToBottomRef.current = isNearBottom(listElement)
  }

  return (
    <section className='chatRoom'>
      <div id='chatMessages' className='chatRoomMessages' ref={listRef} onScroll={handleScroll}>
        {messages.map((message) => {
          const rowClasses = [
            'chatRoomRow',
            message.system ? 'isSystem' : '',
            message.self ? 'isSelf' : 'isPeer'
          ].filter(Boolean).join(' ')

          return (
            <div className={rowClasses} key={message.id}>
              <ChatMessage
                sender={message.from}
                content={message.text}
                timestamp={message.timestamp}
              />
            </div>
          )
        })}
      </div>

      <ChatInput
        value={messageDraft}
        onChange={onMessageDraftChange}
        onSubmit={onSendMessage}
        placeholder={inputPlaceholder}
      >
        {inputExtras}
      </ChatInput>
    </section>
  )
}

export default ChatRoom
