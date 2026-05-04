import React from "react";
import { Icon } from "@iconify/react";
import {
  alpha,
  Avatar,
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";

export default function AdminSidebar({
  menuGroups,
  currentPage,
  openGroups,
  onToggleGroup,
  onNavigate,
  search,
  onSearchChange,
}) {
  const theme = useTheme();

  return (
    <Stack
      sx={{
        height: "100%",
        p: 2,
        gap: 2,
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      

      <TextField
        fullWidth
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search within the current page"
        InputProps={{
          startAdornment: (
            <Icon
              icon="solar:magnifer-linear"
              style={{ fontSize: 20, marginRight: 10, opacity: 0.7 }}
            />
          ),
        }}
      />

      <Stack spacing={1.25} sx={{ pr: 0.5, pb: 1 }}>
        {menuGroups.map((group) => {
          const isOpen = openGroups[group.key];
          const hasActivePage = group.items.some(
            (item) => item.path === currentPage.path
          );

          return (
            <Paper
              key={group.key}
              sx={{
                overflow: "hidden",
                borderColor: hasActivePage
                  ? alpha(theme.palette.primary.main, 0.55)
                  : "rgba(255,255,255,0.08)",
                backgroundColor: hasActivePage
                  ? alpha(theme.palette.primary.main, 0.06)
                  : "rgba(255,255,255,0.015)",
              }}
            >
              <ListItemButton
                onClick={() => onToggleGroup(group.key)}
                sx={{
                  px: 1.75,
                  py: 1.5,
                  alignItems: "flex-start",
                }}
              >
                <ListItemIcon sx={{ minwidth: 40, color: "inherit", mt: 0.3 }}>
                  <Icon icon={group.icon} style={{ fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary={group.label}
                  secondary={group.description}
                  primaryTypographyProps={{ fontWeight: 800 }}
                  secondaryTypographyProps={{
                    color: "text.secondary",
                    sx: { mt: 0.3 },
                  }}
                />
                <Icon
                  icon={
                    isOpen
                      ? "solar:alt-arrow-up-linear"
                      : "solar:alt-arrow-down-linear"
                  }
                  style={{ fontSize: 18, marginTop: 4 }}
                />
              </ListItemButton>
              <Collapse in={isOpen} timeout="auto" unmountOnExit={false}>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <List sx={{ px: 1, py: 1, display: "grid", gap: 0.75 }}>
                  {group.items.map((item) => {
                    const selected = item.path === currentPage.path;

                    return (
                      <ListItemButton
                        key={item.key}
                        selected={selected}
                        onClick={() => onNavigate(item.path)}
                        sx={{
                          borderRadius: 3,
                          px: 1.5,
                          py: 1.2,
                          alignItems: "flex-start",
                          border: `1px solid ${
                            selected
                              ? alpha(theme.palette.secondary.main, 0.55)
                              : "rgba(255,255,255,0.05)"
                          }`,
                          backgroundColor: selected
                            ? alpha(theme.palette.secondary.main, 0.12)
                            : "transparent",
                        }}
                      >
                        <ListItemText
                          primary={item.label}
                          secondary={item.description}
                          primaryTypographyProps={{ fontWeight: 700 }}
                          secondaryTypographyProps={{
                            color: "text.secondary",
                            sx: { mt: 0.2 },
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>
    </Stack>
  );
}
