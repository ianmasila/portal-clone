import React, { useState, useEffect, forwardRef } from 'react';
import { Classes, Menu, MenuDivider, MenuItem } from "@blueprintjs/core";
import styles from './annotationoptionsmenu.module.css';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

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
  onClose: () => void;
  callbacks: {
    handleAnnotationOptionsMenuSelection: (value: any, key: string) => void;
    getAnnotationTag: () => string;
    setAnnotationTag: (tagIndex: number) => number;
    getTagInfo: () => { [tag: string]: number } | any;

  };
}

const AnnotationOptionsMenu = forwardRef<HTMLDivElement, AnnotationOptionsMenuProps>(
  ({
    position,
    onClose,
    callbacks,
  }, ref) => {
  // Improvement: SRP: Put this tag logic in a custom hook
  const [tag, setTag] = useState<string>("");
  const [tagList, setTagList] = useState<string[]>([]);

  useEffect(() => {
      const tag = callbacks.getAnnotationTag();
      const tagInfo = callbacks.getTagInfo();
      const tagList = Object.keys(tagInfo);
      setTag(tag);
      setTagList(tagList);
  }, [])

  // Listen and respond to clicks outside menu
  useOnClickOutside(ref, 'mousedown', onClose);

  if (!position) {
    return null;
  }

  return (
    <div 
      className={styles.menu}
      style={{ top: `${position.y - 42}px`, left: `${position.x}px` }}
      ref={ref}
    >
      <Menu className={Classes.ELEVATION_1} {...getSizeProp("regular")}>
        <MenuItem icon="tag" text={tag}>
          {tagList.map((tag, i) => (
              <MenuItem 
                  key={`${tag}-${i}`}
                  text={`${i+1}. ${tag}`} 
                  onClick={() => setTag(tag)} />
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
