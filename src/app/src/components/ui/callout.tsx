import React, { forwardRef } from 'react';
import { Card, CardProps, Icon } from "@blueprintjs/core";
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import styles from './callout.module.css';

interface CalloutExtendedProps extends CardProps {
    show: boolean;
    center?: {
        x: number;
        y: number;
    }
    onClick?: () => void;
    onClickOutside?: () => void;
    onClose?: () => void;
}

const CalloutExtended: React.FC<CalloutExtendedProps> = forwardRef<HTMLDivElement, CalloutExtendedProps>(
    (
        { show, center, children, onClick = () => {}, onClickOutside, onClose, ...restProps },
        ref
    ) => {
        console.log("🚀 ~ show:", show);
        useOnClickOutside(ref, 'mouseup', onClickOutside);     

        if (!show) {
            return null;
        }

        return (
            <div 
                className={styles.container} 
                ref={ref}
                style={center ? { left: center.x, top: center.y, transform: 'translate(-50%, -50%)' } : {}}
                onClick={onClick}
            >
                <Card {...restProps} className={styles.callout}>
                    {children}
                    {onClose ? (
                        <Icon
                            className={styles.rightIcon}
                            icon={'small-cross'}
                            onClick={onClose}
                        />
                    ) : null}
                </Card>
            </div>
        );
    }
);

export default CalloutExtended;