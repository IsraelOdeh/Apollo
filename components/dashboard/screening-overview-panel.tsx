// components/dashboard/screening-overview-panel.tsx
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/layout/panel";
import { InfoHelp } from "@/components/layout/neuroedge-logo";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/storage/db";

const SERIES = [
  { key: "screenings", label: "Screenings", color: "#42D9F5" },
  { key: "candidates", label: "Candidate events", color: "#F6BD60" },
  { key: "awaitingReview", label: "Awaiting review", color: "#9D85FF" },
] as const;

export function ScreeningOverviewPanel() {
  const overview = useLiveQuery(async () => {
    const [recordings, sessions, events] = await Promise.all([
      db.recordings.toArray(),
      db.screening_sessions.toArray(),
      db.detected_events.toArray(),
    ]);

    const completedSessions = sessions.filter(
      (session) => session.status === "completed",
    );
    const candidateEvents = events.filter(
      (event) =>
        event.event_type === "ied_candidate" ||
        event.event_type === "seizure_candidate",
    );
    const awaitingReview = candidateEvents.filter(
      (event) => event.review_status === "pending" || event.review_status === "uncertain",
    );

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const telemetry = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(end);
      day.setDate(end.getDate() - (6 - index));
      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const countInDay = (dates: Date[]) =>
        dates.filter((date) => {
          const timestamp = new Date(date).getTime();
          return timestamp >= day.getTime() && timestamp < nextDay.getTime();
        }).length;

      return {
        day: day.toLocaleDateString(undefined, { weekday: "short" }),
        screenings: countInDay(
          completedSessions.map((session) => session.completed_at ?? session.started_at),
        ),
        candidates: countInDay(candidateEvents.map((event) => event.created_at)),
        awaitingReview: countInDay(awaitingReview.map((event) => event.created_at)),
      };
    });

    return {
      recordingCount: recordings.length,
      screeningCount: completedSessions.length,
      candidateCount: candidateEvents.length,
      awaitingReviewCount: awaitingReview.length,
      telemetry,
    };
  }, []);

  const totalRecordings = overview?.recordingCount ?? 0;
  const totalScreenings = overview?.screeningCount ?? 0;
  const totalCandidates = overview?.candidateCount ?? 0;
  const totalAwaitingReview = overview?.awaitingReviewCount ?? 0;

  const TOTALS = [
    { label: "Total recordings", value: totalRecordings.toLocaleString() },
    { label: "Screenings performed", value: totalScreenings.toLocaleString() },
    { label: "Candidate events flagged", value: totalCandidates.toLocaleString() },
    { label: "Awaiting review", value: totalAwaitingReview.toLocaleString() },
  ];

  return (
    <Panel
      title="Screening Overview"
      eyebrow="7-day telemetry"
      actions={
        <InfoHelp title="Screening Telemetry">
          <p>
            Tracks total EDF recordings processed by the on-device DSP pipeline,
            flagged epileptiform candidates, and sessions awaiting clinician
            verification.
          </p>
        </InfoHelp>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {TOTALS.map((total) => (
          <div
            key={total.label}
            className="rounded-xl border border-ne-line bg-ne-bg2 px-3 py-2.5"
          >
            <p className="font-mono text-lg font-semibold text-ne-fg">
              {total.value}
            </p>
            <p className="text-[11px] leading-tight text-ne-fg-2">
              {total.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={overview?.telemetry ?? []}
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
          >
            <defs>
              {SERIES.map((series) => (
                <linearGradient
                  key={series.key}
                  id={`ne-area-${series.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={series.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={series.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "#F0F4F8" }}
              itemStyle={{ color: "#A1ADBC" }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: "#64748B" }}
            />
            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={1.8}
                fill={`url(#ne-area-${series.key})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
