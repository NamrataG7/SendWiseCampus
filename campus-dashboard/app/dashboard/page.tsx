import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import EmptyDashboardState from '@/components/EmptyDashboardState';
import SignOutButton from '@/components/SignOutButton';
import StatsOverview from '@/components/StatsOverview';
import InsightsGrid from '@/components/insights/InsightsGrid';
import DrillDownRequestForm from '@/components/DrillDownRequestForm';
import { getChildrenForParent } from '@/lib/parent-store';
import {
  computeIncidentList,
  computeDashboardStats,
  computeInsightsAggregate,
} from '@/lib/insights-server';
import { payloadToChartData, emptyInsights } from '@/lib/insights-aggregates';

export const dynamic = 'force-dynamic';

/**
 * Campus dashboard — aggregate-first landing page.
 *
 * Wellbeing team members see cohort-level statistics only. No per-student
 * rows are rendered here. To view a specific student's incidents, the
 * team member must submit a drill-down request (dual-control approval
 * flow implemented by Supabase co-approval — Lane C) and, once approved,
 * navigate to /students/[user_id_hash].
 */
export default async function DashboardPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const metadata = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const wellbeingLabel =
    metadata.full_name || metadata.name || user.email || 'Wellbeing Team';

  // Cohort of students linked to this wellbeing-team account.
  // NOTE: underlying store key is retained (`getChildrenForParent`) — DB /
  // Redis identifiers are unchanged to preserve schema compatibility.
  const students = await getChildrenForParent(user.id);

  // State A — no students paired.
  if (students.length === 0) {
    const empty = emptyInsights();
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SendWise Campus</h1>
              <p className="text-sm text-gray-600">
                Wellbeing Team Dashboard — {wellbeingLabel}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">No student device linked</div>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-sm text-yellow-700">
              <strong>Aggregate-first mode:</strong> this dashboard shows
              cohort-level statistics only. Per-student detail requires an
              approved drill-down request.
            </p>
          </div>
          <EmptyDashboardState />
          <div className="mt-8">
            <InsightsGrid
              total={empty.total}
              trend={empty.trend}
              categoryDistribution={empty.categoryDistribution}
              severityDistribution={empty.severityDistribution}
              editedVsSent={empty.editedVsSent}
            />
          </div>
        </main>
      </div>
    );
  }

  // Aggregate cohort data — no per-student rows exposed here.
  const incidents = await computeIncidentList(students);
  const stats = computeDashboardStats(incidents);
  const insightsPayload = await computeInsightsAggregate(students);
  const charts = payloadToChartData(insightsPayload);

  const cohortLabel =
    students.length === 1 ? '1 student in cohort' : `${students.length} students in cohort`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SendWise Campus</h1>
            <p className="text-sm text-gray-600">
              Wellbeing Team Dashboard — {wellbeingLabel}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Cohort</p>
              <p className="font-semibold">{cohortLabel}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Aggregate-first view.</strong> Per-student incident details
            are hidden by default. To review an individual student, submit a
            drill-down request below — access is granted only after
            dual-control approval.
          </p>
        </div>

        {/* Cohort stats — no student identifiers */}
        <StatsOverview stats={stats} />

        {/* Recharts insights — category distribution, severity donut, trend */}
        <div className="mb-8">
          <InsightsGrid
            total={charts.total}
            trend={charts.trend}
            categoryDistribution={charts.categoryDistribution}
            severityDistribution={charts.severityDistribution}
            editedVsSent={charts.editedVsSent}
          />
        </div>

        {/* Drill-down request form */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Request drill-down
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Submit a reason and target student hash to open a dual-control
            review. A second wellbeing-team member must co-approve before
            per-student data is unlocked.
          </p>
          <DrillDownRequestForm />
        </section>
      </main>
    </div>
  );
}
