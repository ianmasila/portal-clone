import React, { useRef, useEffect, forwardRef } from 'react';
import styles from './selectionbox.module.css';

interface SelectionBoxProps {
    callback: () => void;
}

const SelectionBox = forwardRef<HTMLDivElement, SelectionBoxProps>(
    ({ callback }, ref) => {
        return (
            <div className={styles.selectionBox} ref={ref}>

            </div>
        );
    }
);

export default SelectionBox;
