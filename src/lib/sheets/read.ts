import "server-only";

import { sheetsClient, explainSheetsError } from "./client";

export interface SheetData {
  /** Header row, verbatim. */
  headers: string[];
  /** Data rows, each padded to headers.length. */
  rows: string[][];
  /** 1-based sheet row number for rows[i], for pointing at a bad record. */
  rowNumbers: number[];
  spreadsheetId: string;
  tab: string;
}

/**
 * Reads the whole response tab.
 *
 * A:ZZ rather than a fixed width so questions added to the form are picked up
 * without a code change — they land in `extra` until they get a real column.
 */
export async function readSheet(): Promise<SheetData> {
  const { sheets, spreadsheetId, tab } = sheetsClient();

  let values: string[][];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!A:ZZ`,
      // FORMATTED_STRING keeps dates as the user sees them; parseSheetDate then
      // reads them with an explicit format. UNFORMATTED_VALUE would hand back
      // serial numbers, which is also handled, but formatted is easier to debug.
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    values = (res.data.values ?? []) as string[][];
  } catch (err) {
    throw new Error(explainSheetsError(err));
  }

  if (values.length === 0) {
    return { headers: [], rows: [], rowNumbers: [], spreadsheetId, tab };
  }

  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());

  // The API omits trailing empty cells, so a row ending in blanks comes back
  // short. Without padding, every column after the first gap shifts left and
  // the mapping silently reads the wrong field.
  const body = values.slice(1);
  const rows: string[][] = [];
  const rowNumbers: number[] = [];

  body.forEach((row, i) => {
    const padded = Array.from({ length: headers.length }, (_, c) => String(row?.[c] ?? "").trim());
    // Skip rows that are entirely blank — deleting a response in Sheets can
    // leave one behind.
    if (padded.some((cell) => cell !== "")) {
      rows.push(padded);
      rowNumbers.push(i + 2); // +1 for the header, +1 because sheets are 1-based
    }
  });

  return { headers, rows, rowNumbers, spreadsheetId, tab };
}
