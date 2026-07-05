import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-display font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-stamp focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';
    
    let variantStyles = '';
    switch (variant) {
      case 'primary':
        variantStyles = 'bg-ink text-paper hover:bg-ink/90 border border-ink';
        break;
      case 'secondary':
        variantStyles = 'bg-transparent text-ink border border-clay/40 hover:bg-clay/10';
        break;
      case 'danger':
        variantStyles = 'bg-oxblood text-paper hover:bg-oxblood/90 border border-oxblood';
        break;
      case 'ghost':
        variantStyles = 'bg-transparent text-ink hover:bg-clay/10';
        break;
    }

    let sizeStyles = '';
    switch (size) {
      case 'sm':
        sizeStyles = 'h-8 px-3 text-sm';
        break;
      case 'md':
        sizeStyles = 'h-10 px-4 py-2';
        break;
      case 'lg':
        sizeStyles = 'h-12 px-8 text-lg';
        break;
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
