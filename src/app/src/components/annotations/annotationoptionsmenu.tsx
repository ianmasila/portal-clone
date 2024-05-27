import React, { useState, useEffect, forwardRef } from 'react';
import { Classes, Menu, MenuDivider, MenuItem } from "@blueprintjs/core";
import styles from './annotationoptionsmenu.module.css';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { AnnotationLayer } from './types';
import { invert } from 'lodash';

type Size = "small" | "regular" | "large";

function getSizeProp(size: Size) {
  switch (size) {
    case "large":
      return { large: true };
    case "small":
      return { small: true };
    default:
      // regular is the default
      return {};
  }
}

interface AnnotationOptionsMenuProps {
  position: {
    x: number;
    y: number;
  } | null;
  annotation: AnnotationLayer | null,
  tags: { [tag: string]: number };
  onClose: () => void;
  callbacks: {
    handleAnnotationOptionsMenuSelection: (value: any, key: string) => void;
    updateAnnotation: (annotation: AnnotationLayer, options: { [key: string]: any }) => void;
  };
}

const AnnotationOptionsMenu = forwardRef<HTMLDivElement, AnnotationOptionsMenuProps>(
  ({
    position,
    annotation,
    tags,
    onClose,
    callbacks,
  }, ref) => {
  // Listen and respond to clicks outside menu
  useOnClickOutside(ref, 'mousedown', onClose);

  if (!position || !annotation) {
    return null;
  }

  return (
    <div 
      className={styles.menu}
      style={{ top: `${position.y - 42}px`, left: `${position.x}px` }}
      ref={ref}
    >
      <Menu className={Classes.ELEVATION_1} {...getSizeProp("regular")}>
        <MenuItem icon="tag" text={(invert(tags))[annotation.options.annotationTag]}>
          {Object.entries(tags).map(([tag, tagId], i) => (
              <MenuItem 
                key={`${tag}-${i}`}
                text={`${i+1}. ${tag}`} 
                onClick={() => {
                  callbacks.updateAnnotation(annotation, { annotationTag: tagId });
                  onClose();
                }}
              />
          ))}
        </MenuItem>
        <MenuDivider />
        <MenuItem
          icon="intersection"
          text="Intersect"
          onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({ intersect: true }, 'intersect');
              onClose();
          }}
        />
        <MenuItem
          icon="unresolve"
          text="Subtract"
          onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({ subtract: true }, 'subtract');
              onClose();
          }}
          disabled
        />
        <MenuItem
          icon="resolve"
          text="Merge"
          onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({ merge: true }, 'merge');
              onClose();
          }}
          disabled
        />
        <MenuItem
          icon="step-forward"
          text="Bring Forward"
          onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({ bringForward: true }, 'bring-forward');
              onClose();
          }}
          disabled
        />
        <MenuItem
          icon="step-backward"
          text="Bring Back"
          onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({ bringBack: true }, 'bring-back');
              onClose();
          }}
          disabled
        />
      </Menu>
    </div>
  );
});

export default AnnotationOptionsMenu;
