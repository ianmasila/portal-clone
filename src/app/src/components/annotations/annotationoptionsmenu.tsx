import React, { useEffect, useState } from 'react';
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isVisible && !(event.target as HTMLElement).closest(styles.menu)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible]);

  if (!isVisible || !position) return null;

  return (
    <div className={styles.menu} style={{ top: `${position.x}px`, left: `${position.y}px` }}>
      <Menu>
        <MenuItem
          icon="intersection"
          text="Intersect"
          onClick={() => {
            callbacks.handleAnnotationOptionsMenuSelection({
              intersect: true,
            }, 'intersect');
            setIsVisible(false);
            alert("Select another annotation for Annotation Intersection");
          }}
        />
        <MenuItem
          icon="cross"
          text="Close"
          onClick={onClose}
          style={{ position: 'absolute', top: '0', right: '0' }}
        />
      </Menu>
    </div>
  );
};

export default AnnotationOptionsMenu;
