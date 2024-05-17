import React from 'react';
import { Menu, MenuItem } from '@blueprintjs/core';
import styles from './annotationoptionsmenu.module.css';

interface OptionsMenuProps {
  x: number;
  y: number;
  onIntersect: () => void;
  onClose: () => void;
}

const AnnotationOptionsMenu: React.FC<OptionsMenuProps> = ({ x, y, onIntersect, onClose }) => {
  return (
    <div className={styles.Menu} style={{ top: y, left: x }}>
        <Menu>
            <MenuItem
                icon="intersection"
                text="Intersect"
                onClick={() => {
                onIntersect();
                onClose();
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
