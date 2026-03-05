import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

type NoticeSeverity = 'error' | 'warning' | 'success' | 'info';

interface InlineNoticeProps {
  severity: NoticeSeverity;
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}

const STYLE_MAP: Record<
  NoticeSeverity,
  { container: string; icon: string; title: string; body: string }
> = {
  error: {
    container: 'border-red-200 bg-red-50',
    icon: 'text-red-500',
    title: 'text-red-800',
    body: 'text-red-700',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    body: 'text-amber-700',
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-500',
    title: 'text-emerald-800',
    body: 'text-emerald-700',
  },
  info: {
    container: 'border-indigo-200 bg-indigo-50',
    icon: 'text-indigo-500',
    title: 'text-indigo-800',
    body: 'text-indigo-700',
  },
};

function NoticeIcon({ severity }: { severity: NoticeSeverity }) {
  if (severity === 'error') return <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />;
  if (severity === 'success') return <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />;
  if (severity === 'info') return <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />;
  return <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />;
}

export default function InlineNotice({
  severity,
  title,
  message,
  action,
  className,
}: InlineNoticeProps) {
  const styles = STYLE_MAP[severity];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${styles.container} ${className ?? ''}`}
      role="status"
    >
      <div className={styles.icon}>
        <NoticeIcon severity={severity} />
      </div>
      <div className="flex-1">
        {title && <p className={`text-sm font-medium ${styles.title}`}>{title}</p>}
        <div className={`text-sm ${styles.body}`}>{message}</div>
      </div>
      {action && <div className="ml-2">{action}</div>}
    </div>
  );
}
