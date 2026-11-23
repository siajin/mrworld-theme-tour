import type { Metadata } from "next";
import { DepartureTable } from "@/components/staff/departures/departure-table";

export const metadata: Metadata = { title: "출발일정" };

export default function StaffDeparturesPage() {
  return <DepartureTable />;
}
