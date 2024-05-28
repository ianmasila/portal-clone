import React, { forwardRef } from 'react';
import { Callout, CalloutProps, Icon } from "@blueprintjs/core";
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import styles from './callout.module.css';

interface CalloutExtendedProps extends CalloutProps {
    show: boolean;
    center?: {
        x: number;
        y: number;
    }
    onClick?: () => void;
    onClose?: () => void;
}

const CalloutExtended: React.FC<CalloutExtendedProps> = forwardRef<HTMLDivElement, CalloutExtendedProps>(
    (
        { show, center, children, onClick = () => {}, onClose = () => {}, ...restProps },
        ref
    ) => {
        useOnClickOutside(ref, 'mouseup', onClose);     

        if (!show) {
            return null;
        }

        return (
            <div 
                className={styles.container} 
                ref={ref}
                style={center ? { position: 'absolute', left: center.x, top: center.y, transform: 'translateX(-50%, -50%)' } : {}}
                onClick={onClick}
            >
                <Callout {...restProps}>
                    {children}
                    {onClose ? (
                        <Icon
                            className={styles.rightIcon}
                            icon={'cross'}
                            onClick={onClose}
                        />
                    ) : null}
                </Callout>
            </div>
        );
    }
);

export default CalloutExtended;
