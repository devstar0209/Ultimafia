import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Avatar } from "./User";
import { useIsPhoneDevice } from "../../hooks/useIsPhoneDevice";
import {
  Divider,
  Stack,
  Typography,
  Badge,
  Box,
  Button,
} from "@mui/material";
import NavDropdown from "../../components/NavDropdown";
import BuyCoinsModal from "../../components/BuyCoinsModal";
import TopUpModal from "../../components/TopUpModal";
import { SiteInfoContext } from "../../Contexts";

import "css/main.css";
import exitIcon from "../../images/emotes/exit.png";

export default function UserNavSection({
  openAnnouncements,
  user,
  useUnreadNotifications,
}) {
  const navigate = useNavigate();
  const isMobile = useIsPhoneDevice();
  const unreadCount = useUnreadNotifications();
  const [userFamily, setUserFamily] = useState(null);
  const siteInfo = useContext(SiteInfoContext);
  const { cacheVal } = siteInfo;
  const [buyCoinsDialogOpen, setBuyCoinsDialogOpen] = useState(false);
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (user.loggedIn) {
      axios
        .get("/api/family/user/family")
        .then((res) => {
          if (cancelled || !isMountedRef.current) return;
          setUserFamily(res.data.family);
        })
        .catch(() => {
          // Ignore errors, user might not have a family
        });
    }

    return () => {
      cancelled = true;
    };
  }, [user.loggedIn]);

  const handleLogout = () => {
    axios
      .post("/api/user/logout")
      .then(() => {
        user.clear();
        navigate("/");
        window.location.reload();
      })
      .catch((error) => {
        console.error("Logout failed:", error);
      });
  };

  // Use vanity URL for profile link if available
  const profilePath = user.vanityUrl ? `/user/${user.vanityUrl}` : "/user";

  // Create family avatar icon if family exists and has avatar
  const familyAvatarUrl = typeof userFamily?.avatar === "string"
    ? userFamily.avatar
    : userFamily?.id
      ? `/uploads/${userFamily.id}_family_avatar.webp?t=${cacheVal}`
      : null;

  const familyIcon = userFamily?.avatar ? (
    <div
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundImage: familyAvatarUrl ? `url(${familyAvatarUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        flexShrink: 0,
      }}
    />
  ) : null;

  const userMenuItems = [
    {
      text: "Profile",
      path: profilePath,
      icon: (<i className="fas fa-user"/>),
    },
    ...(userFamily
      ? [
          {
            text: userFamily.name,
            path: `/user/family/${userFamily.id}`,
            icon: familyIcon,
          },
        ]
      : []),
    {
      text: "Inbox",
      path: "/user/inbox",
      icon: (
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <i className="fas fa-inbox"/>
        </Badge>
      ),
    },
    {
      text: "Settings",
      path: "/user/settings",
      icon: (<i className="fas fa-cog"/>),
    },
    {
      text: "Announcements",
      onClick: openAnnouncements,
      icon: (<i className="fas fa-bullhorn"/>),
    },
    { divider: true },
    {
      text: "Log Out",
      onClick: handleLogout,
      icon: (
        <img
          src={exitIcon}
          alt="exit"
          style={{ width: "16px", height: "16px" }}
        />
      ),
    },
  ];

  function closeBuyCoinsDialog() {
    setBuyCoinsDialogOpen(false);
  }

  function openBuyCoinsDialog() {
    setBuyCoinsDialogOpen(true);
  }

  function closeTopUpDialog() {
    setTopUpDialogOpen(false);
  }

  function openTopUpDialog() {
    setTopUpDialogOpen(true);
  }

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        divider={<Divider orientation="vertical" flexItem />}
        sx={{
          px: 1,
          alignItems: "center",
          justifyContent: "end",
        }}
      >
        <Button
          onClick={openTopUpDialog}
          size="small"
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.25,
          }}
        >
          Top Up
        </Button>
        <Button
          onClick={openBuyCoinsDialog}
          size="small"
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.25,
          }}
        >
          {isMobile ? "Buy" : "Buy Coins"}
        </Button>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <Typography variant="body2">
            ${Number(user.balanceDollar || 0).toFixed(2)}
          </Typography>
          <Box
            component="i"
            className="fas fa-wallet"
            aria-label="Dollar balance"
            sx={{ fontSize: 18, color: "success.main" }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <Typography variant="body2">
            {(Number(user.coins) || 0).toLocaleString()}
          </Typography>
          <Box
            component="i"
            className="fas fa-coins"
            aria-label="Coins"
            sx={{ fontSize: 18, color: "#f5c542" }}
          />
        </Stack>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NavDropdown
            items={userMenuItems}
            customTrigger={<Avatar id={user.id} name={user.name} hasImage={user.avatar} />}
          />
        </Badge>
      </Stack>
      <TopUpModal open={topUpDialogOpen} onClose={closeTopUpDialog} user={user} />
      <BuyCoinsModal open={buyCoinsDialogOpen} onClose={closeBuyCoinsDialog} user={user} />
    </>
  );
}
