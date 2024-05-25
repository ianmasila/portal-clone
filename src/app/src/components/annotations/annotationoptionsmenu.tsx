import React, { forwardRef } from 'react';
import { Menu, MenuItem } from '@blueprintjs/core';
import styles from './annotationoptionsmenu.module.css';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

interface AnnotationOptionsMenuProps {
  position: {
    x: number;
    y: number;
  } | null;
  onClose: () => void;
  callbacks: {
    handleAnnotationOptionsMenuSelection: (value: any, key: string) => void;
  };
}

const AnnotationOptionsMenu = forwardRef<HTMLDivElement, AnnotationOptionsMenuProps>(
  ({ position, onClose, callbacks }, ref) => {

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
          <Menu>
            <MenuItem
              className={styles.menuItem}
              icon="intersection"
              text="Intersect"
              onClick={() => {
                callbacks.handleAnnotationOptionsMenuSelection({
                  intersect: true,
                }, 'intersect');
                onClose();
              }}
            />
            <MenuItem
              className={styles.menuItem}
              icon="add"
              text="Merge"
              onClick={() => {
                callbacks.handleAnnotationOptionsMenuSelection({ merge: true }, 'merge');
                onClose();
              }}
              disabled
            />
            <MenuItem
              className={styles.menuItem}
              icon="minus"
              text="Subtract"
              onClick={() => {
                callbacks.handleAnnotationOptionsMenuSelection({ subtract: true }, 'subtract');
                onClose();
              }}
              disabled
            />
          </Menu>
        </div>
    );
});

export default AnnotationOptionsMenu;
