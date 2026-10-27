import React, { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  Users, 
  PhoneCall, 
  Clock, 
  ArrowRight, 
  Plus, 
  TrendingUp, 
  Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { useData } from '../context/DataContext';
import { formatDisplayDate, formatDuration } from '../lib/dateUtils';
import { STAGES_CONFIG } from '../data/stageDefinitions';

interface OutletContextType {
  openNewProspectModal: () => void;
  openNewFollowUpModal: () => void;
}

// 9 Official Objection Taxonomy Categories
const OBJECTION_CATEGORIES: { id: string; label: string; shortLabel: string }[] = [
  { id: 'timing_or_capacity', label: '1. Timing or capacity constraint', shortLabel: 'Timing / Capacity' },
  { id: 'existing_internal_process', label: '2. Existing internal process', shortLabel: 'Internal Process' },
  { id: 'existing_provider_or_alternative', label: '3. Existing provider / Rate contract', shortLabel: 'Existing Provider' },
  { id: 'wrong_contact_or_authority', label: '4. Wrong contact / No authority', shortLabel: 'No Authority' },
  { id: 'poor_fit_or_scope', label: '5. Poor fit / Scope mismatch', shortLabel: 'Poor Fit' },
  { id: 'commercial_intent_unclear', label: '6. Commercial intent / ROI unclear', shortLabel: 'Commercial / ROI' },
  { id: 'explicit_not_interested', label: '7. Explicitly not interested', shortLabel: 'Not Interested' },
  { id: 'do_not_contact_requested', label: '8. Do not contact requested', shortLabel: 'Do Not Contact' },
  { id: 'other_or_unclear', label: '9. Other / Unclear objection', shortLabel: 'Other / Unclear' },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { openNewProspectModal } = useOutletContext<OutletContextType>();
  const { 
    calls, 
    followUps, 
    metrics 
  } = useData();

  // 1. Calculate Eight-Stage Funnel Metrics strictly from actual persisted calls
  const funnelMetrics = useMemo(() => {
    const totalCalls = calls.length;

    return STAGES_CONFIG.map((stage) => {
      const stageNum = stage.stageNumber;
      // Reached Stage N = eligible calls with furthest_stage_reached >= N
      const reachedCount = calls.filter(c => (c.furthestStageReached || 1) >= stageNum).length;

      // Reached percentage against total calls
      const reachedRate = totalCalls > 0 ? ((reachedCount / totalCalls) * 100).toFixed(1) : '—';

      // Advanced from Stage N = reached at least Stage N + 1
      let advancedCount: number | null = null;
      let dropOffCount: number | null = null;
      let dropOffRate: string = '—';

      if (stageNum < 8) {
        advancedCount = calls.filter(c => (c.furthestStageReached || 1) >= stageNum + 1).length;
        dropOffCount = reachedCount - advancedCount;
        dropOffRate = reachedCount > 0 
          ? ((dropOffCount / reachedCount) * 100).toFixed(1)
          : '—';
      }

      return {
        stageNumber: stageNum,
        name: stage.name,
        shortName: stage.shortName,
        reachedCount,
        reachedRate,
        advancedCount,
        dropOffCount,
        dropOffRate,
      };
    });
  }, [calls]);

  // 2. Calculate 9-Category Objection Breakdown from recorded stage 6 events
  const objectionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    OBJECTION_CATEGORIES.forEach(cat => { counts[cat.id] = 0; });

    let totalRecordedObjections = 0;

    calls.forEach(call => {
      if (call.stageEvents && Array.isArray(call.stageEvents)) {
        call.stageEvents.forEach(e => {
          if (e.stageNumber === 6 && counts[e.eventType] !== undefined) {
            counts[e.eventType]++;
            totalRecordedObjections++;
          }
        });
      }
    });

    return {
      total: totalRecordedObjections,
      categories: OBJECTION_CATEGORIES.map(cat => {
        const count = counts[cat.id] || 0;
        const percentage = totalRecordedObjections > 0 
          ? ((count / totalRecordedObjections) * 100).toFixed(1) 
          : '—';
        return {
          ...cat,
          count,
          percentage,
        };
      }),
    };
  }, [calls]);

  // 3. Outcomes & Lifecycle Breakdown
  const lifecycleBreakdown = useMemo(() => {
    const totalCalls = calls.length;
    const completed = calls.filter(c => c.callStatus === 'Completed').length;
    const inProgress = calls.filter(c => c.callStatus === 'In Progress').length;
    const earlyEnded = calls.filter(c => c.callStatus === 'Completed' && (c.endingStage || 1) < 8).length;
    const withReview = calls.filter(c => c.hasReview).length;

    // Outcome counts
    const outcomeCounts: Record<string, number> = {};
    calls.forEach(c => {
      const oc = c.outcome || 'Pending Outcome';
      outcomeCounts[oc] = (outcomeCounts[oc] || 0) + 1;
    });

    return {
      totalCalls,
      completed,
      inProgress,
      earlyEnded,
      withReview,
      outcomeCounts,
    };
  }, [calls]);

  // Recent calls (sorted latest first)
  const recentCalls = useMemo(() => {
    return [...calls]
      .sort((a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime())
      .slice(0, 4);
  }, [calls]);

  // Upcoming follow-ups
  const upcomingFollowUps = useMemo(() => {
    return [...followUps]
      .filter(f => f.status === 'Pending')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 4);
  }, [followUps]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 shrink-0 border border-indigo-200">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Manufacturing Discovery Analytics & Funnel Conversion
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Performance metrics and conversion tracking across active accounts, call outcomes, and pipeline stages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={openNewProspectModal}
          >
            Add Prospect
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<PhoneCall className="h-4 w-4" />}
            onClick={() => navigate('/workspace')}
          >
            Live Call Workspace
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Prospects */}
        <Card className="hover:border-slate-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Prospects
              </span>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {metrics.totalProspects}
              </span>
              <span className="text-xs text-slate-500">accounts</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>{metrics.inDiscussionProspects} In Discussion</span>
              <span className="text-emerald-600 font-medium">{metrics.qualifiedProspects} Qualified</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Persisted Calls */}
        <Card className="hover:border-slate-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Calls Logged
              </span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <PhoneCall className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {calls.length}
              </span>
              <span className="text-xs text-slate-500">records</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>{lifecycleBreakdown.completed} Completed</span>
              <span className="text-amber-600 font-medium">{lifecycleBreakdown.inProgress} In Progress</span>
            </div>
          </CardContent>
        </Card>

        {/* Early vs Stage 8 Completion */}
        <Card className="hover:border-slate-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Early Terminations
              </span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {lifecycleBreakdown.earlyEnded}
              </span>
              <span className="text-xs text-slate-500">ended &lt; Stage 8</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>Calls ended before Stage 8</span>
              <span className="text-slate-600 font-medium">{calls.length > 0 ? Math.round((lifecycleBreakdown.earlyEnded / calls.length) * 100) : 0}% of calls</span>
            </div>
          </CardContent>
        </Card>

        {/* AI Reviews Available */}
        <Card className="hover:border-slate-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gemini AI Reviews
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {lifecycleBreakdown.withReview}
              </span>
              <span className="text-xs text-slate-500">synthesized</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>Grounded coaching</span>
              <span className="text-emerald-600 font-medium">{followUps.filter(f => f.status === 'Pending').length} follow-ups active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FEATURE E: Eight-Stage Funnel Analytics Card */}
      <Card>
        <CardHeader
          title="Eight-Stage Cold Call Progression Funnel"
          description="Strict drop-off rates and progression metrics based only on furthest_stage_reached from saved call records."
        />
        <CardContent className="p-5 sm:p-6 space-y-4">
          {calls.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No call records recorded yet. Log live calls in the Call Workspace to generate funnel conversion analytics.
            </div>
          ) : (
            <div className="space-y-3">
              {funnelMetrics.map((item) => {
                const isStage8 = item.stageNumber === 8;
                const percentageNum = parseFloat(item.reachedRate) || 0;

                return (
                  <div key={item.stageNumber} className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {item.stageNumber}
                        </span>
                        <span className="font-bold text-slate-800">
                          Stage {item.stageNumber}: {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                        <span>Reached: <strong className="text-slate-900">{item.reachedCount}</strong> ({item.reachedRate}%)</span>
                        {!isStage8 && (
                          <span className="text-slate-500">
                            Drop-off to Stage {item.stageNumber + 1}: <strong className="text-rose-600">{item.dropOffCount}</strong> ({item.dropOffRate}%)
                          </span>
                        )}
                        {isStage8 && (
                          <span className="text-emerald-700 font-medium">
                            Full Discovery Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-linear-to-r from-indigo-500 to-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, percentageNum)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: Objection Taxonomy Breakdown & Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objection Taxonomy Distribution (9 Categories) */}
        <Card>
          <CardHeader
            title="9-Category Objection Taxonomy Distribution"
            description="Categorization of prospect resistance recorded during Stage 6 (Objection) action taps."
          />
          <CardContent className="p-5 space-y-3">
            {objectionBreakdown.total === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No Stage 6 objection events logged yet. Tapping objection categories during live calls populates this chart.
              </div>
            ) : (
              <div className="space-y-2.5">
                {objectionBreakdown.categories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate">{cat.label}</span>
                      <span className="font-mono text-slate-500 shrink-0">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${cat.percentage === '—' ? 0 : cat.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Outcomes & Follow-Ups Summary */}
        <Card>
          <CardHeader
            title="Outcomes & Operational Follow-Ups"
            description="Business results recorded across discovery calls and scheduled next commitments."
          />
          <CardContent className="p-5 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Recorded Call Outcomes
              </span>
              <div className="space-y-2">
                {Object.entries(lifecycleBreakdown.outcomeCounts).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No call outcomes logged yet.</p>
                ) : (
                  Object.entries(lifecycleBreakdown.outcomeCounts).map(([outcome, count]) => (
                    <div key={outcome} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                      <Badge status={outcome} size="sm" />
                      <span className="font-bold text-slate-800">{count} calls</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Upcoming Follow-Up Schedule
              </span>
              {upcomingFollowUps.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No pending follow-up tasks.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingFollowUps.map(fu => (
                    <div key={fu.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 block truncate">{fu.task}</span>
                        <span className="text-[11px] text-slate-500">{fu.companyName} • Due {fu.dueDate}</span>
                      </div>
                      <Badge status={fu.priority} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls Section */}
      <Card>
        <CardHeader
          title="Recent Live Call Records"
          description="Latest manufacturing discovery sessions saved to database"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowRight className="h-4 w-4" />}
              iconPosition="right"
              onClick={() => navigate('/history')}
            >
              Inspect All History
            </Button>
          }
        />
        <CardContent className="p-0">
          {recentCalls.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<PhoneCall className="h-6 w-6" />}
                title="No calls logged yet"
                description="Launch the Call Workspace to prepare and log your first sales conversation."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/workspace')}
                  >
                    Go to Call Workspace
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  onClick={() => navigate('/history')}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 text-sm truncate">
                        {call.companyName}
                      </h4>
                      <Badge status={call.callStatus} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {call.contactName ? `${call.contactName} • ` : ''}
                      Furthest: Stage {call.furthestStageReached || 1} • {call.callObjective || 'Discovery'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                    <div className="text-right">
                      <span className="block font-medium text-slate-800">
                        {formatDisplayDate(call.callDate)}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {formatDuration(call.durationSeconds)}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
