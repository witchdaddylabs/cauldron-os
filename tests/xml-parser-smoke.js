/**
 * xml-parser-smoke.js — Direct unit tests for lib/xml-parser.js
 *
 * Tests depth-aware raw-param parsing (nested HTML, repeated same-name tags)
 * and simple non-raw param extraction. No server needed — calls the module
 * directly.
 */
const assert = require('assert/strict');
const { findNextAction } = require('../lib/xml-parser');

// — 1. Single content with nested HTML —
{
  const xml = '<action name="write_file"><path>a.html</path><content><div><span>hi</span></div></content></action>';
  const result = findNextAction(xml);
  assert(result !== null && result !== 'incomplete', 'test 1: should parse successfully');
  assert.equal(result.args.path, 'a.html', 'test 1: path should be a.html');
  assert.equal(result.args.content, '<div><span>hi</span></div>', 'test 1: content should include nested HTML');
  console.log('  ✓ nested HTML content preserved');
}

// — 2. Flat repeated raw tag (the bug: two <content> blocks) —
{
  const xml = '<action name="edit_file"><path>x.js</path><old_string>foo</old_string><new_string>bar</new_string><content>A</content><something/><content>B</content></action>';
  const result = findNextAction(xml);
  assert(result !== null && result !== 'incomplete', 'test 2: should parse successfully');
  assert.equal(result.args.content, 'A', 'test 2: content should be "A" (first block only)');
  assert(!result.args.content.includes('B'), 'test 2: content should not contain second block');
  console.log('  ✓ repeated same-name raw tag: only first block extracted');
}

// — 3. Simple non-raw param —
{
  const xml = '<action name="read_file"><path>only/this</path></action>';
  const result = findNextAction(xml);
  assert(result !== null && result !== 'incomplete', 'test 3: should parse successfully');
  assert.equal(result.args.path, 'only/this', 'test 3: path should be "only/this"');
  console.log('  ✓ simple non-raw param extracted correctly');
}

console.log('\nXML parser smoke tests passed ✓');
process.exit(0);
