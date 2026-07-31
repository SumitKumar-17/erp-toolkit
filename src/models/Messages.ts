export type HighlighterCommand =
  | { action: 'highlighter:start' }
  | { action: 'highlighter:stop' }
  | { action: 'highlighter:clear' }
  | { action: 'highlighter:status' }

export interface HighlighterStatusResponse {
  success: boolean
  isActive: boolean
  processedRows: number
  message?: string
}

export const isHighlighterCommand = (message: unknown): message is HighlighterCommand => {
  if (typeof message !== 'object' || message === null || !('action' in message)) return false
  const { action } = message as { action: unknown }
  return (
    typeof action === 'string' &&
    (action === 'highlighter:start' ||
      action === 'highlighter:stop' ||
      action === 'highlighter:clear' ||
      action === 'highlighter:status')
  )
}
