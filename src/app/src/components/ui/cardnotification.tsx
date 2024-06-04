import React, { forwardRef } from 'react';
import { Card, CardProps, Icon } from "@blueprintjs/core";
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import styles from './cardnotification.module.css';

interface CardNotificationProps extends CardProps {
    show: boolean;
    center?: L.Point,
    onClick?: () => void;
    onClickOutside?: () => void;
    onClose?: () => void;
}

const CardNotification: React.FC<CardNotificationProps> = forwardRef<HTMLDivElement, CardNotificationProps>(
    (
        { show, center, children, onClick = () => {}, onClickOutside, onClose, ...restProps },
        ref
    ) => {
        useOnClickOutside(ref, 'mouseup', onClickOutside);     

        if (!show) {
            return null;
        }

        return (
            <div 
                className={styles.container} 
                ref={ref}
                style={center ? { left: center.x, top: center.y, transform: 'translate(-44%, 3%)' } : {}}
                onClick={onClick}
            >
                <Card {...restProps} className={styles.card}>
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

export default CardNotification;
