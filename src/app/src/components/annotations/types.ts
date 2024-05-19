/**
 * @file This file contains types for Annotator
 */

/**
 * Annotations are Leaflet layers with additional
 * editing and options properties
 */
interface AnnotationLayer extends L.Layer {
    editing: any;
    options: any;
};
