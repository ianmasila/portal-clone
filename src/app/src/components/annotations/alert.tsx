import React from "react";
import { Alert, Button, Icon } from "@blueprintjs/core";
import styles from './annotationoptionsmenu.module.css';

interface AlertProps {
    isOpen: boolean;
    onClose: () => void;
    icon: any;
    content: String;
}

const InfoAlert: React.FC<AlertProps> = ({ isOpen, onClose, icon, content }) => {
    return (
        <Alert isOpen={isOpen} onClose={onClose} className="bp3-dark">
            <div className={styles.container}>
                <Button
                    icon="cross"
                    minimal
                    onClick={onClose}
                    className={styles.closeButton}
                />
                <div>
                    {icon && <Icon icon={icon} style={{ marginRight: '10px' }} />} {content}
                </div>
            </div>
        </Alert>
    );
};

export default InfoAlert;
