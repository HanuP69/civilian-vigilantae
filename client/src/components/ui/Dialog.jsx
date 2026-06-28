import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Dialog.css';

/**
 * Pixel-art Dialog/Modal component with RPG theme
 * Features: animated entrance/exit, pixel borders, focus trap, ESC to close
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // 'sm', 'md', 'lg', 'xl', 'full'
  variant = 'default', // 'default', 'quest', 'shop', 'warning', 'success'
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  footer,
}) {
  const dialogRef = React.useRef(null);
  const previousActiveElement = React.useRef(null);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      dialogRef.current?.focus();
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && closeOnEscape) {
          onClose?.();
        }
        if (e.key === 'Tab') {
          trapFocus(e);
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, closeOnEscape, onClose]);

  const trapFocus = (e) => {
    const focusableElements = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (!focusableElements?.length) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  const sizeClasses = {
    sm: 'dialog-sm',
    md: 'dialog-md',
    lg: 'dialog-lg',
    xl: 'dialog-xl',
    full: 'dialog-full',
  };

  const variantClasses = {
    default: 'dialog-default',
    quest: 'dialog-quest',
    shop: 'dialog-shop',
    warning: 'dialog-warning',
    success: 'dialog-success',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`dialog-overlay ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'dialog-title' : undefined}
        >
          <motion.div
            ref={dialogRef}
            className={`dialog-panel ${sizeClasses[size]} ${variantClasses[variant]}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            tabIndex={-1}
            role="document"
          >
            <div className="dialog-border">
              <div className="dialog-inner">
                {(title || showCloseButton) && (
                  <div className="dialog-header">
                    {title && (
                      <h2 id="dialog-title" className="dialog-title font-pixel">
                        {title}
                      </h2>
                    )}
                    {showCloseButton && (
                      <motion.button
                        className="dialog-close font-pixel"
                        onClick={onClose}
                        aria-label="Close dialog"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ×
                      </motion.button>
                    )}
                  </div>
                )}
                <div className="dialog-content">
                  {children}
                </div>
                {footer && (
                  <div className="dialog-footer">
                    {footer}
                  </div>
                )}
              </div>
            </div>
            {/* Pixel corner decorations */}
            <div className="dialog-corner dialog-corner-tl" />
            <div className="dialog-corner dialog-corner-tr" />
            <div className="dialog-corner dialog-corner-bl" />
            <div className="dialog-corner dialog-corner-br" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Confirmation Dialog - Pre-configured dialog for confirmations
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning', // 'warning', 'danger', 'info'
  loading = false,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      variant={variant}
      footer={
        <div className="dialog-footer-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            onClick={onConfirm} 
            disabled={loading}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <p className="dialog-message">{message}</p>
    </Dialog>
  );
}

/**
 * Alert Dialog - Simple alert with single button
 */
export function AlertDialog({
  isOpen,
  onClose,
  title = 'Notice',
  message,
  buttonText = 'OK',
  variant = 'info',
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      variant={variant}
      footer={
        <div className="dialog-footer-actions">
          <Button variant="primary" onClick={onClose}>
            {buttonText}
          </Button>
        </div>
      }
    >
      <p className="dialog-message">{message}</p>
    </Dialog>
  );
}

// Need to import React for useRef and useEffect
import React from 'react';