import React, { useState, useContext, useEffect, useMemo } from "react";
import axios from "axios";

import {
  Button,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import { Link } from "react-router-dom";

import { KUDOS_ICON, KARMA_ICON, ACHIEVEMENTS_ICON } from "pages/User/Profile";
import { PieChart } from "pages/User/PieChart";
import { Avatar } from "pages/User/User";
import { UserContext, SiteInfoContext } from "Contexts";
import ConfirmDialog from "components/ConfirmDialog";
import ReportDialog from "components/ReportDialog";
import { useErrorAlert } from "components/Alerts";

function Miniprofile(props) {
  const user = props.user;
  const game = props.game;
  const inheritedProps = user.props;
  const currentUser = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();

  const id = user.id;
  const name = user.name || "[deleted]";
  const pronouns = user.pronouns || "";
  const avatar = user.avatar;
  const color = inheritedProps.color;
  const avatarId = inheritedProps.avatarId;
  const hasDefaultPronouns = pronouns === "";
  const vanityUrl = user.vanityUrl;

  let pieChart = <></>;
  if (user.stats) {
    const mafiaStats = user.stats["Mafia"].all;
    pieChart = (
      <PieChart
        wins={mafiaStats.wins.count}
        losses={mafiaStats.wins.total - mafiaStats.wins.count}
        abandons={mafiaStats.abandons.total}
      />
    );
  }

  const profileLink = vanityUrl ? `/user/${vanityUrl}` : `/user/${id}`;

  const totalAchievements =
    Object.keys(siteInfo.achievementsRaw?.Mafia || {}).length || 40;

  const isSelf = currentUser.loggedIn && currentUser.id === id;
  const [isFriend, setIsFriend] = useState(user.isFriend || false);
  const [isFriendRequested, setIsFriendRequested] = useState(
    user.isFriendRequested || false
  );
  const [friendConfirmOpen, setFriendConfirmOpen] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const gameId = game?.gameId || null;

  const reportPrefilledArgs = useMemo(
    () => ({
      userId: id,
      userName: name,
      game: gameId,
    }),
    [id, name, gameId]
  );

  // Update friend status when user prop changes
  useEffect(() => {
    setIsFriend(user.isFriend || false);
    setIsFriendRequested(user.isFriendRequested || false);
  }, [user.isFriend, user.isFriendRequested]);

  function submitFriendAction() {
    setFriendActionLoading(true);
    axios
      .post("/api/user/friend", { user: id })
      .then((res) => {
        const message = String(res.data || "");

        if (message.includes("accepted")) {
          setIsFriend(true);
          setIsFriendRequested(false);
        } else if (message.includes("sent")) {
          setIsFriend(false);
          setIsFriendRequested(true);
        } else if (message.includes("cancelled")) {
          setIsFriend(false);
          setIsFriendRequested(false);
        } else if (message.includes("Unfriended")) {
          setIsFriend(false);
          setIsFriendRequested(false);
        }
        siteInfo.showAlert(res.data, "success");
      })
      .catch(errorAlert)
      .finally(() => {
        setFriendActionLoading(false);
        setFriendConfirmOpen(false);
      });
  }

  function onFriendUserClick() {
    if (isFriend || isFriendRequested) {
      setFriendConfirmOpen(true);
      return;
    }

    submitFriendAction();
  }

  function onReportClick() {
    setReportDialogOpen(true);
  }

  const friendIconClass = isFriend
    ? "fas fa-user-check sel"
    : `fas ${isFriendRequested ? "fa-user-clock sel" : "fa-user-plus"}`;
  const friendTooltip = isFriend
    ? "Unfriend"
    : isFriendRequested
      ? "Cancel Friend Request"
      : "Send Friend Request";

  return (
    <div className="miniprofile">
      <div className="mui-popover-title">
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <Link
            className={`name-with-avatar`}
            to={profileLink}
            target="_blank"
            style={{ flex: 1, minwidth: 0 }}
          >
            <Stack direction="row" spacing={1}>
              <Avatar
                hasImage={avatar}
                id={id}
                avatarId={avatarId}
                name={name}
              />
              <div
                className={`user-name`}
                style={{
                  ...(color ? { color } : {}),
                  display: "inline",
                  alignSelf: "center",
                }}
              >
                {name}
              </div>
            </Stack>
          </Link>
          {!isSelf && currentUser.loggedIn && (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={friendTooltip}>
                <IconButton
                  size="small"
                  onClick={onFriendUserClick}
                  disabled={friendActionLoading}
                  sx={{
                    color:
                      isFriend || isFriendRequested
                        ? "primary.main"
                        : "text.secondary",
                  }}
                >
                  <i className={friendIconClass} />
                </IconButton>
              </Tooltip>
              <Button
                endIcon={<i className="fas fa-flag" />}
                size="small"
                onClick={onReportClick}
              >
                  Report
              </Button>
            </Stack>
          )}
        </Stack>
      </div>
      <ReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        prefilledArgs={reportPrefilledArgs}
      />
      <ConfirmDialog
        open={friendConfirmOpen}
        title={isFriend ? "Unfriend user" : "Cancel friend request"}
        message={
          isFriend
            ? `Are you sure you want to unfriend ${name}?`
            : `Cancel your friend request to ${name}?`
        }
        confirmLabel={isFriend ? "Unfriend" : "Cancel request"}
        confirmColor="error"
        loading={friendActionLoading}
        onClose={() => setFriendConfirmOpen(false)}
        onConfirm={submitFriendAction}
      />
      {!hasDefaultPronouns && <div className="pronouns">({pronouns})</div>}
      {pieChart}
      <div className="score-info">
        <div className="score-info-column">
          <div className="score-info-row score-info-smallicon">
            <img src={KUDOS_ICON} />
          </div>
          <div className="score-info-row">{user.kudos}</div>
        </div>
        <div className="score-info-column">
          <div className="score-info-row score-info-smallicon">
            <img src={KARMA_ICON} />
          </div>
          <div className="score-info-row">{user.karma}</div>
        </div>
        <div className="score-info-column">
          <div className="score-info-row score-info-smallicon">
            <img src={ACHIEVEMENTS_ICON} />
          </div>
          <div className="score-info-row">{user.achievements.length}/{totalAchievements}</div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Miniprofile);
