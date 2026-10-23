package com.audiobookshelf.app.device

import org.junit.Assert.assertEquals
import org.junit.Test

class FoldPostureRulesTest {

  // A Z Fold's inner screen, seamless hinge across the middle, propped open on a table.
  @Test
  fun `half opened with a horizontal hinge is tabletop`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 1076,
                    hingeEnd = 1076,
                    windowExtent = 2152)

    assertEquals(FoldPosture.TABLETOP, state.posture)
    assertEquals(0.5, state.hingeFraction, 0.001)
    assertEquals(0.0, state.hingeThicknessFraction, 0.001)
  }

  @Test
  fun `half opened with a vertical hinge is book`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = false,
                    hingeStart = 880,
                    hingeEnd = 880,
                    windowExtent = 1760)

    assertEquals(FoldPosture.BOOK, state.posture)
    assertEquals(0.5, state.hingeFraction, 0.001)
  }

  // The common case by far: a flat foldable, a shut one, and every phone that is not a foldable.
  // The hinge values are ignored entirely - a flat device still reports a feature.
  @Test
  fun `anything not half opened is flat`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = false,
                    isHorizontalHinge = true,
                    hingeStart = 1076,
                    hingeEnd = 1100,
                    windowExtent = 2152)

    assertEquals(FoldState.FLAT, state)
  }

  // A device with a real gap rather than a seamless fold: the thickness is what stops content
  // being laid into the dead strip.
  @Test
  fun `a hinge with thickness reports it as a fraction`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 980,
                    hingeEnd = 1020,
                    windowExtent = 2000)

    assertEquals(0.5, state.hingeFraction, 0.001)
    assertEquals(0.02, state.hingeThicknessFraction, 0.001)
  }

  @Test
  fun `an off centre hinge is reported where it actually is`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 600,
                    hingeEnd = 600,
                    windowExtent = 2400)

    assertEquals(0.25, state.hingeFraction, 0.001)
  }

  @Test
  fun `bounds given back to front are still read correctly`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 1020,
                    hingeEnd = 980,
                    windowExtent = 2000)

    assertEquals(0.5, state.hingeFraction, 0.001)
    assertEquals(0.02, state.hingeThicknessFraction, 0.001)
  }

  // No window to measure against - during a configuration change, or before the view is laid out.
  // A layout keyed off a hinge it cannot place is worse than one that ignores it.
  @Test
  fun `no measurable window falls back to flat`() {
    assertEquals(
            FoldState.FLAT,
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 100,
                    hingeEnd = 100,
                    windowExtent = 0))
  }

  @Test
  fun `a hinge reported beyond the window is clamped`() {
    val state =
            FoldPostureRules.resolve(
                    isHalfOpened = true,
                    isHorizontalHinge = true,
                    hingeStart = 5000,
                    hingeEnd = 5000,
                    windowExtent = 2000)

    assertEquals(1.0, state.hingeFraction, 0.001)
  }
}
