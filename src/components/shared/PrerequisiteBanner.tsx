import { AlertTriangle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PrerequisiteBannerProps {
  severity: 'amber' | 'red';
  message: string;
  linkTo?: string;
  linkLabel?: string;
}

export default function PrerequisiteBanner({ severity, message, linkTo, linkLabel }: PrerequisiteBannerProps) {
  const isBlocking = severity === 'red';

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        isBlocking
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      {isBlocking ? (
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
      ) : (
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      )}
      <div className="flex-1">
        <p className={`text-sm ${isBlocking ? 'text-red-700' : 'text-amber-700'}`}>
          {message}
        </p>
        {linkTo && linkLabel && (
          <Link
            to={linkTo}
            className={`mt-1 inline-flex text-sm font-medium underline ${
              isBlocking ? 'text-red-800 hover:text-red-900' : 'text-amber-800 hover:text-amber-900'
            }`}
          >
            {linkLabel} &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
