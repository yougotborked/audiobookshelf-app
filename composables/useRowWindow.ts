export interface RowWindowInput {
  /** How far the top of the list has scrolled above the top of the viewport, in pixels. */
  scrolledPast: number
  /** Height of the scrolling viewport, in pixels. */
  viewportHeight: number
  /** Rendered height of a single row, in pixels. */
  rowHeight: number
  /** Number of rows in the full list. */
  totalRows: number
  /** Extra rows rendered above and below the viewport so scrolling does not reveal gaps. */
  overscan?: number
}

export interface RowWindow {
  /** Index of the first rendered row. */
  first: number
  /** Index one past the last rendered row. */
  last: number
  /** Height of the spacer standing in for the rows above `first`. */
  topSpacer: number
  /** Height of the spacer standing in for the rows below `last`. */
  bottomSpacer: number
}

/**
 * Works out which slice of a long, uniform-height list needs to be in the DOM.
 *
 * Kept separate from the component so the arithmetic can be exercised on its own.
 */
export function computeRowWindow({
  scrolledPast,
  viewportHeight,
  rowHeight,
  totalRows,
  overscan = 0
}: RowWindowInput): RowWindow {
  if (totalRows <= 0 || rowHeight <= 0) {
    return { first: 0, last: 0, topSpacer: 0, bottomSpacer: 0 }
  }

  const top = Math.max(0, scrolledPast)
  const bottom = top + Math.max(0, viewportHeight)

  const first = Math.min(totalRows, Math.max(0, Math.floor(top / rowHeight) - overscan))
  const last = Math.min(totalRows, Math.max(first, Math.ceil(bottom / rowHeight) + overscan))

  return {
    first,
    last,
    topSpacer: first * rowHeight,
    bottomSpacer: (totalRows - last) * rowHeight
  }
}
