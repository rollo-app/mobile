/** The server's limit for one comment (after trimming). */
export const COMMENT_MAX_LENGTH = 500;

/** What gets sent: the draft without surrounding blanks. */
export const cleanDraft = (draft: string): string => draft.trim();

/** Whether the draft is worth sending: something written, within the limit. */
export function canSend(draft: string): boolean {
  const text = cleanDraft(draft);
  return text.length > 0 && text.length <= COMMENT_MAX_LENGTH;
}
