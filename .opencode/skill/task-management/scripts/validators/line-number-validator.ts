/**
 * Line-Number Precision Format Validator
 * 
 * Validates line-number format for context_files and reference_files in enhanced task schema.
 * 
 * Valid formats:
 * - Single range: "12-18"
 * - Multiple ranges: "12,15-20,25"
 * - Single line: "42"
 * - Complex: "1-10,25,30-50,100-120"
 * 
 * Invalid formats:
 * - Reversed ranges: "50-10"
 * - Invalid separators: "12:18" or "12..18"
 * - Non-numeric: "abc-def"
 * - Negative numbers: "-5-10"
 */

export interface LineNumberValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  parsed?: ParsedLineRange[];
}

export interface ParsedLineRange {
  start: number;
  end: number;
}

/**
 * Validates line-number format string
 * 
 * @param lines - Line range string (e.g., "12-18" or "1-10,25,30-50")
 * @returns Validation result with errors and parsed ranges
 */
export function validateLineNumberFormat(lines: string | undefined): LineNumberValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Empty or undefined is valid (means read entire file)
  if (!lines || lines.trim() === '') {
    return { valid: true, errors: [], parsed: [] };
  }

  // Trim whitespace
  const trimmed = lines.trim();

  // Check for invalid characters (only digits, commas, hyphens, and spaces allowed)
  // Spaces will be trimmed from segments later
  const invalidCharsPattern = /[^0-9,\-\s]/;
  if (invalidCharsPattern.test(trimmed)) {
    errors.push(`Invalid characters in line range: "${trimmed}". Only digits, commas, and hyphens are allowed.`);
    return { valid: false, errors, warnings };
  }

  // Check for leading/trailing commas or hyphens
  if (trimmed.startsWith(',') || trimmed.endsWith(',')) {
    errors.push(`Line range cannot start or end with a comma: "${trimmed}"`);
  }
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    errors.push(`Line range cannot start or end with a hyphen: "${trimmed}"`);
  }

  // Check for consecutive commas or hyphens
  if (trimmed.includes(',,')) {
    errors.push(`Line range contains consecutive commas: "${trimmed}"`);
  }
  if (trimmed.includes('--')) {
    errors.push(`Line range contains consecutive hyphens: "${trimmed}"`);
  }

  // Return early if basic format errors found
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Parse and validate each range
  const parsed: ParsedLineRange[] = [];
  const segments = trimmed.split(',');

  for (const segment of segments) {
    const segmentTrimmed = segment.trim();

    if (segmentTrimmed === '') {
      errors.push(`Empty segment in line range: "${trimmed}"`);
      continue;
    }

    // Check if it's a range (contains hyphen) or single line
    if (segmentTrimmed.includes('-')) {
      const parts = segmentTrimmed.split('-');

      // Should have exactly 2 parts (start and end)
      if (parts.length !== 2) {
        errors.push(`Invalid range format: "${segmentTrimmed}". Expected format: "start-end"`);
        continue;
      }

      const startStr = parts[0].trim();
      const endStr = parts[1].trim();

      // Check for empty parts
      if (startStr === '' || endStr === '') {
        errors.push(`Range has empty start or end: "${segmentTrimmed}"`);
        continue;
      }

      // Parse numbers
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      // Validate numbers
      if (isNaN(start) || isNaN(end)) {
        errors.push(`Non-numeric values in range: "${segmentTrimmed}"`);
        continue;
      }

      // Check for negative numbers
      if (start < 1 || end < 1) {
        errors.push(`Line numbers must be positive: "${segmentTrimmed}"`);
        continue;
      }

      // Check for reversed range
      if (start > end) {
        errors.push(`Invalid range (start > end): "${segmentTrimmed}". Start must be less than or equal to end.`);
        continue;
      }

      // Check for same start and end (should use single line format)
      if (start === end) {
        warnings.push(`Range "${segmentTrimmed}" has same start and end. Consider using single line format: "${start}"`);
      }

      parsed.push({ start, end });
    } else {
      // Single line number
      const lineNum = parseInt(segmentTrimmed, 10);

      if (isNaN(lineNum)) {
        errors.push(`Non-numeric line number: "${segmentTrimmed}"`);
        continue;
      }

      if (lineNum < 1) {
        errors.push(`Line number must be positive: "${segmentTrimmed}"`);
        continue;
      }

      parsed.push({ start: lineNum, end: lineNum });
    }
  }

  // Check for overlapping ranges (warning only)
  if (parsed.length > 1) {
    const sortedRanges = [...parsed].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      const current = sortedRanges[i];
      const next = sortedRanges[i + 1];

      if (current.end >= next.start) {
        warnings.push(
          `Overlapping ranges detected: "${current.start}-${current.end}" and "${next.start}-${next.end}". ` +
          `Consider merging into a single range.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    parsed: errors.length === 0 ? parsed : undefined
  };
}

/**
 * Parses line-number format string into array of ranges
 * 
 * @param lines - Line range string (e.g., "12-18" or "1-10,25,30-50")
 * @returns Array of parsed ranges or null if invalid
 */
export function parseLineNumberFormat(lines: string | undefined): ParsedLineRange[] | null {
  const result = validateLineNumberFormat(lines);
  return result.valid ? (result.parsed || []) : null;
}

/**
 * Formats parsed ranges back into line-number string
 * 
 * @param ranges - Array of parsed ranges
 * @returns Formatted line-number string
 */
export function formatLineNumberRanges(ranges: ParsedLineRange[]): string {
  if (ranges.length === 0) {
    return '';
  }

  return ranges
    .map(range => {
      if (range.start === range.end) {
        return `${range.start}`;
      }
      return `${range.start}-${range.end}`;
    })
    .join(',');
}

/**
 * Checks if a specific line number is included in the ranges
 * 
 * @param lineNum - Line number to check
 * @param ranges - Array of parsed ranges
 * @returns True if line is included in any range
 */
export function isLineInRanges(lineNum: number, ranges: ParsedLineRange[]): boolean {
  return ranges.some(range => lineNum >= range.start && lineNum <= range.end);
}

/**
 * Extracts specified lines from file content
 * 
 * @param content - Full file content
 * @param lines - Line range string (e.g., "12-18" or "1-10,25,30-50")
 * @returns Extracted lines or null if invalid format
 */
export function extractLines(content: string, lines: string | undefined): string | null {
  // If no lines specified, return entire content
  if (!lines || lines.trim() === '') {
    return content;
  }

  // Validate and parse line ranges
  const result = validateLineNumberFormat(lines);
  if (!result.valid || !result.parsed) {
    return null;
  }

  // Split content into lines
  const contentLines = content.split('\n');
  const extractedLines: string[] = [];

  // Extract lines based on ranges
  for (let i = 0; i < contentLines.length; i++) {
    const lineNum = i + 1; // Line numbers are 1-based
    if (isLineInRanges(lineNum, result.parsed)) {
      extractedLines.push(contentLines[i]);
    }
  }

  return extractedLines.join('\n');
}

/**
 * Validates line-number format and provides clear error messages
 * 
 * @param lines - Line range string to validate
 * @returns Human-readable validation message
 */
export function getValidationMessage(lines: string | undefined): string {
  const result = validateLineNumberFormat(lines);

  if (result.valid) {
    if (result.warnings && result.warnings.length > 0) {
      return `Valid (with warnings):\n${result.warnings.map(w => `  - ${w}`).join('\n')}`;
    }
    return 'Valid';
  }

  return `Invalid:\n${result.errors.map(e => `  - ${e}`).join('\n')}`;
}
