import React from 'react';
import { Icon, Menu, MenuItem } from '@blueprintjs/core';
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
  // @TODO: Remove close button and close when user clicks outside menu
  // const menuRef = useRef<HTMLDivElement | null>(null);

  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     console.log('handle...');
  //     if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
  //       console.log("clicked outside.")
  //       onClose();
  //     }
  //   };

  //   document.addEventListener('mousedown', handleClickOutside);
  //   return () => {
  //     document.removeEventListener('mousedown', handleClickOutside);
  //   };
  // }, [onClose]);

  if (!position) {
    return null;
  }

  return (
      <div className={styles.menu} style={{ top: `${position.y - 21}px`, left: `${position.x + 24}px` }}>
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
        <div className={styles.closeButton} onClick={onClose}>
          <Icon icon="cross" iconSize={14} />
        </div>
      </div>
  );
};

export default AnnotationOptionsMenu;
