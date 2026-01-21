// components/PlotlyCard.tsx
import Plot from "react-plotly.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlotlyCard({
  title,
  data,
  layout,
}: {
  title: string;
  data: any[];
  layout: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <Plot
          data={data}
          layout={{
            ...layout,
            autosize: true,
            margin: { t: 30, l: 40, r: 20, b: 40 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
          }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
          config={{ displayModeBar: false }}
        />
      </CardContent>
    </Card>
  );
}
