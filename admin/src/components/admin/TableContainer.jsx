import React from "react";
import { Box } from "@mui/material";

export default function TableContainer({ children }) {
  return (
    <Box
      sx={{
        overflowX: "auto",
        "& .MuiTable-root": {
          minwidth: 640,
        },
        "& .MuiTableCell-head": {
          color: "secondary.light",
          fontWeight: 800,
          borderBottomColor: "rgba(255,255,255,0.14)",
        },
        "& .MuiTableCell-body": {
          borderBottomColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      {children}
    </Box>
  );
}
