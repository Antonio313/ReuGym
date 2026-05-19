type SkeletonCardProps = {
  height?: string;
  className?: string;
};

export function SkeletonCard({ height = '5rem', className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{
        height,
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
      }}
    />
  );
}
