import { DashboardStats } from '@/lib/types';
import { DEFAULT_K } from '@/lib/privacy/k-anonymity';

/**
 * Extended stats shape emitted by `computeDashboardStatsKAnonymous`.
 * Suppressed fields are rendered as "insufficient data (k<N)" per the
 * k-anonymity floor (Sweeney 2002, "k-Anonymity: A Model for Protecting
 * Privacy").
 */
interface KAnonymizedStatsLike extends DashboardStats {
  suppressed?: {
    totalIncidents?: boolean;
    criticalIncidents?: boolean;
    highPriorityIncidents?: boolean;
    messagesPrevented?: boolean;
  };
  kFloor?: number;
}

interface StatsOverviewProps {
  stats: KAnonymizedStatsLike;
  kFloor?: number;
}

function Tile({
  label,
  value,
  suppressed,
  kFloor,
  colorClass,
  textClass,
  captionClass,
  caption,
  icon,
}: {
  label: string;
  value: number;
  suppressed: boolean;
  kFloor: number;
  colorClass: string;
  textClass: string;
  captionClass: string;
  caption: string;
  icon: string;
}) {
  const tooltip = `k-anonymity floor (Sweeney 2002): a bucket with fewer than ${kFloor} events is suppressed so it cannot single out an individual student.`;
  return (
    <div className={`${colorClass} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`${textClass} text-sm font-semibold uppercase`}>{label}</p>
          {suppressed ? (
            <p
              className="text-sm font-semibold text-gray-500 mt-2"
              title={tooltip}
              aria-label={tooltip}
            >
              insufficient data (k&lt;{kFloor})
              <span className="ml-1 text-gray-400" aria-hidden>ⓘ</span>
            </p>
          ) : (
            <p className={`text-3xl font-bold ${textClass.replace('-600', '-700')}`}>{value}</p>
          )}
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
      <p className={`text-xs mt-2 ${captionClass}`}>{caption}</p>
    </div>
  );
}

export default function StatsOverview({ stats, kFloor = DEFAULT_K }: StatsOverviewProps) {
  const s = stats.suppressed ?? {};
  const k = stats.kFloor ?? kFloor;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Tile
        label="Critical"
        value={stats.criticalIncidents}
        suppressed={!!s.criticalIncidents}
        kFloor={k}
        colorClass="bg-red-50 border-2 border-red-200"
        textClass="text-red-600"
        captionClass="text-red-600"
        caption="Requires immediate action"
        icon="🚨"
      />
      <Tile
        label="High Priority"
        value={stats.highPriorityIncidents}
        suppressed={!!s.highPriorityIncidents}
        kFloor={k}
        colorClass="bg-orange-50 border-2 border-orange-200"
        textClass="text-orange-600"
        captionClass="text-orange-600"
        caption="Needs attention soon"
        icon="⚠️"
      />
      <Tile
        label="Prevented"
        value={stats.messagesPrevented}
        suppressed={!!s.messagesPrevented}
        kFloor={k}
        colorClass="bg-green-50 border-2 border-green-200"
        textClass="text-green-600"
        captionClass="text-green-600"
        caption="Harmful messages stopped"
        icon="✅"
      />
      <Tile
        label="Total"
        value={stats.totalIncidents}
        suppressed={!!s.totalIncidents}
        kFloor={k}
        colorClass="bg-blue-50 border-2 border-blue-200"
        textClass="text-blue-600"
        captionClass="text-blue-600"
        caption="Last 7 days"
        icon="📊"
      />
    </div>
  );
}
