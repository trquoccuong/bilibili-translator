// User pronunciation dictionary, one "written = spoken" per line. Case-sensitive so "AI" ≠ "ai".
// Each target language has its own (defaults in languages.js).

function parseLexicon(text) {
  return (text || '').split('\n')
    .map(l => l.split('='))
    .filter(p => p.length === 2 && p[0].trim() && p[1].trim())
    .map(([w, s]) => [w.trim(), s.trim()]);
}

// Whole-word replace: "AI" matches in "AI," but not inside "MAIL" or "ai".
function applyLexicon(text, lex) {
  for (const [w, s] of lex) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'gu'), s);
  }
  return text;
}
