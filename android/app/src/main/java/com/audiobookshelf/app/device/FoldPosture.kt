package com.audiobookshelf.app.device

/**
 * How the device is bent, as far as layout is concerned.
 *
 * Only the half-opened postures are named. A foldable lying flat, or shut, is FLAT: there is a
 * hinge in the hardware either way, but nothing the UI should do about it.
 */
enum class FoldPosture {
  /** Flat, folded shut, or not a foldable. Lay out normally. */
  FLAT,

  /** Half-opened with a horizontal hinge - propped like a laptop. Top half faces the user. */
  TABLETOP,

  /** Half-opened with a vertical hinge - held like a book. Two pages side by side. */
  BOOK
}

/**
 * The posture plus where the hinge falls, as fractions so the web layer never deals in pixels.
 *
 * @param hingeFraction centre of the hinge along the axis it divides - down the window for
 *   TABLETOP, across it for BOOK - as 0..1. Zero when FLAT.
 * @param hingeThicknessFraction how much of that axis the hinge itself occupies. Zero on a
 *   seamless fold, which most recent devices are, and non-zero on a device with a real gap
 *   where content must not be placed.
 */
data class FoldState(
        val posture: FoldPosture,
        val hingeFraction: Double,
        val hingeThicknessFraction: Double
) {
  companion object {
    val FLAT = FoldState(FoldPosture.FLAT, 0.0, 0.0)
  }
}

/**
 * Turns what WindowManager reports about a folding feature into a posture.
 *
 * Takes primitives rather than a FoldingFeature so the rule can be tested without a device, an
 * emulator or the window library - the decision is the part worth pinning down, and it is the
 * part that is otherwise buried in a Flow collector that needs a real foldable to exercise.
 */
object FoldPostureRules {

  /**
   * @param isHalfOpened the feature's state is HALF_OPENED. A FLAT feature is not a posture.
   * @param isHorizontalHinge the hinge runs left-to-right, which makes it a tabletop.
   * @param hingeStart hinge bounds' top (horizontal hinge) or left (vertical), in pixels.
   * @param hingeEnd the opposite edge of the hinge bounds, in pixels.
   * @param windowExtent window height for a horizontal hinge, width for a vertical one.
   */
  fun resolve(
          isHalfOpened: Boolean,
          isHorizontalHinge: Boolean,
          hingeStart: Int,
          hingeEnd: Int,
          windowExtent: Int
  ): FoldState {
    if (!isHalfOpened) return FoldState.FLAT

    // Without a window to measure against there is no fraction to report, and a layout keyed off
    // a hinge it cannot place is worse than one that ignores it.
    if (windowExtent <= 0) return FoldState.FLAT

    val start = minOf(hingeStart, hingeEnd)
    val end = maxOf(hingeStart, hingeEnd)
    val centre = (start + end) / 2.0

    return FoldState(
            posture = if (isHorizontalHinge) FoldPosture.TABLETOP else FoldPosture.BOOK,
            hingeFraction = (centre / windowExtent).coerceIn(0.0, 1.0),
            hingeThicknessFraction = ((end - start).toDouble() / windowExtent).coerceIn(0.0, 1.0)
    )
  }
}
