/**
 * scrub.js
 * 
 * Scrub markdown and formatting artifacts from LLM-generated text.
 * Applied as Node 10 (Scrub Format) in both workflow variants.
 * 
 * Transforms applied in order:
 * 1. Remove triple backtick blocks, keeping inner text.
 * 2. Remove single backtick markers.
 * 3. Remove leading hash line markers.
 * 4. Remove bold and italic markers.
 * 5. Remove list markers.
 * 6. Remove emoji ranges.
 * 7. Replace smart quotes with ASCII.
 * 8. Replace en and em dashes with ASCII hyphen.
 * 9. Remove zero-width characters.
 * 10. Collapse three or more newlines to two.
 * 11. Trim.
 */

function scrub(text) {
  if (typeof text !== 'string') return '';

  // 1. Remove triple backtick blocks, keeping inner text
  text = text.replace(/```[\s\S]*?```/g, function(match) {
    return match.replace(/^```(?:\w*)?\n?/, '').replace(/\n?```$/, '');
  });

  // 2. Remove single backtick markers
  text = text.replace(/`/g, '');

  // 3. Remove leading hash line markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 4. Remove bold and italic markers
  text = text.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}(.*?)_{1,3}/g, '$1');

  // 5. Remove list markers (unordered and ordered)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // 6. Remove emoji ranges
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');

  // 7. Replace smart quotes with ASCII
  text = text.replace(/[\u2018\u2019]/g, "'");
  text = text.replace(/[\u201C\u201D]/g, '"');

  // 8. Replace en and em dashes with ASCII hyphen
  text = text.replace(/[\u2013\u2014]/g, '-');

  // 9. Remove zero-width characters
  text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // 10. Collapse three or more newlines to two
  text = text.replace(/\n{3,}/g, '\n\n');

  // 11. Trim
  text = text.trim();

  return text;
}

// Export for both Node.js and n8n code node usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrub };
}
