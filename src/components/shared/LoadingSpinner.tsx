import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({
  className = '',
  inline = false,
}: {
  className?: string;
  inline?: boolean;
}) {
  if (inline) {
    return <Loader2 className={`animate-spin text-indigo-600 ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center p-12 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}
