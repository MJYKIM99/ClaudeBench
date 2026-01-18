import { ReactNode } from 'react';
import './TextShimmer.css';

interface TextShimmerProps {
  children: ReactNode;
  isActive?: boolean;
}

export function TextShimmer({ children, isActive = true }: TextShimmerProps) {
  if (!isActive) {
    return <span>{children}</span>;
  }

  return (
    <span className="text-shimmer">
      {children}
    </span>
  );
}
