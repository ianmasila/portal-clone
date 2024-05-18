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
    if (position) {
      setIsVisible(true);
    }
  }, [position])

  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     if (isVisible && !(event.target as HTMLElement).closest(styles.menu)) {
  //       setIsVisible(false);
  //     }
  //   };

  //   document.addEventListener('click', handleClickOutside);

  //   return () => {
  //     document.removeEventListener('click', handleClickOutside);
  //   };
  // }, [isVisible]);

  if (!isVisible || !position) return null;

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
            setIsVisible(false);
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
