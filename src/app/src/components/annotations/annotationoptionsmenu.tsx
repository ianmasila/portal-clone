import React from 'react';
import { Menu, MenuItem } from '@blueprintjs/core';
import styles from './annotationoptionsmenu.module.css';

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

const AnnotationOptionsMenu: React.FC<AnnotationOptionsMenuProps> = ({ position, onClose, callbacks }) => {
  if (!position) {
    return null;
  }

  return (
    <div className={styles.menu} style={{ top: `${position.y - 21}px`, left: `${position.x + 24}px` }}>
      <Menu>
        <MenuItem
          icon="intersection"
          text="Intersect"
          onClick={() => {
            callbacks.handleAnnotationOptionsMenuSelection({
              intersect: true,
            }, 'intersect');
            onClose();
            alert("Select another annotation for Annotation Intersection");
          }}
        />
        <div className={styles.closebutton} >
          <MenuItem
            icon="cross"
            onClick={onClose}
          />
        </div>
      </Menu>
    </div>
  );
};

export default AnnotationOptionsMenu;
