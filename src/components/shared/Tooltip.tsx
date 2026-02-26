import { useState, useRef, useEffect, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    setPosition({
      top: triggerRect.top - tooltipRect.height - 8,
      left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
    });
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <HelpCircle className="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600" />
      )}
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[60] max-w-xs rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {content}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-800" />
        </div>
      )}
    </span>
  );
}
