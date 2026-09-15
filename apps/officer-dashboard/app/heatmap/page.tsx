import { Show } from "@clerk/nextjs";
import { HeatmapPage } from "../../components/heatmap-page";
import { OfficerAuth } from "../../components/officer-auth";

export default function OfficerHeatmapPage() {
  return (
    <>
      <Show when="signed-out"><OfficerAuth /></Show>
      <Show when="signed-in"><HeatmapPage /></Show>
    </>
  );
}

