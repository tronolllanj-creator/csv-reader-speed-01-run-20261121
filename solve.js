const DELIM_RE = /[,\r\n]/g;
const LINE_RE = /\r\n?|\n/g;

export function run(input) {
  const s = String(input.text);
  const useHeader = input.header === true;
  const len = s.length;
  let pos = len > 0 && s.charCodeAt(0) === 0xfeff ? 1 : 0;

  let columns = useHeader ? [] : null;
  let hasHeader = false;
  let expectedFields = -1;
  const rows = [];
  const errors = [];

  let currentLine = 1;
  let lineHits = 0;
  const countLine = () => {
    lineHits++;
    return "\n";
  };

  while (pos < len) {
    const recordLine = currentLine;
    const recordRow = useHeader && !hasHeader ? null : rows.length;
    const fields = [];
    let firstFieldQuoted = false;
    let fieldIndex = 0;

    while (true) {
      let val = "";
      let wasQuoted = false;
      let readUnquoted = true;
      let appendJunk = false;
      let endType = 0;

      if (pos < len && s.charCodeAt(pos) === 34) {
        let search = pos + 1;
        let chunkStart = search;
        let pieces = null;
        let closePos = -1;

        while (true) {
          const q = s.indexOf('"', search);
          if (q === -1) break;
          if (s.charCodeAt(q + 1) === 34) {
            if (pieces === null) pieces = [];
            pieces.push(s.slice(chunkStart, q + 1));
            chunkStart = q + 2;
            search = q + 2;
          } else {
            closePos = q;
            break;
          }
        }

        if (closePos === -1) {
          errors.push({ code: "unterminated_quote", line: recordLine, row: recordRow });
        } else {
          wasQuoted = true;
          if (pieces === null) {
            val = s.slice(chunkStart, closePos);
          } else {
            if (closePos > chunkStart) pieces.push(s.slice(chunkStart, closePos));
            val = pieces.join("");
          }

          if (val.indexOf("\r") !== -1) {
            lineHits = 0;
            val = val.replace(LINE_RE, countLine);
            currentLine += lineHits;
          } else if (val.indexOf("\n") !== -1) {
            let nl = val.indexOf("\n");
            while (nl !== -1) {
              currentLine++;
              nl = val.indexOf("\n", nl + 1);
            }
          }

          pos = closePos + 1;
          if (pos >= len) {
            endType = 0;
            readUnquoted = false;
          } else {
            const nextCh = s.charCodeAt(pos);
            if (nextCh === 44) {
              pos++;
              endType = 1;
              readUnquoted = false;
            } else if (nextCh === 10) {
              pos++;
              currentLine++;
              endType = 2;
              readUnquoted = false;
            } else if (nextCh === 13 && s.charCodeAt(pos + 1) === 10) {
              pos += 2;
              currentLine++;
              endType = 2;
              readUnquoted = false;
            } else {
              appendJunk = true;
            }
          }
        }
      }

      if (readUnquoted) {
        if (pos >= len) {
          endType = 0;
        } else {
          let chunkStart = pos;
          let pieces = null;
          let endIdx = len;

          while (true) {
            DELIM_RE.lastIndex = pos;
            const m = DELIM_RE.exec(s);
            if (m === null) {
              endIdx = len;
              pos = len;
              endType = 0;
              break;
            }
            const idx = m.index;
            const ch = s.charCodeAt(idx);
            if (ch === 44) {
              endIdx = idx;
              pos = idx + 1;
              endType = 1;
              break;
            }
            if (ch === 10) {
              endIdx = idx;
              pos = idx + 1;
              currentLine++;
              endType = 2;
              break;
            }
            if (s.charCodeAt(idx + 1) === 10) {
              endIdx = idx;
              pos = idx + 2;
              currentLine++;
              endType = 2;
              break;
            }
            if (idx > chunkStart) {
              if (pieces === null) pieces = [];
              pieces.push(s.slice(chunkStart, idx));
            }
            errors.push({ code: "stray_cr", line: recordLine, row: recordRow });
            chunkStart = idx + 1;
            pos = idx + 1;
          }

          let unq;
          if (pieces === null) {
            unq = chunkStart === endIdx ? "" : s.slice(chunkStart, endIdx);
          } else {
            if (endIdx > chunkStart) pieces.push(s.slice(chunkStart, endIdx));
            unq = pieces.length === 1 ? pieces[0] : pieces.join("");
          }

          if (appendJunk) {
            if (unq.length > 0) {
              val += unq;
              errors.push({ code: "quote_junk", line: recordLine, row: recordRow });
            }
          } else {
            val = unq;
          }
        }
      }

      if (fieldIndex === 0) firstFieldQuoted = wasQuoted;
      fields.push(val);
      fieldIndex++;
      if (endType !== 1) break;
    }

    if (fields.length === 1 && !firstFieldQuoted && fields[0] === "") {
      continue;
    }

    if (useHeader && !hasHeader) {
      hasHeader = true;
      columns = fields;
      expectedFields = fields.length;
    } else {
      if (expectedFields === -1) {
        expectedFields = fields.length;
      } else if (fields.length < expectedFields) {
        const actualCount = fields.length;
        while (fields.length < expectedFields) fields.push("");
        errors.push({ code: "short_row", line: recordLine, row: recordRow, fields: actualCount });
      } else if (fields.length > expectedFields) {
        const extra = fields.splice(expectedFields);
        errors.push({ code: "long_row", line: recordLine, row: recordRow, extra });
      }
      rows.push(fields);
    }
  }

  return { columns, rows, errors };
}
