// components/site-cockpit/cards/optimization/components/Charts/PerformanceChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PerformanceTimelineProps } from "../../types";

export function PerformanceChart({
  history,
  current,
}: PerformanceTimelineProps) {
  // Prepare chart data
  const chartData = [
    ...history.map((entry) => ({
      date: entry.timestamp.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      timestamp: entry.timestamp.getTime(),
      score: entry.after.score,
      pageWeight: Math.round(entry.after.pageWeight / 1024), // Convert to KB
      loadTime: entry.after.loadTime,
      label: entry.type,
    })),
    {
      date: "Now",
      timestamp: Date.now(),
      score: current.score,
      pageWeight: Math.round(current.pageWeight / 1024),
      loadTime: current.loadTime,
      label: "current",
    },
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <div className="text-xs text-gray-400 mb-2">{data.date}</div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-blue-400">Score:</span>
              <span className="text-sm font-semibold text-white">
                {data.score}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-green-400">Page Size:</span>
              <span className="text-sm font-semibold text-white">
                {data.pageWeight} KB
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-purple-400">Load Time:</span>
              <span className="text-sm font-semibold text-white">
                {data.loadTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {data.label && data.label !== "current" && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="text-xs text-orange-400 capitalize">
                {data.label.replace("-", " ")}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (chartData.length < 2) {
    return (
      <div className="p-8 rounded-lg bg-gray-800/40 border border-gray-700/50 text-center">
        <div className="text-gray-400 mb-2">📈 Performance Timeline</div>
        <div className="text-sm text-gray-500">
          Run optimizations to see your performance improve over time
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white mb-1">
          Performance Timeline
        </h3>
        <p className="text-sm text-gray-400">
          Track improvements after each optimization
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: "12px" }} />

          <YAxis
            yAxisId="left"
            stroke="#9CA3AF"
            style={{ fontSize: "12px" }}
            label={{
              value: "Score",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#9CA3AF" },
            }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#9CA3AF"
            style={{ fontSize: "12px" }}
            label={{
              value: "Page Size (KB)",
              angle: 90,
              position: "insideRight",
              style: { fill: "#9CA3AF" },
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
            iconType="line"
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="score"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: "#3B82F6", r: 4 }}
            activeDot={{ r: 6 }}
            name="Performance Score"
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="pageWeight"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: "#10B981", r: 4 }}
            activeDot={{ r: 6 }}
            name="Page Size (KB)"
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="loadTime"
            stroke="#A855F7"
            strokeWidth={2}
            dot={{ fill: "#A855F7", r: 4 }}
            activeDot={{ r: 6 }}
            name="Load Time (s)"
            hide={true} // Hidden by default but available in tooltip
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend for optimizations */}
      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="text-xs text-gray-500 mb-2">
            Optimization History:
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className="px-2 py-1 rounded bg-gray-700/50 text-xs text-gray-300"
              >
                {index + 1}. {entry.type.replace("-", " ")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
