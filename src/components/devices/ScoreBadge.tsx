import { getScoreColor, getScoreLabel } from '../../lib/types';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  const dimensions = {
    sm: { outer: 36, inner: 30, fontSize: 11, strokeWidth: 3 },
    md: { outer: 48, inner: 40, fontSize: 14, strokeWidth: 4 },
    lg: { outer: 80, inner: 68, fontSize: 24, strokeWidth: 6 },
  }[size];

  const radius = (dimensions.inner - dimensions.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = dimensions.outer / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1" title={`${label}: ${score}/100`}>
      <svg width={dimensions.outer} height={dimensions.outer}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={dimensions.strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={dimensions.strokeWidth}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={dimensions.fontSize}
          fontWeight="700"
          fill={color}
        >
          {score}
        </text>
      </svg>
      {size === 'lg' && (
        <span className="text-sm font-medium" style={{ color }}>{label}</span>
      )}
    </div>
  );
}
