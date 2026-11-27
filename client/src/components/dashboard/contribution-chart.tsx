import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";

export interface ContributionDataPoint {
  month: string;
  amount: number;
  count: number;
  label: string;
}

interface ContributionChartProps {
  contributions: { amount: number; createdAt: string }[];
  formatAmount: (amount: number) => string;
  emptyMessage?: string;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ContributionChart({
  contributions,
  formatAmount,
  emptyMessage = "No contributions yet",
}: ContributionChartProps) {
  const data = useMemo(() => {
    if (!contributions?.length) return [];

    const byMonth = new Map<string, { amount: number; count: number }>();

    for (const c of contributions) {
      const d = typeof c.createdAt === "string" ? new Date(c.createdAt) : c.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key) ?? { amount: 0, count: 0 };
      byMonth.set(key, {
        amount: existing.amount + c.amount,
        count: existing.count + 1,
      });
    }

    return Array.from(byMonth.entries())
      .map(([month, { amount, count }]) => ({
        month,
        amount,
        count,
        label: format(parseISO(`${month}-01`), "MMM yyyy"),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // last 6 months
  }, [contributions]);

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
            }}
            formatter={(value: number) => [formatAmount(value), "Amount"]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
