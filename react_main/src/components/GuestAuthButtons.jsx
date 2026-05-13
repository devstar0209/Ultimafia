import React, { useState } from "react";
import { Button, Stack } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import { Auth } from "./Auth";

export const GuestAuthButtons = () => {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState(0); // 0 = login, 1 = register

  const openLoginDialog = () => {
    setAuthDialogMode(0);
    setAuthDialogOpen(true);
  };

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
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
