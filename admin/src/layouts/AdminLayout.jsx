import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import AdminSidebar from "../components/admin/AdminSidebar";
import {
  createDefaultOpenGroups,
  drawerWidth,
  findPageByPath,
  menuGroups,
} from "../config/navigation";
import pageRegistry from "../pages/pageRegistry";

export default function AdminLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState(createDefaultOpenGroups);

  const currentPage = useMemo(
    () => findPageByPath(location.pathname),
    [location.pathname]
  );

  const CurrentPageComponent =
    pageRegistry[currentPage.key] || pageRegistry["overview-home"];

  useEffect(() => {
    setOpenGroups((current) => ({
      ...current,
      [currentPage.groupKey]: true,
    }));
  }, [currentPage.groupKey]);

  const sidebar = (
    <AdminSidebar
      menuGroups={menuGroups}
      currentPage={currentPage}
      openGroups={openGroups}
      onToggleGroup={(groupKey) =>
        setOpenGroups((current) => {
          const willOpen = !current[groupKey];
          const nextState = {};

          menuGroups.forEach((group) => {
            nextState[group.key] = false;
          });

          nextState[groupKey] = willOpen;

          return nextState;
        })
      }
      onNavigate={(path) => {
        navigate(path);
        setMobileOpen(false);
      }}
      search={search}
      onSearchChange={setSearch}
    />
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(255,140,66,0.12), transparent 28%), radial-gradient(circle at bottom left, rgba(95,209,199,0.12), transparent 22%), #0f141a",
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(10, 14, 18, 0.7)",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {!isDesktop ? (
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Icon icon="solar:hamburger-menu-outline" />
            </IconButton>
          ) : null}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: "secondary.light" }}>
              {currentPage.groupLabel}
            </Typography>
            <Typography variant="h3">{currentPage.label}</Typography>
            <Typography color="text.secondary">
              {currentPage.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Icon icon="solar:bell-bing-bold-duotone" />}
            >
              4 alerts
            </Button>
            <Button
              variant="contained"
              startIcon={<Icon icon="solar:add-circle-bold-duotone" />}
            >
              Quick action
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex" }}>
        <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: 0 }}>
          <Drawer
            variant={isDesktop ? "permanent" : "temporary"}
            open={isDesktop ? true : mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
                overflowY: "auto",
              },
            }}
          >
            {sidebar}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { lg: `calc(100% - ${drawerWidth}px)` },
            p: { xs: 2, md: 3 },
          }}
        >
          <CurrentPageComponent search={search} />
        </Box>
      </Box>
    </Box>
  );
}
