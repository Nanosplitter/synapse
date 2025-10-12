/**
 * Utility helper functions
 */

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML string
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Shows a temporary message to the user
 * @param {string} text - Message text
 * @param {string} type - Message type (success, error, info)
 * @param {number} duration - Duration in milliseconds (default: 2000)
 */
export function showMessage(text, type, duration = 2000) {
  const messageDiv = document.getElementById("message");
  if (messageDiv) {
    messageDiv.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
    setTimeout(() => {
      messageDiv.innerHTML = "";
    }, duration);
  }
}

/**
 * Waits for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} - Resolves after the specified duration
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
