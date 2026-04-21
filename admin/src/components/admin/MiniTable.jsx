import React from "react";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

import SectionCard from "../SectionCard";
import TableContainer from "./TableContainer";

export default function MiniTable({
  eyebrow,
  title,
  subtitle,
  columns,
  rows,
}) {
  return (
    <SectionCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column}>{column}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${title}-${index}`} hover>
                {row.map((value, cellIndex) => (
                  <TableCell key={`${title}-${index}-${cellIndex}`}>
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionCard>
  );
}
