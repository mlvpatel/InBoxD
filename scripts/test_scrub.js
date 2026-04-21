/**
 * test_scrub.js
 * 
 * Tests for scrub.js transforms. At least one positive and one negative
 * test per transform, with 30+ assertions total.
 */

const { scrub } = require('./scrub.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error('FAIL: ' + message);
    console.error('  Expected: ' + JSON.stringify(expected));
    console.error('  Actual:   ' + JSON.stringify(actual));
  }
}

// --- Transform 1: Remove triple backtick blocks, keeping inner text ---
assertEqual(
  scrub('```\nhello world\n```'),
  'hello world',
  'T1 positive: triple backtick block content preserved'
);
assertEqual(
  scrub('```json\n{"key": "value"}\n```'),
  '{"key": "value"}',
  'T1 positive: triple backtick with language tag, content preserved'
);
assertEqual(
  scrub('no backticks here'),
  'no backticks here',
  'T1 negative: text without triple backticks unchanged'
);

// --- Transform 2: Remove single backtick markers ---
assertEqual(
  scrub('use the `command` here'),
  'use the command here',
  'T2 positive: single backticks removed'
);
assertEqual(
  scrub('no inline code'),
  'no inline code',
  'T2 negative: text without backticks unchanged'
);

// --- Transform 3: Remove leading hash line markers ---
assertEqual(
  scrub('# Heading'),
  'Heading',
  'T3 positive: h1 marker removed'
);
assertEqual(
  scrub('### Sub Heading'),
  'Sub Heading',
  'T3 positive: h3 marker removed'
);
assertEqual(
  scrub('No heading here'),
  'No heading here',
  'T3 negative: text without hash markers unchanged'
);
assertEqual(
  scrub('C# is a language'),
  'C# is a language',
  'T3 negative: hash inside text not removed'
);

// --- Transform 4: Remove bold and italic markers ---
assertEqual(
  scrub('this is **bold** text'),
  'this is bold text',
  'T4 positive: double asterisk bold removed'
);
assertEqual(
  scrub('this is *italic* text'),
  'this is italic text',
  'T4 positive: single asterisk italic removed'
);
assertEqual(
  scrub('this is ***bold italic*** text'),
  'this is bold italic text',
  'T4 positive: triple asterisk removed'
);
assertEqual(
  scrub('this is __bold__ text'),
  'this is bold text',
  'T4 positive: double underscore bold removed'
);
assertEqual(
  scrub('this is _italic_ text'),
  'this is italic text',
  'T4 positive: single underscore italic removed'
);
assertEqual(
  scrub('plain text here'),
  'plain text here',
  'T4 negative: text without markers unchanged'
);

// --- Transform 5: Remove list markers ---
assertEqual(
  scrub('- item one\n- item two'),
  'item one\nitem two',
  'T5 positive: hyphen list markers removed'
);
assertEqual(
  scrub('* item one\n* item two'),
  'item one\nitem two',
  'T5 positive: asterisk list markers removed'
);
assertEqual(
  scrub('+ item one'),
  'item one',
  'T5 positive: plus list marker removed'
);
assertEqual(
  scrub('1. first\n2. second'),
  'first\nsecond',
  'T5 positive: ordered list markers removed'
);
assertEqual(
  scrub('just a sentence'),
  'just a sentence',
  'T5 negative: text without list markers unchanged'
);

// --- Transform 6: Remove emoji ---
assertEqual(
  scrub('hello \u{1F600} world'),
  'hello  world',
  'T6 positive: grinning face emoji removed'
);
assertEqual(
  scrub('check \u2705'),
  'check',
  'T6 positive: check mark emoji in range removed'
);
assertEqual(
  scrub('plain text'),
  'plain text',
  'T6 negative: text without emoji unchanged'
);

// --- Transform 7: Replace smart quotes with ASCII ---
assertEqual(
  scrub('\u201CHello\u201D'),
  '"Hello"',
  'T7 positive: smart double quotes replaced'
);
assertEqual(
  scrub('\u2018Hello\u2019'),
  "'Hello'",
  'T7 positive: smart single quotes replaced'
);
assertEqual(
  scrub('"normal quotes"'),
  '"normal quotes"',
  'T7 negative: ASCII quotes unchanged'
);

// --- Transform 8: Replace en and em dashes ---
assertEqual(
  scrub('2020\u20132025'),
  '2020-2025',
  'T8 positive: en dash replaced'
);
assertEqual(
  scrub('word\u2014word'),
  'word-word',
  'T8 positive: em dash replaced'
);
assertEqual(
  scrub('word-word'),
  'word-word',
  'T8 negative: ASCII hyphen unchanged'
);

// --- Transform 9: Remove zero-width characters ---
assertEqual(
  scrub('hello\u200Bworld'),
  'helloworld',
  'T9 positive: zero-width space removed'
);
assertEqual(
  scrub('hello\uFEFFworld'),
  'helloworld',
  'T9 positive: BOM removed'
);
assertEqual(
  scrub('hello world'),
  'hello world',
  'T9 negative: text without zero-width chars unchanged'
);

// --- Transform 10: Collapse three or more newlines to two ---
assertEqual(
  scrub('line1\n\n\nline2'),
  'line1\n\nline2',
  'T10 positive: three newlines collapsed to two'
);
assertEqual(
  scrub('line1\n\n\n\n\nline2'),
  'line1\n\nline2',
  'T10 positive: five newlines collapsed to two'
);
assertEqual(
  scrub('line1\n\nline2'),
  'line1\n\nline2',
  'T10 negative: two newlines unchanged'
);

// --- Transform 11: Trim ---
assertEqual(
  scrub('  hello  '),
  'hello',
  'T11 positive: leading and trailing whitespace removed'
);
assertEqual(
  scrub('hello'),
  'hello',
  'T11 negative: text without extra whitespace unchanged'
);

// --- Edge cases ---
assertEqual(
  scrub(''),
  '',
  'Edge: empty string returns empty'
);
assertEqual(
  scrub(null),
  '',
  'Edge: null returns empty string'
);
assertEqual(
  scrub(undefined),
  '',
  'Edge: undefined returns empty string'
);

// --- Summary ---
console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
