/**
 * @file This file contains types for Annotator
 */

/**
 * Annotations are Leaflet layers with additional
 * editing and options properties
 */
export interface AnnotationLayer extends L.Layer {
    editing: any;
    options: any;
};

/* Annotation Interface */
export interface AnnotationTagType {
  tagname: string;
  tagid: number;
  rank?: number;
}

/* Leaflet Annotation Type */
export type PolylineObjectType = L.Polyline | L.Rectangle | L.Polygon;
