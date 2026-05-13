// Barrel exports for the AI Chat UI surface (WIREFRAMES §15).
//
// All components are client-only — they wrap Vercel AI SDK's `useChat`
// and manage localStorage-backed conversation history.

export { ChatShell } from './chat-shell'
export { MessageList } from './message-list'
export { MessageInput } from './message-input'
export { ConversationHistory } from './conversation-history'
export { CitationLink } from './citation-link'
export type {
  StoredConversation,
  StoredMessage,
} from './chat-shell'
