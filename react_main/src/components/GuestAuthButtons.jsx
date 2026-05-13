import React, { useState } from "react";
import { Button, IconButton, Stack, Tooltip } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import { Icon } from "@iconify/react";
import { Auth } from "./Auth";

const SOCIAL_LINKS = [
  {
    label: "Telegram",
    href: "https://t.me/+ZUP0erUElW1hMTAx",
    icon: "simple-icons:telegram",
    color: "#2AABEE",
  },
  {
    label: "Discord",
    href: "https://discord.gg/C5WMFpYRHQ",
    icon: "simple-icons:discord",
    color: "#5865F2",
  },
];

export const GuestAuthButtons = () => {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState(0); // 0 = login, 1 = register

  const openLoginDialog = () => {
    setAuthDialogMode(0);
    setAuthDialogOpen(true);
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ justifyContent: "flex-end", alignItems: "center" }}
      >
        {SOCIAL_LINKS.map((social) => (
          <Tooltip key={social.label} title={social.label}>
            <IconButton
              component="a"
              href={social.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={social.label}
              size="small"
              sx={{
                width: 36,
                height: 36,
                color: social.color,
                border: "1px solid rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.04)",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.09)",
                },
              }}
            >
              <Icon icon={social.icon} />
            </IconButton>
          </Tooltip>
        ))}
        <Button
          variant="contained"
          size="small"
          startIcon={<LoginOutlinedIcon fontSize="small" />}
          onClick={openLoginDialog}
          sx={{
            minHeight: 36,
            px: 2,
            border: "1px solid",
            borderColor: "primary.dark",
            backgroundColor: "primary.main",
            boxShadow: "none",
            textTransform: "none",
            fontSize: "14px",
            "&:hover": {
              borderColor: "primary.main",
              backgroundColor: "primary.dark",
              boxShadow: "none",
            },
          }}
        >
          Login
        </Button>
      </Stack>
      <Auth
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        defaultTab={authDialogMode}
        asDialog={true}
      />
    </>
  );
};
