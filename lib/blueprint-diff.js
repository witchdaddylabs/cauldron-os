function normaliseLines(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').split('\n');
}

function trimTrailingEmptyLine(lines) {
  if (lines.length > 1 && lines[lines.length - 1] === '') return lines.slice(0, -1);
  return lines;
}

function buildLineDiff(previous = '', next = '') {
  const before = trimTrailingEmptyLine(normaliseLines(previous));
  const after = trimTrailingEmptyLine(normaliseLines(next));
  const table = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows = [];
  let additions = 0;
  let deletions = 0;
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      rows.push({ type: 'context', marker: ' ', text: before[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ type: 'remove', marker: '-', text: before[i] });
      deletions += 1;
      i += 1;
    } else {
      rows.push({ type: 'add', marker: '+', text: after[j] });
      additions += 1;
      j += 1;
    }
  }

  while (i < before.length) {
    rows.push({ type: 'remove', marker: '-', text: before[i] });
    deletions += 1;
    i += 1;
  }

  while (j < after.length) {
    rows.push({ type: 'add', marker: '+', text: after[j] });
    additions += 1;
    j += 1;
  }

  return {
    rows,
    summary: {
      additions,
      deletions,
      changed: additions + deletions,
      previousLines: before.length,
      nextLines: after.length,
    },
  };
}

module.exports = {
  buildLineDiff,
};
