/**
 * Caption format validation and correction.
 * Rules: Markdown asterisk misuse, punctuation spacing, punctuation norms, sentence capitalization.
 */

export interface CaptionFormatError {
  start: number;
  end: number;
  message: string;
  replacement?: string;
}

export interface ValidateCaptionFormatResult {
  errors: CaptionFormatError[];
  correctedText: string;
}

/** Build corrected text by applying replacements in order (by start index descending to avoid offset shifts). */
function applyReplacements(text: string, errors: CaptionFormatError[]): string {
  const sorted = [...errors].filter((e) => e.replacement != null).sort((a, b) => b.start - a.start);
  let result = text;
  for (const { start, end, replacement } of sorted) {
    if (replacement == null) continue;
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}

/** Find unpaired Markdown * and **, and paired **...** (Markdown bold – flag so user can strip for plain captions). */
function findMarkdownIssues(text: string): CaptionFormatError[] {
  const errors: CaptionFormatError[] = [];

  // Paired **...** (Markdown bold) – many platforms don't support it; flag so Check highlights and Correct can strip
  const boldRe = /\*\*([^*]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(text)) !== null) {
    errors.push({
      start: m.index,
      end: m.index + m[0].length,
      message: 'Markdown bold (**) may not display on all platforms',
      replacement: m[1],
    });
  }

  // Paired *...* (Markdown italic) – same as above; skip if fully inside a **...** range
  const italicRe = /\*([^*]+)\*/g;
  while ((m = italicRe.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const insideBold = errors.some((e) => e.start <= start && e.end >= end);
    if (!insideBold) {
      errors.push({
        start,
        end,
        message: 'Markdown italic (*) may not display on all platforms',
        replacement: m[1],
      });
    }
  }

  // Unpaired * (single) – not part of **
  let i = 0;
  while (i < text.length) {
    if (text.slice(i, i + 2) === '**') {
      i += 2;
      continue;
    }
    if (text[i] === '*') {
      const nextStar = text.indexOf('*', i + 1);
      const nextDouble = text.indexOf('**', i + 1);
      if (nextDouble === i + 1) {
        i += 2;
        continue;
      }
      if (nextStar === -1) {
        errors.push({
          start: i,
          end: i + 1,
          message: 'Unpaired asterisk (*)',
          replacement: '',
        });
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  // Unpaired ** (odd count of **) – only add if we didn't already flag this range as paired **...**
  const doubleCount = (text.match(/\*\*/g) || []).length;
  if (doubleCount % 2 !== 0) {
    const idx = text.indexOf('**');
    if (idx !== -1) {
      const alreadyFlagged = errors.some((e) => e.start <= idx && e.end >= idx + 2);
      if (!alreadyFlagged) {
        errors.push({
          start: idx,
          end: idx + 2,
          message: 'Unpaired double asterisk (**)',
          replacement: '',
        });
      }
    }
  }
  return errors;
}

/** Find punctuation spacing issues: . , ! ? followed by non-space (except end of line/string). */
function findPunctuationSpacingErrors(text: string): CaptionFormatError[] {
  const errors: CaptionFormatError[] = [];
  const re = /([.,!?])([^\s\n)])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const replacement = m[1] + ' ' + m[2];
    errors.push({
      start: m.index,
      end: m.index + full.length,
      message: 'Missing space after punctuation',
      replacement,
    });
  }
  return errors;
}

/** Find sentence start not capitalized. */
function findSentenceCapitalizationErrors(text: string): CaptionFormatError[] {
  const errors: CaptionFormatError[] = [];
  const re = /(^|[.!?]\s+)([a-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const letter = m[2];
    errors.push({
      start: m.index + m[1].length,
      end: m.index + m[0].length,
      message: 'Sentence should start with a capital letter',
      replacement: m[1] + letter.toUpperCase(),
    });
  }
  return errors;
}

/** Validate caption format and optionally produce corrected text. */
export function validateCaptionFormat(text: string): ValidateCaptionFormatResult {
  const errors: CaptionFormatError[] = [];

  const markdownErrors = findMarkdownIssues(text);
  errors.push(...markdownErrors);

  const spacingErrors = findPunctuationSpacingErrors(text);
  errors.push(...spacingErrors);

  const capErrors = findSentenceCapitalizationErrors(text);
  errors.push(...capErrors);

  // Sort by start index for consistent ordering
  errors.sort((a, b) => a.start - b.start);

  const correctedText = errors.length > 0 ? applyReplacements(text, errors) : text;

  return { errors, correctedText };
}
