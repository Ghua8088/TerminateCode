import React from 'react';
import { PytronModal, PytronButton } from 'pytron-ui/react';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, variant = 'danger' }) => {
    const Icon = variant === 'danger' ? AlertTriangle : variant === 'info' ? Info : HelpCircle;
    const iconColor = variant === 'danger' ? '#f44336' : variant === 'info' ? '#007fd4' : '#ff9800';

    return (
        <PytronModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width="400px"
            footer={
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
                    <PytronButton onClick={onClose} variant="secondary">
                        Cancel
                    </PytronButton>
                    <PytronButton
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                    >
                        {variant === 'danger' ? 'Delete' : 'Confirm'}
                    </PytronButton>
                </div>
            }
        >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '8px 0' }}>
                <div style={{ padding: '8px', background: `${iconColor}22`, borderRadius: '50%' }}>
                    <Icon size={24} color={iconColor} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#ccc' }}>
                        {message}
                    </p>
                </div>
            </div>
        </PytronModal>
    );
};

export default ConfirmModal;
