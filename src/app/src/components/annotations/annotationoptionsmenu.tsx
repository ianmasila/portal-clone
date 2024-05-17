import React, { useState } from 'react';
import { Menu, MenuItem } from '@blueprintjs/core';
import styles from './annotationoptionsmenu.module.css';
import { PolylineObjectType } from './utils/annotation';

interface OptionsMenuProps {
  x: number;
  y: number;
  layer: L.Layer | any,
  onIntersect: () => void;
  onClose: () => void;
}

const AnnotationOptionsMenu: React.FC<OptionsMenuProps> = ({ x, y, layer, onIntersect, onClose}) => {
  const [selectedAnnotation, setSelectedAnnotation] = useState<PolylineObjectType>();
  const [otherAnnotation, setOtherAnnotation] = useState<PolylineObjectType>();

  const handleIntersect = () => {
    onIntersect();
  }
  const handleClose = () => {
    document.removeChild(layer);
    onClose();
  }
  return (
    <div className={styles.Menu} style={{ top: y, left: x }}>
        <Menu>
            <MenuItem
                icon="intersection"
                text="Intersect"
                onClick={handleIntersect}
            />
            <MenuItem
                icon="cross"
                text="Close"
                onClick={handleClose}
                style={{ position: 'absolute', top: '0', right: '0' }}
            />
        </Menu>
    </div>
  );
};

export default AnnotationOptionsMenu;
