import React, { useEffect, useState } from 'react';
import { Menu, MenuItem } from '@blueprintjs/core';
import styles from './annotationoptionsmenu.module.css';

interface AnnotationOptionsMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onIntersect: () => void;
  callbacks: {
    HandleAnnotationOptionsMenuSelection: (value: any, key: string) => void;
  };
}

const AnnotationOptionsMenu: React.FC<AnnotationOptionsMenuProps> = ({ x, y, onClose, onIntersect, callbacks }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isVisible && !(event.target as HTMLElement).closest(styles.Menu)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible]);

  const openMenu = (x: number, y: number) => {
    setPosition({ x, y });
    setIsVisible(true);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.Menu} style={{ top: `${position.y}px`, left: `${position.x}px` }}>
      <Menu>
        <MenuItem
          icon="intersection"
          text="Intersect"
          onClick={() => {
            onIntersect();
            setIsVisible(false);
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
