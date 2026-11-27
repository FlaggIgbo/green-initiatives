import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// TODO(Alpaca Portfolio): Upgrade FundingBreakdownChart to render live ESG ETF sleeve weights
// (e.g., ICLN, TAN, NEE, ESGU, PHO, WM) and unrealized P&L from GET /api/portfolio/positions.

export interface FundingBreakdownItem {
  name: string;
  value: number;
  projectId: string;
}

interface FundingBreakdownChartProps {
  projects: { id: string; title: string; currentFunding: number }[];
  formatAmount: (amount: number) => string;
  emptyMessage?: string;
}

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function FundingBreakdownChart({
  projects,
  formatAmount,
  emptyMessage = "No projects with funding yet",
}: FundingBreakdownChartProps) {
  const data = useMemo(() => {
    if (!projects?.length) return [];

    return projects
      .filter((p) => (p.currentFunding ?? 0) > 0)
      .map((p) => ({
        name: p.title.length > 20 ? p.title.slice(0, 20) + "…" : p.title,
        value: p.currentFunding ?? 0,
        projectId: p.id,
        fullName: p.title,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // top 6 projects
  }, [projects]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
            }}
            formatter={(value: number, _: unknown, props: { payload?: { fullName: string } }) => [
              formatAmount(value),
              props.payload?.fullName ?? "",
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
