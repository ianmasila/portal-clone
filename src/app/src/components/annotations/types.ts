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

/* Annotation group/cluster */
export interface AnnotationCluster {
  annotations: AnnotationLayer[];
  bbox: L.Rectangle | null;
} 

/* Annotation Interface */
export interface AnnotationTagType {
  tagname: string;
  tagid: number;
  rank?: number;
}

/* Leaflet Annotation Type */
export type PolylineObjectType = L.Polyline | L.Rectangle | L.Polygon;

export type UserResponse = 'accept' | 'decline' | 'cancel' | 'undo';
