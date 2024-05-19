import React, { useState } from 'react';
import { Alert, Intent, Menu, MenuItem } from '@blueprintjs/core';
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
  const [isIntersect, setIsIntersect] = useState<boolean>(false);
  console.log("🚀 ~ isIntersect:", isIntersect)

  if (!position) {
    return null;
  }

  return (
    <>
      <div className={styles.menu} style={{ top: `${position.y - 21}px`, left: `${position.x + 24}px` }}>
        <Menu>
          <MenuItem
            icon="intersection"
            text="Intersect"
            onClick={() => {
              callbacks.handleAnnotationOptionsMenuSelection({
                intersect: true,
              }, 'intersect');
              setIsIntersect(true);
              onClose();
              // alert("Select another annotation for Annotation Intersection");
            }}
          />
          <div className={styles.closeButton} >
            <MenuItem
              icon="cross"
              onClick={onClose}
            />
          </div>
        </Menu>
      </div>
      {/* <Alert
        isOpen={isIntersect}
        intent={Intent.PRIMARY}
        onCancel={() => setIsIntersect(false)}
        cancelButtonText={"Cancel"}
        className={"bp3-dark"}
      >
        <div>
          Select another annotation for Annotation Intersection
        </div>
      </Alert> */}
    </>
  );
};

export default AnnotationOptionsMenu;
