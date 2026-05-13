// Barrel for the map widget set.
//
// Note: we intentionally do NOT re-export `<MapView />` here.  The MapLibre
// runtime touches `window` at module load and would crash any caller that
// imports the barrel server-side (e.g., the `/map` page's data-fetch path).
// Callers that need the WebGL canvas should `next/dynamic`-import it directly
// from `@/components/map/map-view` with `{ ssr: false }`.

export { LayerControls, parseLayerState } from './layer-controls'
export type { LayerState, CategoryLayerKey, LayerControlsProps } from './layer-controls'

export { LocationSidePanel } from './location-side-panel'
export type { LocationSidePanelProps, LocationSummary } from './location-side-panel'

export type { MapViewProps, MarkerCollection } from './map-view'

export { FigureMarker } from './figure-marker'
export type { FigureMarkerProps } from './figure-marker'
