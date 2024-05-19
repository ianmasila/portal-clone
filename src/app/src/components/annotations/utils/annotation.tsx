/* eslint-disable object-shorthand */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-prototype-builtins */

/**
 * @file This file contains methods for generating and converting traditional
 * annotation format to leaflet-polyline objects. And vice-versa.
 */
import * as L from "leaflet";
import * as turf from '@turf/turf';

import {
  PrimitiveShapeOptions,
  TagColours,
} from "@portal/constants/annotation";
import { AssetAPIObject } from "@portal/api/annotation";
import { PolylineObjectType } from "@portal/components/annotations/types";
import { blendHexColors } from "@portal/utils/index";

/**
 * Get Direct Annotation Color by TagID
 */
export const GetTagHashColour = (tagid: number): string => {
  return TagColours[tagid % TagColours.length];
};

/**
 * Obtain Tag Colours by TagID
 */
export const GetAnnotationColour = (
  Tags: { [tag: string]: number },
  tagid: number
): string => {
  return GetTagHashColour(tagid);
};

/**
 * Get intersection of two annotations with area
 * @param annotation1 - The first annotation to intersect
 * @param annotation2 - The second annotation to intersect
 * @returns The intersected annotation as a polygon or null if no intersection
 */
export function GetAnnotationIntersection(
  annotation1: PolylineObjectType,
  annotation2: PolylineObjectType
): PolylineObjectType | null {
  console.log("🚀 ~ GetAnnotationIntersection...")
  const poly1 = annotation1 as L.Polygon;
  const poly2 = annotation2 as L.Polygon;
  const poly1GeoJSON = poly1.toGeoJSON();
  const poly2GeoJSON = poly2.toGeoJSON();

  const intersection = turf.intersect(poly1GeoJSON, poly2GeoJSON);

  if (intersection && intersection.geometry.type === 'Polygon') {
    const primitiveOptions = PrimitiveShapeOptions;
    const options1 = annotation1.options as any;
    const options2 = annotation1.options as any;

    /**
     * Set Primitive Shape Options to Project Tags
     */
    const color1 = annotation1.options.color;
    const color2 = annotation2.options.color;
    const blendedColor = blendHexColors(color1, color2);
    if (blendedColor) {
      primitiveOptions.color = blendedColor;
      primitiveOptions.fillColor = blendedColor;
    }

    /* Create a new annotation tag */
    const randomInteger = TagColours.length + Math.random()*100;
    primitiveOptions.annotationTag = randomInteger;
    primitiveOptions.annotationID = `${options1.annotationID}x${options2.annotationID}`;

    let annotationType = 'polygon';
    if (options1.boundType === 'rectangle' && options2.boundType === 'rectangle') {
      annotationType = 'rectangle'
    }
    primitiveOptions.annotationType = annotationType ?? "";
    primitiveOptions.annotationProjectID = options1.annotationProjectID ?? "";
    primitiveOptions.confidence = Math.min(options1.confidence ?? 0, options2.confidence ?? 0);

    const coordinates = intersection.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng));
    return new L.Polygon(coordinates, primitiveOptions);
  }

  return null;
}

/**
 * This function attaches a several crucial listeners to act on individual
 * annotation layers.
 */
export const AttachAnnotationHandlers = (
  drawmap: L.DrawMap,
  annotationGroup: L.FeatureGroup,
  layer: L.Layer | any,
  project: string,
  annotationID: string | undefined,
  callbacks?: {
    handleAnnotationRightClick?: (event: L.LeafletMouseEvent, annotation: L.Layer) => void;
    handleAnnotationLeftClick?: (event: L.LeafletMouseEvent, annotation: L.Layer) => void;
  } 
): PolylineObjectType => {
  // Add right-click event listener to the layer
  layer.on("contextmenu", (event: L.LeafletMouseEvent) => {
    callbacks?.handleAnnotationRightClick?.(event, layer);
  });
  // Add left-click event listener to the layer
  layer.on("click", (event: L.LeafletMouseEvent) => {
    // TODO: Ensure click event is ignored if parent event was right click
    if (event.type !== "contextmenu") {
      callbacks?.handleAnnotationLeftClick?.(event, layer);
    }
  });

  /**
   * Obtain Annotation ID from Layer Attribution of AnnotationID is Undefined
   */
  // eslint-disable-next-line no-param-reassign
  (layer.options as any).annotationID = annotationID;

  return layer;
};


