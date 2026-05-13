/**
 * Atsar — Timeline (single) barrel.
 *
 * Re-exports the `<TimelineSingle/>` component, the lightweight `<Marker/>`
 * helper, and the public types. Consumers (e.g. F10's FigureDetail "Timeline"
 * tab) should import from this barrel rather than reaching into individual
 * files so internal layout can move without breaking call sites.
 *
 * See `docs/WIREFRAMES.md` §7.
 */

export { TimelineSingle, default as TimelineSingleDefault } from './timeline-single'
export { Marker } from './marker'

export type {
  TimelineEvent,
  TimelineEventCategory,
  TimelineEventPrecision,
  TimelineSingleProps,
} from './timeline-types'
export type { MarkerProps } from './marker'
