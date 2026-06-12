/**
 * xml-parser.js — XML Action Parser
 *
 * Extracts <action name="..."> blocks from raw model output text.
 * Handles nested HTML inside <content> and <command> tags using
 * lastIndexOf for the closing tag to survive embedded markup.
 *
 * Private Cauldron — XML Tool Agent System
 * Witch Daddy Labs
 */

/**
 * Find the next <action> block in text starting from fromIndex.
 *
 * @param {string} text - The raw model output to search in
 * @param {number} [fromIndex=0] - Character offset to start searching from
 * @returns {object|string|null}
 *   - { name, args: { path, content, command, ... }, raw, start, end }
 *     when a complete action is found
 *   - 'incomplete' when an action block has started (<action...>) but
 *     the closing </action> tag hasn't been found yet
 *   - null when no <action> tag is found at all
 */
function findNextAction(text, fromIndex = 0) {
  if (typeof text !== 'string' || fromIndex >= text.length) {
    return null;
  }

  // Find opening <action tag — case-insensitive via regex
  const actionOpenRe = /<action\s+name\s*=\s*"([^"]*)"\s*>/i;
  const openMatch = text.slice(fromIndex).match(actionOpenRe);

  if (!openMatch) {
    return null;
  }

  const start = fromIndex + openMatch.index;
  const name = openMatch[1].trim() || '';

  // Find the closing </action> tag — case-insensitive
  const closeTag = '</action>';
  const searchFrom = start + openMatch[0].length;
  const endIndex = text.toLowerCase().indexOf(closeTag.toLowerCase(), searchFrom);

  if (endIndex === -1) {
    return 'incomplete';
  }

  const raw = text.slice(start, endIndex + closeTag.length);
  const innerText = text.slice(searchFrom, endIndex);

  // Parse parameters from inner content
  const args = _parseParams(innerText);

  return {
    name,
    args,
    raw,
    start,
    end: endIndex + closeTag.length,
  };
}

/**
 * Parse all XML-style parameter tags from inner text.
 * Handles: <path>, <content>, <command>, <old_string>, <new_string>,
 * <replace_all>, <timeout>, and any other custom params.
 *
 * <content> and <command> are treated as raw strings — we use
 * lastIndexOf for their closing tags to survive nested HTML.
 * All other params use simple regex extraction.
 *
 * Matching is case-insensitive — both <PATH> and <path> work.
 *
 * @param {string} innerText - The text between <action...> and </action>
 * @returns {object} - Key-value pairs of parameter names to values
 */
function _parseParams(innerText) {
  const args = {};

  // Define param-specific parsing strategies
  // 'raw' params use lastIndexOf for the closing tag (survives nested HTML)
  const rawStringParams = new Set(['content', 'command', 'new_string', 'old_string']);

  // Find all parameter tags using case-insensitive regex
  const paramTagRe = /<(\w+)>/gi;
  let match;

  // Collect all unique tag names present (normalized to lowercase)
  const tagNames = new Set();
  while ((match = paramTagRe.exec(innerText)) !== null) {
    tagNames.add(match[1].toLowerCase());
  }

  for (const tagName of tagNames) {
    const openTagRe = new RegExp(`<${escapeRegexForTag(tagName)}\\s*>`, 'i');
    const closeTagRe = new RegExp(`</${escapeRegexForTag(tagName)}\\s*>`, 'i');

    const openMatch = openTagRe.exec(innerText);
    if (!openMatch) continue;

    const valueStart = openMatch.index + openMatch[0].length;

    let closeMatch;
    if (rawStringParams.has(tagName)) {
      // For raw string params, find the matching closing tag by nesting depth
      // This way, nested HTML inside content/command won't break parsing,
      // and repeated same-name tags don't swallow content between them
      const openG = new RegExp(openTagRe.source, 'gi');
      const closeG = new RegExp(closeTagRe.source, 'gi');
      let depth = 1;
      let idx = valueStart;
      let resolvedClose = null;
      while (depth > 0) {
        openG.lastIndex = idx;
        closeG.lastIndex = idx;
        const nextOpen = openG.exec(innerText);
        const nextClose = closeG.exec(innerText);
        if (!nextClose) break;                 // unbalanced: no closing tag
        if (nextOpen && nextOpen.index < nextClose.index) {
          depth += 1;
          idx = nextOpen.index + nextOpen[0].length;
        } else {
          depth -= 1;
          idx = nextClose.index + nextClose[0].length;
          if (depth === 0) resolvedClose = nextClose;
        }
      }
      if (!resolvedClose) continue;
      closeMatch = resolvedClose;
    } else {
      // For simple params, find the FIRST occurrence after the open tag
      closeMatch = closeTagRe.exec(innerText.slice(valueStart));
      if (!closeMatch) continue;
      // Adjust index back to absolute position
      closeMatch = {
        index: valueStart + closeMatch.index,
        '0': closeMatch[0],
      };
    }

    if (closeMatch.index <= valueStart) continue;

    let value = innerText.slice(valueStart, closeMatch.index);

    // Trim whitespace from all parameter values
    value = value.trim();

    // Convert boolean-like strings
    if (value.toLowerCase() === 'true') value = true;
    else if (value.toLowerCase() === 'false') value = false;

    args[tagName] = value;
  }

  return args;
}

/**
 * Escape special regex characters for safe use in RegExp constructor,
 * but keep it minimal since tag names are alphanumeric.
 *
 * @param {string} tagName - XML tag name
 * @returns {string} - Escaped string safe for RegExp
 */
function escapeRegexForTag(tagName) {
  return tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { findNextAction };
