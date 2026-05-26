import React, { useState, useEffect, useContext } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  IconButton,
  Divider,
  Pagination,
  Chip,
} from "@mui/material";

import { UserContext, SiteInfoContext } from "Contexts";
import { useErrorAlert } from "components/Alerts";
import { Loading } from "components/Loading";

import "css/inbox.css";

export default function Inbox() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendActionLoading, setFriendActionLoading] = useState({});

  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const navigate = useNavigate();

  useEffect(() => {
    if (user.loaded && user.loggedIn) {
      loadNotifications(1);
    }
  }, [user.loaded, user.loggedIn]);

  const loadNotifications = async (page) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/notifs/inbox?page=${page}`);
      setNotifications(res.data.notifications || []);
      setCurrentPage(res.data.currentPage || 1);
      setTotalPages(res.data.totalPages || 1);
      setTotalNotifications(res.data.totalNotifications || 0);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      errorAlert(err);
      // Set default values on error
      setNotifications([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalNotifications(0);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    loadNotifications(value);
    window.scrollTo(0, 0);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await axios.post(`/api/notifs/read/${notifId}`);
      // Update local state
      setNotifications((prev) =>
        (prev || []).map((notif) =>
          notif.id === notifId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      siteInfo.showAlert("Marked as read", "success");
    } catch (err) {
      errorAlert(err);
    }
  };

  const handleFriendRequestAction = async (notif, action) => {
    const requestUserId = notif.friendRequestUserId;

    if (!requestUserId) return;

    setFriendActionLoading((prev) => ({
      ...prev,
      [notif.id]: action,
    }));

    try {
      const endpoint =
        action === "accept" ? "/api/user/friend" : "/api/user/friend/reject";
      const res = await axios.post(endpoint, { user: requestUserId });

      if (!notif.read) {
        try {
          await axios.post(`/api/notifs/read/${notif.id}`);
        } catch {}
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      setNotifications((prev) =>
        (prev || []).map((item) =>
          item.id === notif.id
            ? {
                ...item,
                read: true,
                friendRequestUserId: null,
                friendRequestStatus:
                  action === "accept" ? "accepted" : "rejected",
              }
            : item
        )
      );
      siteInfo.showAlert(res.data, "success");
    } catch (err) {
      errorAlert(err);
    } finally {
      setFriendActionLoading((prev) => {
        const next = { ...prev };

        delete next[notif.id];

        return next;
      });
    }
  };

  const handleDelete = async (notifId) => {
    try {
      await axios.delete(`/api/notifs/${notifId}`);
      // Remove from local state
      setNotifications((prev) =>
        (prev || []).filter((notif) => notif.id !== notifId)
      );
      setTotalNotifications((prev) => Math.max(0, prev - 1));
      siteInfo.showAlert("Notification deleted", "success");

      // Reload if we're now on an empty page and it's not page 1
      if (notifications && notifications.length === 1 && currentPage > 1) {
        loadNotifications(currentPage - 1);
      } else if (
        notifications &&
        notifications.length === 1 &&
        currentPage === 1
      ) {
        loadNotifications(1);
      }
    } catch (err) {
      errorAlert(err);
    }
  };

  const getIconClassName = (icon) => {
    if (!icon) return "";

    return icon.includes(" ") ? icon : `fas fa-${icon}`;
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  if (user.loaded && !user.loggedIn) {
    return <Navigate to="/play" />;
  }

  if (!user.loaded || loading) {
    return <Loading small />;
  }

  return (
    <Paper
      className="inbox"
      sx={{
        p: 1,
      }}
    >
      <Stack direction="column" spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h2">Inbox</Typography>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Chip label={`Total: ${totalNotifications}`} variant="outlined" />
          <Chip
            label={`Unread: ${unreadCount}`}
            color={unreadCount > 0 ? "primary" : "default"}
            variant="outlined"
          />
        </Stack>

        <Divider />

        {!notifications || notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <Stack direction="column" spacing={1}>
            {notifications &&
              notifications.map((notif) => (
                <Paper
                  key={notif.id}
                  sx={{
                    p: 2,
                    backgroundColor: notif.read
                      ? "background.paper"
                      : "action.hover",
                    border: notif.read ? "1px solid" : "2px solid",
                    borderColor: notif.read ? "divider" : "primary.main",
                    cursor: notif.link ? "pointer" : "default",
                    transition: "all 0.2s",
                    "&:hover": {
                      backgroundColor: "action.selected",
                    },
                  }}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    {/* Icon and Content */}
                    <Stack
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      flex={1}
                    >
                      {notif.icon && (
                        <i
                          className={getIconClassName(notif.icon)}
                          style={{ fontSize: "20px", minWidth: "20px" }}
                        />
                      )}
                      <Stack direction="column" spacing={0.5} flex={1}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: notif.read ? "normal" : "bold",
                          }}
                        >
                          {notif.content}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(notif.date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      {notif.friendRequestUserId && (
                        <Stack
                          direction="row"
                          spacing={1}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={Boolean(friendActionLoading[notif.id])}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFriendRequestAction(notif, "accept");
                            }}
                          >
                            {friendActionLoading[notif.id] === "accept"
                              ? "Accepting..."
                              : "Accept"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={Boolean(friendActionLoading[notif.id])}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFriendRequestAction(notif, "reject");
                            }}
                          >
                            {friendActionLoading[notif.id] === "reject"
                              ? "Rejecting..."
                              : "Reject"}
                          </Button>
                        </Stack>
                      )}
                      {notif.friendRequestStatus && (
                        <Chip
                          size="small"
                          color={
                            notif.friendRequestStatus === "accepted"
                              ? "success"
                              : "default"
                          }
                          label={
                            notif.friendRequestStatus === "accepted"
                              ? "Accepted"
                              : "Rejected"
                          }
                        />
                      )}
                      {!notif.read && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                          }}
                          title="Mark as read"
                        >
                          <i className="fas fa-envelope-open" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notif.id);
                        }}
                        title="Delete notification"
                      >
                        <i className="fas fa-trash" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
          </Stack>
        )}

        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="large"
            />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
