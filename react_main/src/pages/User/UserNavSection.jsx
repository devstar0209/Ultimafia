import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Avatar } from "./User";
import { useNow } from "../../hooks/useNow";
import { useIsPhoneDevice } from "../../hooks/useIsPhoneDevice";
import {
  Divider,
  Stack,
  Tooltip,
  Typography,
  Badge,
  Box,
  Button,
} from "@mui/material";
import NavDropdown from "../../components/NavDropdown";
import BuyCoinsModal from "../../components/BuyCoinsModal";
import { useErrorAlert } from "components/Alerts";
import { SiteInfoContext } from "../../Contexts";

import "css/main.css";
import exitIcon from "../../images/emotes/exit.png";

export default function UserNavSection({
  openAnnouncements,
  user,
  useUnreadNotifications,
}) {
  const now = useNow(200);
  const navigate = useNavigate();
  const isMobile = useIsPhoneDevice();
  const unreadCount = useUnreadNotifications();
  const errorAlert = useErrorAlert();
  const [userFamily, setUserFamily] = useState(null);
  const siteInfo = useContext(SiteInfoContext);
  const { cacheVal } = siteInfo;
  const [buyCoinsDialogOpen, setBuyCoinsDialogOpen] = useState(false);
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
  const familyIcon = userFamily?.avatar ? (
    <div
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundImage: `url(/uploads/${userFamily.id}_family_avatar.webp?t=${cacheVal})`,
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
  // don't change here
  setBuyCoinsDialogOpen(true);
}

  function timeToGo(timestamp) {
    // Utility to add leading zero
    function z(n) {
      return (n < 10 ? "0" : "") + n;
    }

    var diff = timestamp - now;
    if (diff < 0) diff = 0;

    // Get time components
    var hours = (diff / 3.6e6) | 0;
    var mins = ((diff % 3.6e6) / 6e4) | 0;
    var secs = Math.round((diff % 6e4) / 1e3);

    // Return formatted string
    return z(hours) + ":" + z(mins) + ":" + z(secs);
  }

  function getHeartRefreshMessage(user, type) {
    var timestamp = null;

    if (type === "red") timestamp = user.redHeartRefreshTimestamp;
    else if (type === "gold") timestamp = user.goldHeartRefreshTimestamp;

    if (timestamp && timestamp > 0) {
      const timeToGoString = timeToGo(timestamp);
      //console.log(type, timestamp, timeToGoString, user)
      return `Your ${type} hearts will replenish in: ${timeToGoString}`;
    } else {
      return `Your ${type} hearts are at full capacity. Go play some games!`;
    }
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
            {(Number(user.coins) || 0).toLocaleString()}
          </Typography>
          <Box
            component="i"
            className="fas fa-coins"
            aria-label="Coins"
            sx={{ fontSize: 18, color: "#f5c542" }}
          />
        </Stack>
        <Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1em",
              columnGap: 0.5,
              width: "3em",
              alignItems: "center",
              textAlign: "right",
            }}
          >
            <Typography variant="body2">
              {user.redHearts ?? 0}
            </Typography>
            <Tooltip title={getHeartRefreshMessage(user, "red")}>
              <i
                className="fas fa-heart"
                style={{ color: "#e23b3b", marginLeft: "auto" }}
              />
            </Tooltip>
            <Typography variant="body2">
              {user.goldHearts ?? 0}
            </Typography>
            <Link to="/fame/competitive">
              <i
                className="fas fa-heart"
                style={{ color: "var(--gold-heart-color)", marginLeft: "auto" }}
              />
            </Link>
          </Box>
        </Stack>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NavDropdown
            items={userMenuItems}
            customTrigger={<Avatar id={user.id} name={user.name} hasImage={user.avatar} />}
          />
        </Badge>
      </Stack>
      <BuyCoinsModal open={buyCoinsDialogOpen} onClose={closeBuyCoinsDialog} user={user} />
    </>
  );
}
