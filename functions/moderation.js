/* eslint-disable */
'use strict';

/**
 * Moderation utilities focused on hate / incitement / self-harm encouragement.
 * Intentionally narrow for precision. Profanity alone is NOT blocked.
 *
 * Design:
 *  - RULES array with id, category, action, severity, test(content, normalizedLower)
 *  - Normalization collapses whitespace and leet-style obvious substitutions.
 *  - Exported API remains: checkContent(content) -> { allowed, reasons }
 */

// Simple leetspeak map for normalization (low risk; keep minimal to avoid mangling normal text)
const LEET_MAP = Object.entries({
  '@': 'a',
  0: 'o',
  1: 'l',
  '!': 'i',
  3: 'e',
  $: 's',
  5: 's',
  7: 't',
});

function normalize(str) {
  if (!str) return '';
  let out = String(str).replace(/\s+/g, ' ').trim();
  // Basic leet replacement
  for (const [from, to] of LEET_MAP) {
    out = out.replace(new RegExp(from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), to);
  }
  return out;
}

// Helper predicate builders
const includes = (needle) => (c, lower) => lower.includes(needle);
const regex = (re) => (c) => re.test(c);

// Protected group tokens set (kept lean; do not include broad everyday words)
const GROUP_TOKENS = [
  'immigrants',
  'women',
  'men',
  'jews',
  'muslims',
  'people', // used in generic mass-harm constructions; place last to avoid over-triggering
];

// Build dynamic incitement patterns like: verb + all/every/those + group token
const HARM_VERBS = ['kill', 'hurt', 'attack', 'destroy'];
const QUANTIFIERS = ['all', 'every', 'those'];
const INCITE_REGEX = new RegExp(
  `\\b(${HARM_VERBS.join('|')})\\s+(${QUANTIFIERS.join('|')})\\s+(${GROUP_TOKENS.join('|')})\\b`,
  'i',
);

// Rule set
const RULES = [
  {
    id: 'SELF_HARM_DIRECT_1',
    category: 'self_harm',
    severity: 10,
    action: 'block',
    test: regex(/\b(kill)\b.{0,20}\b(yourself|urself|ur self)\b/i),
  },
  {
    id: 'SELF_HARM_SHORT_KYS',
    category: 'self_harm',
    severity: 9,
    action: 'block',
    test: includes('kys'),
  },
  {
    id: 'INCITE_GROUP_HARM_DYNAMIC',
    category: 'incitement',
    severity: 10,
    action: 'block',
    test: regex(INCITE_REGEX),
  },
  {
    id: 'GENOCIDE_GAS_THE',
    category: 'incitement',
    severity: 10,
    action: 'block',
    test: includes('gas the'),
  },
  {
    id: 'GENOCIDE_ELIMINATE_THEM',
    category: 'incitement',
    severity: 10,
    action: 'block',
    test: regex(/\b(wipe|erase|eliminate)\s+them\b/i),
  },
  {
    id: 'EXTREMISM_REFERENCE_NAZI',
    category: 'extremism',
    severity: 5,
    action: 'block',
    // Block direct usage; adjust later if you need contextual allowance (e.g., historical discussion)
    test: includes('nazi'),
  },
];

/**
 * Public API – backward compatible shape.
 * @param {string} content
 * @returns {{allowed: boolean, reasons: string[], matches?: Array<{id:string, category:string, action:string, severity:number}>}}
 */
function checkContent(content) {
  if (!content || typeof content !== 'string') return { allowed: true, reasons: [] };
  const normalized = normalize(content);
  const lower = normalized.toLowerCase();
  const matches = [];
  for (const rule of RULES) {
    try {
      if (rule.test(normalized, lower)) {
        matches.push({
          id: rule.id,
          category: rule.category,
          action: rule.action,
          severity: rule.severity,
        });
      }
    } catch (err) {
      // Fail open for a single rule error (log only if needed later)
    }
  }
  if (!matches.length) return { allowed: true, reasons: [] };
  return {
    allowed: false,
    reasons: matches.map((m) => `${m.id}:${m.action}`),
    matches,
  };
}

module.exports = { checkContent, _RULES: RULES, _normalize: normalize };
