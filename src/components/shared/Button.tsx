import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-gray-400',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-gray-400',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium',
  md: 'px-4 py-2 text-sm font-medium',
  lg: 'px-6 py-2.5 text-sm font-medium',
  icon: 'h-9 w-9 p-0',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

interface IconButtonProps
  extends Omit<ButtonProps, 'size' | 'leadingIcon' | 'trailingIcon'> {
  icon: ReactNode;
  label: string;
}

export function IconButton({
  icon,
  label,
  title,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      size="icon"
      aria-label={label}
      title={title ?? label}
      className={cx('p-0', props.className)}
    >
      {icon}
      {children}
    </Button>
  );
}
