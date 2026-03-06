// Message Mentions Utilities
// Provides functions for parsing and handling @username mentions in messages

/**
 * Extract all @mentions from a message content
 * @param content - The message content to parse
 * @returns Array of mentioned usernames (without @ symbol)
 */
export function extractMentions(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Match @username patterns - allows alphanumeric, underscores, and hyphens
  // Username must be at least 1 character, max 50
  const mentionRegex = /@([a-zA-Z0-9_-]{1,50})/g;
  const matches = content.match(mentionRegex);
  
  if (!matches) {
    return [];
  }

  // Remove @ symbol and get unique mentions
  const mentions = matches.map(m => m.slice(1));
  return [...new Set(mentions)];
}

/**
 * Check if a message contains a specific mention
 * @param content - The message content to check
 * @param userName - The username to check for (without @)
 * @returns true if the user is mentioned
 */
export function hasMention(content: string, userName: string): boolean {
  const mentions = extractMentions(content);
  return mentions.some(m => m.toLowerCase() === userName.toLowerCase());
}

/**
 * Check if a message contains any mentions
 * @param content - The message content to check
 * @returns true if the message contains at least one mention
 */
export function hasAnyMention(content: string): boolean {
  return extractMentions(content).length > 0;
}

/**
 * Highlight mentions in message content for display
 * Returns content with <span class="mention">@username</span> wrapping mentions
 * @param content - The message content to process
 * @returns Content with mentions wrapped in span tags
 */
export function highlightMentions(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Replace @username with highlighted span
  return content.replace(
    /@([a-zA-Z0-9_-]{1,50})/g,
    '<span class="mention">@$1</span>'
  );
}

/**
 * Validate that mentions don't exceed reasonable limits
 * @param content - The message content to validate
 * @returns Validation result with error if invalid
 */
export function validateMentions(content: string): { valid: boolean; error?: string } {
  const mentions = extractMentions(content);
  
  // Max 10 mentions per message to prevent spam
  if (mentions.length > 10) {
    return { valid: false, error: 'Too many mentions (max 10)' };
  }
  
  return { valid: true };
}

/**
 * Get unique mentions from multiple messages
 * @param contents - Array of message contents
 * @returns Array of unique mentioned usernames
 */
export function getAllMentions(contents: string[]): string[] {
  const allMentions = contents.flatMap(c => extractMentions(c));
  return [...new Set(allMentions)];
}
