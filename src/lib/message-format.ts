// Message formatting utilities for Colony
// Provides markdown parsing, link detection, and message rendering

// URL regex pattern for detecting links
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

// Email regex pattern
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

// Basic markdown patterns
const MARKDOWN_PATTERNS = {
  // Bold: **text** or __text__
  bold: /\*\*([^*]+)\*\*|__([^_]+)__/g,
  // Italic: *text* or _text_
  italic: /(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g,
  // Strikethrough: ~~text~~
  strikethrough: /~~([^~]+)~~/g,
  // Inline code: `code`
  inlineCode: /`([^`]+)`/g,
  // Code block: ```code```
  codeBlock: /```([\s\S]*?)```/g,
};

/**
 * Parse URLs in text and return matches
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Parse emails in text and return matches
 */
export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Convert URLs to clickable links (HTML)
 * Returns sanitized HTML string
 */
export function linkify(text: string): string {
  if (!text) {return '';}
  
  // Escape HTML first to prevent XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert URLs to links
  escaped = escaped.replace(
    URL_REGEX,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>'
  );
  
  // Convert emails to mailto links
  escaped = escaped.replace(
    EMAIL_REGEX,
    '<a href="mailto:$1" class="message-link">$1</a>'
  );
  
  return escaped;
}

/**
 * Parse markdown formatting
 * Returns HTML string with basic markdown converted
 */
export function parseMarkdown(text: string): string {
  if (!text) {return '';}
  
  let result = text;
  
  // Escape HTML first (but preserve existing links)
  // We'll handle this carefully to not break links
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Code blocks (must be first to not interfere with inline code)
  result = result.replace(
    MARKDOWN_PATTERNS.codeBlock,
    '<pre class="message-code-block"><code>$1</code></pre>'
  );
  
  // Inline code
  result = result.replace(
    MARKDOWN_PATTERNS.inlineCode,
    '<code class="message-inline-code">$1</code>'
  );
  
  // Bold
  result = result.replace(
    MARKDOWN_PATTERNS.bold,
    '<strong>$1$2</strong>'
  );
  
  // Italic
  result = result.replace(
    MARKDOWN_PATTERNS.italic,
    '<em>$1$2</em>'
  );
  
  // Strikethrough
  result = result.replace(
    MARKDOWN_PATTERNS.strikethrough,
    '<del>$1</del>'
  );
  
  // Convert URLs to links (after markdown parsing to preserve them)
  result = result.replace(
    URL_REGEX,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>'
  );
  
  // Convert emails
  result = result.replace(
    EMAIL_REGEX,
    '<a href="mailto:$1" class="message-link">$1</a>'
  );
  
  // Convert newlines to <br>
  result = result.replace(/\n/g, '<br>');
  
  return result;
}

/**
 * Full message formatting: markdown + links
 * This is the main function to use for rendering messages
 */
export function formatMessage(text: string, enableMarkdown: boolean = true): string {
  if (!text) {return '';}
  
  if (enableMarkdown) {
    return parseMarkdown(text);
  }
  
  // Just linkify if markdown is disabled
  return linkify(text);
}

/**
 * Strip all formatting and return plain text
 */
export function stripFormatting(text: string): string {
  if (!text) {return '';}
  
  let result = text;
  
  // Remove code blocks
  result = result.replace(MARKDOWN_PATTERNS.codeBlock, '$1');
  
  // Remove inline code
  result = result.replace(MARKDOWN_PATTERNS.inlineCode, '$1');
  
  // Remove bold
  result = result.replace(MARKDOWN_PATTERNS.bold, '$1$2');
  
  // Remove italic
  result = result.replace(MARKDOWN_PATTERNS.italic, '$1$2');
  
  // Remove strikethrough
  result = result.replace(MARKDOWN_PATTERNS.strikethrough, '$1');
  
  // Remove links but keep text
  result = result.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  result = result
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  return result.trim();
}

/**
 * Validate that formatted message doesn't exceed length limits
 * Returns true if valid, false if too long
 */
export function validateFormattedMessage(text: string, maxLength: number = 10000): boolean {
  const plainText = stripFormatting(text);
  return plainText.length <= maxLength;
}
