"use client";
/**
 * ProficiencyBarChart
 * Renders class proficiency by CCSS standard as a horizontal bar chart.
 * Standards below threshold shown in red; above in green.
 * Suppressed groups (N < 5) shown with a dashed pattern and tooltip.
 * Bars show percentage labels and are clickable.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { PROFICIENCY_THRESHOLD_PCT, PARTIAL_PROFICIENCY_THRESHOLD_PCT } from "@/lib/constants";

interface StandardData {
  standard: string;
  proficiency: number;
  student_count: number;
  suppressed: boolean;
}

interface Props {
  data: StandardData[];
  height?: number;
  onBarClick?: (standard: string) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as StandardData;
    return (
      <div className="bg-white border border-gray-200 rounded shadow p-3 text-sm">
        <p className="font-semibold text-gray-800">{d.standard}</p>
        {d.suppressed ? (
          <p className="text-gray-500 italic">N&lt;5 — data suppressed to protect privacy</p>
        ) : (
          <>
            <p className="text-gray-700">Proficiency: <span className="font-medium">{d.proficiency}%</span></p>
            <p className="text-gray-500">Students assessed: {d.student_count}</p>
            <p className="text-blue-600 text-xs mt-1">Click for detailed breakdown →</p>
          </>
        )}
      </div>
    );
  }
  return null;
};

const BarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (width < 35) {
    // Label outside bar if bar is too small
    return (
      <text
        x={x + width + 4}
        y={y + height / 2}
        fill="#6B7280"
        fontSize={11}
        fontWeight={600}
        dominantBaseline="central"
      >
        {value}%
      </text>
    );
  }
  return (
    <text
      x={x + width - 6}
      y={y + height / 2}
      fill="#FFFFFF"
      fontSize={11}
      fontWeight={700}
      dominantBaseline="central"
      textAnchor="end"
    >
      {value}%
    </text>
  );
};

export default function ProficiencyBarChart({ data, height = 400, onBarClick }: Props) {
  const handleClick = (entry: any) => {
    if (onBarClick && entry && entry.standard) {
      onBarClick(entry.standard);
    }
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 50, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="standard"
            tick={{ fontSize: 11 }}
            width={115}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={PROFICIENCY_THRESHOLD_PCT}
            stroke="#F59E0B"
            strokeDasharray="5 5"
            label={{ value: `Target ${PROFICIENCY_THRESHOLD_PCT}%`, position: "top", fontSize: 11, fill: "#F59E0B" }}
          />
          <Bar
            dataKey="proficiency"
            radius={[0, 4, 4, 0]}
            onClick={handleClick}
            style={{ cursor: onBarClick ? "pointer" : "default" }}
          >
            <LabelList dataKey="proficiency" content={<BarLabel />} />
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.suppressed
                    ? "#D1D5DB"
                    : entry.proficiency >= PROFICIENCY_THRESHOLD_PCT
                    ? "#10B981"
                    : entry.proficiency >= PARTIAL_PROFICIENCY_THRESHOLD_PCT
                    ? "#F59E0B"
                    : "#EF4444"
                }
                opacity={entry.suppressed ? 0.5 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Proficient (80–100%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-sm inline-block" /> Partially Proficient (60–79%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block" /> Not Proficient (0–59%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded-sm inline-block" /> N&lt;5 suppressed</span>
      </div>
      {onBarClick && (
        <p className="text-center text-xs text-muted-foreground mt-1">Click a bar to see the detailed breakdown</p>
      )}
    </div>
  );
}
