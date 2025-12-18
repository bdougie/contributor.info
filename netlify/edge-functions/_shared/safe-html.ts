/**
 * Safe HTML template tag for Edge SSR
 *
 * Provides automatic escaping of interpolated values to prevent XSS.
 * Returns a SafeHTML object that can be composed safely.
 */

/**
 * Class representing HTML content that has been sanitized or is trusted.
 */
export class SafeHTML {
  constructor(public content: string) {}

  toString() {
    return this.content;
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tagged template literal for safe HTML generation.
 * Automatically escapes all values unless they are instances of SafeHTML.
 * Arrays are joined and their elements processed recursively.
 */
export function html(strings: TemplateStringsArray, ...values: any[]): SafeHTML {
  let result = strings[0];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (value instanceof SafeHTML) {
      result += value.content;
    } else if (Array.isArray(value)) {
      result += value.map(v => {
        if (v instanceof SafeHTML) {
          return v.content;
        }
        return escapeHtml(String(v ?? ''));
      }).join('');
    } else {
      // Handle null/undefined as empty string
      result += escapeHtml(String(value ?? ''));
    }

    result += strings[i + 1];
  }

  return new SafeHTML(result);
}

/**
 * Mark a string as safe raw HTML (bypass escaping)
 */
export function unsafe(content: string): SafeHTML {
  return new SafeHTML(content);
}
