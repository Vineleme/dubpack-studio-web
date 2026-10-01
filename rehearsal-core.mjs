export function normalizeSpeech(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
}

export function parseScript(pages) {
  const scenes = [];
  let scene, current, direction = '', depth = 0;
  const finish = () => {
    if (current?.text.trim()) scene.lines.push({ ...current, text: current.text.trim(), directions: current.directions.trim() });
    current = null;
  };
  for (const [pageIndex, page] of pages.entries()) {
    for (const raw of page.split(/\r?\n/)) {
      const line = raw.normalize('NFKC').trim();
      if (!line || /^\d+$/.test(line)) continue;
      if (/^CENA\s+\d+\b/i.test(line)) {
        finish();
        scene = { title: line, lines: [] };
        scenes.push(scene);
        direction = ''; depth = 0;
        continue;
      }
      // Front matter and cast credits are not spoken dialogue.
      if (!scene) continue;
      const speaker = depth === 0 && line.match(/^([A-ZÀ-Ý][A-Za-zÀ-ÿ .'’\-]{1,35}):\s*(.*)$/);
      if (speaker) {
        finish();
        const character = speaker[1].toLocaleUpperCase('pt-BR');
        current = { character, text: '', directions: direction, page: pageIndex + 1 };
        direction = '';
      }
      const content = speaker ? speaker[2] : line;
      let spoken = '', staging = '';
      for (const char of content) {
        if (char === '(') { depth++; continue; }
        if (char === ')' && depth > 0) { depth--; staging += ' '; continue; }
        if (depth > 0) staging += char;
        else spoken += char;
      }
      if (staging.trim()) {
        if (speaker) current.directions += ` ${staging.trim()}`;
        else direction += ` ${staging.trim()}`;
      }
      if (current && spoken.trim()) current.text += ` ${spoken.trim()}`;
    }
  }
  finish();
  return scenes.filter((item) => item.lines.length);
}

export function compareSpeech(expectedText, transcript) {
  const expected = normalizeSpeech(expectedText);
  const heard = normalizeSpeech(transcript).slice(-Math.max(40, expected.length * 4));
  if (!expected.length) return { coverage: 0, complete: false, matched: [] };
  // Ordered alignment tolerates a few recognition errors, without accepting keywords out of order.
  const grid = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1));
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= heard.length; j++) {
      grid[i][j] = expected[i - 1] === heard[j - 1]
        ? grid[i - 1][j - 1] + 1 : Math.max(grid[i - 1][j], grid[i][j - 1]);
    }
  }
  const matched = [];
  let i = expected.length, j = heard.length;
  while (i && j) {
    if (expected[i - 1] === heard[j - 1]) { matched.push(--i); j--; }
    else if (grid[i - 1][j] >= grid[i][j - 1]) i--;
    else j--;
  }
  const coverage = grid[expected.length][heard.length] / expected.length;
  const tailLength = Math.min(3, expected.length);
  const ending = expected.slice(-tailLength).join(' ');
  const hasEnding = heard.slice(-tailLength).join(' ') === ending;
  const threshold = expected.length <= 6 ? 1 : 0.9;
  const negationWords = new Set(['nao', 'nunca', 'jamais', 'nem']);
  const negationsMatched = expected.every((word, index) => !negationWords.has(word) || matched.includes(index));
  return { coverage, complete: coverage >= threshold && hasEnding && negationsMatched, matched: matched.reverse() };
}

export function textLinesFromItems(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map((row) =>
    row.items.sort((a, b) => a.transform[4] - b.transform[4]).map((item) => item.str).join(' ')
  ).join('\n');
}