/**
 * This function generates leaflet vector objects such as polygon and rectangle
 * that will be rendered on leaflet canvas using database defined descriptors.
 *
 * @param {JSON} annotations - Stored recipe for reconstructing annotations
 * @return {Array<L.Polyline>}
 */
export function RenderAssetAnnotations(
  drawmap: L.DrawMap,
  annotationGroup: L.FeatureGroup,
  asset: AssetAPIObject,
  project: string,
  assetWidth: number,
  assetHeight: number,
  tags: { [tag: string]: number },
  callbacks?: {
    handleAnnotationRightClick?: (event: L.LeafletMouseEvent, annotation: L.Layer) => void;
    handleAnnotationLeftClick?: (event: L.LeafletMouseEvent, annotation: L.Layer) => void;
  } 
): Array<PolylineObjectType> {
  const polylineObjects: Array<PolylineObjectType> = [];

  /* Generate Each Polyline Object per Annotation in Asset */
  let imageCoordinateBounds: Array<L.LatLng> = [];
  const primitiveOptions = PrimitiveShapeOptions;

  asset.annotations.forEach((annotation, idx) => {
    /* Reset Bounds Per Annotation */
    imageCoordinateBounds = [];
    annotation.annotationID = `${idx}`; // eslint-disable-line no-param-reassign
    /* Scale Coordinates to Image Coordinates */
    switch (annotation.boundType) {
      /* Attach type of annotation according to type of annotation */
      case "masks":
      case "polygon":
        if (annotation.contour !== undefined) {
          annotation.contour?.forEach((vertex: Array<number>) => {
            imageCoordinateBounds.push(
              /* Flip XY -> Lat Lng */
              L.latLng((1 - vertex[1]) * assetHeight, vertex[0] * assetWidth)
            );
          });
        }
        break;
      case "rectangle":
        annotation.bound.forEach((vertex: Array<number>) => {
          imageCoordinateBounds.push(
            /* Flip XY -> Lat Lng */
            L.latLng((1 - vertex[1]) * assetHeight, vertex[0] * assetWidth)
          );
        });
        break;
      default:
        break;
    }

    /**
     * Select Option Archetype
     */

    let PrimitiveObject: any;

    switch (annotation.boundType) {
      case "rectangle":
        PrimitiveObject = L.rectangle;
        break;
      /* Mask and Polygon are synonymous */
      case "polygon":
      case "masks":
        PrimitiveObject = L.polygon;
        break;
      default:
        PrimitiveObject = L.rectangle;
        break;
    }

    /* Obtain Colour */
    // modified because of corresponding API call
    const annotationColor = GetAnnotationColour(tags, annotation.tag.id);

    /**
     * Set Primitive Shape Options to Project Tags
     */
    primitiveOptions.color = annotationColor;
    primitiveOptions.fillColor = annotationColor;
    primitiveOptions.annotationTag = annotation.tag.id;
    primitiveOptions.annotationID = annotation.annotationID;
    primitiveOptions.annotationType = annotation.boundType;
    primitiveOptions.annotationProjectID = project;
    primitiveOptions.confidence = annotation.confidence;

    /**
     * Push Polyline Object into Array
     * Also, attach an OndeleteHandler to call the correct API when 'delete'
     * event is triggered.
     */
    polylineObjects.push(
      AttachAnnotationHandlers(
        drawmap,
        annotationGroup,
        PrimitiveObject(imageCoordinateBounds, primitiveOptions),
        project,
        annotation.annotationID,
        callbacks,
      )
    );
  });

  return polylineObjects;
}
