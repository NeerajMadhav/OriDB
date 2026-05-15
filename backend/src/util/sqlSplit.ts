/**
 * Splits SQL on semicolons outside of strings and comments (line + block).
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = 0;

  const pushStatement = () => {
    const t = buf.trim();
    if (t.length) statements.push(t);
    buf = "";
  };

  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      buf += c;
      i += 1;
      continue;
    }
    if (inBlockComment > 0) {
      if (c === "*" && next === "/") {
        inBlockComment -= 1;
        buf += "*/";
        i += 2;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (c === "-" && next === "-") {
        inLineComment = true;
        buf += "--";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        inBlockComment += 1;
        buf += "/*";
        i += 2;
        continue;
      }
    }

    if (!inDouble && c === "'" && !isEscaped(sql, i)) {
      inSingle = !inSingle;
      buf += c;
      i += 1;
      continue;
    }
    if (!inSingle && c === '"' && !isEscaped(sql, i)) {
      inDouble = !inDouble;
      buf += c;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && c === ";") {
      i += 1;
      pushStatement();
      continue;
    }

    buf += c;
    i += 1;
  }
  pushStatement();
  return statements;
}

function isEscaped(s: string, idx: number): boolean {
  let back = 0;
  for (let j = idx - 1; j >= 0 && s[j] === "\\"; j -= 1) back += 1;
  return back % 2 === 1;
}
