import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** When false, hides the X button and prevents Escape/overlay-click dismissal. */
  dismissable?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  dismissable = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);

    const prev = document.activeElement as HTMLElement | null;
    contentRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      prev?.focus();
    };
  }, [open, dismissable]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && dismissable) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full rounded-xl bg-white shadow-2xl outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {dismissable && (
              <IconButton
                onClick={onClose}
                variant="ghost"
                icon={<X className="h-5 w-5" />}
                label="Close dialog"
                className="text-gray-400 hover:text-gray-600"
              />
            )}
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
