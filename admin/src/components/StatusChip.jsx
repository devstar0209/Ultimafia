import React from "react";
import { Chip } from "@mui/material";

const toneMap = {
  Active: "success",
  Approved: "success",
  Healthy: "success",
  Running: "success",
  Waiting: "info",
  Review: "warning",
  "Needs Review": "warning",
  Pending: "warning",
  Paused: "warning",
  Investigating: "error",
  Suspended: "error",
  Flagged: "error",
  Critical: "error",
  High: "warning",
  Medium: "info",
  Low: "default",
  "Changes Requested": "secondary",
};

export default function StatusChip({ label }) {
  return <Chip label={label} color={toneMap[label] || "default"} size="small" />;
}
