import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link as RouterLink } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { SiteInfoContext, UserContext } from "Contexts";
import { useErrorAlert } from "components/Alerts";
import { Loading } from "components/Loading";
import ConfirmDialog from "components/ConfirmDialog";
import { NameWithAvatar } from "../User/User";

function CoinAmount({ amount }) {
  return (
    <Stack
      component="span"
      direction="row"
      spacing={0.5}
      sx={{ display: "inline-flex", alignItems: "center" }}
    >
      <span>{Number(amount || 0).toLocaleString()}</span>
      <Box
        component="i"
        className="fas fa-coins"
        aria-label="Coins"
        sx={{ color: "#f5c542", fontSize: "0.95em" }}
      />
    </Stack>
  );
}

function FamilyAvatar({ family }) {
  const siteInfo = useContext(SiteInfoContext);
  const avatarUrl =
    typeof family.avatar === "string"
      ? family.avatar
      : family.avatar
        ? `/uploads/${family.id}_family_avatar.webp?t=${siteInfo.cacheVal}`
        : "";

  return (
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        backgroundColor: "background.default",
        backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {!avatarUrl && (
        <Box
          component="i"
          className="fas fa-users"
          aria-hidden="true"
          sx={{ color: "text.secondary", fontSize: 24 }}
        />
      )}
    </Box>
  );
}

function FamilyCard({ family, isRequesting, onRequestJoin, onCancelApplication, user }) {
  const isFull = family.memberCount >= family.memberLimit;
  let requestLabel = "Request Join";
  let requestTitle = "";
  const joinFee = Number(family.joinFee || 0);

  if (isRequesting) {
    requestLabel = "Requesting...";
  } else if (family.userIsMember) {
    requestLabel = "Your Family";
  } else if (!user.loaded) {
    requestTitle = "Loading account status.";
  } else if (!user.loggedIn) {
    requestLabel = "Log In to Request";
    requestTitle = "Log in to request to join this family.";
  } else if (!family.applicationsOpen) {
    requestLabel = "Closed";
    requestTitle = "This family is not accepting applications.";
  } else if (isFull) {
    requestLabel = "Full";
    requestTitle = "This family has reached its member limit.";
  } else if (!family.canRequestJoin && !family.hasPendingApplication) {
    requestLabel = "Already in Family";
    requestTitle = "Leave your current family before requesting to join another.";
  } else if (joinFee > 0) {
    requestLabel = "Pay Fee & Request";
  }

  const requestDisabled = isRequesting || !user.loaded || !family.canRequestJoin;

  return (
    <Paper
      sx={{
        p: 2,
        height: "100%",
        borderRadius: "4px",
        backgroundColor: "var(--scheme-color)",
      }}
    >
      <Stack direction="column" spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FamilyAvatar family={family} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h3"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {family.name}
            </Typography>
            {family.leader && (
              <Typography
                component="div"
                variant="caption"
                color="text.secondary"
              >
                Led by{" "}
                <NameWithAvatar
                  id={family.leader.id}
                  name={family.leader.name}
                  avatar={family.leader.avatar}
                  vanityUrl={family.leader.vanityUrl}
                />
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip
            size="small"
            color={family.applicationsOpen ? "success" : "default"}
            icon={
              <Box
                component="i"
                className={
                  family.applicationsOpen ? "fas fa-door-open" : "fas fa-lock"
                }
                aria-hidden="true"
              />
            }
            label={family.applicationsOpen ? "Applications Open" : "Closed"}
          />
          <Chip
            size="small"
            icon={
              <Box component="i" className="fas fa-users" aria-hidden="true" />
            }
            label={`${family.memberCount}/${family.memberLimit}`}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={
              <Box component="i" className="fas fa-star" aria-hidden="true" />
            }
            label={`${family.score} pts`}
            variant="outlined"
          />
          {joinFee > 0 && (
            <Chip
              size="small"
              icon={
                <Box
                  component="i"
                  className="fas fa-coins"
                  aria-hidden="true"
                />
              }
              label={`${joinFee.toLocaleString()} join fee`}
              variant="outlined"
            />
          )}
        </Stack>

        {family.bioPreview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              minHeight: 40,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {family.bioPreview}
          </Typography>
        )}

        <Grid container spacing={1} sx={{ mt: "auto" }}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Treasury
            </Typography>
            <Typography variant="body2">
              <CoinAmount amount={family.treasury} />
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Trophies
            </Typography>
            <Typography variant="body2">{family.trophyCount}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              Perks
            </Typography>
            <Typography variant="body2">{family.perkCount}</Typography>
          </Grid>
        </Grid>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            component={RouterLink}
            to={`/user/family/${family.id}`}
            variant="outlined"
            size="small"
            startIcon={
              <Box component="i" className="fas fa-eye" aria-hidden="true" />
            }
            sx={{ flex: 1 }}
          >
            View
          </Button>
          {family.hasPendingApplication ? (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => onCancelApplication(family)}
              startIcon={
                <Box component="i" className="fas fa-times" aria-hidden="true" />
              }
              sx={{ flex: 1 }}
            >
              Cancel Request
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              disabled={requestDisabled}
              title={requestTitle}
              onClick={() => onRequestJoin(family)}
              startIcon={
                <Box component="i" className="fas fa-user-plus" aria-hidden="true" />
              }
              sx={{ flex: 1 }}
            >
              {requestLabel}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function FamilyDiscovery() {
  const [families, setFamilies] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score");
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [requestingFamilies, setRequestingFamilies] = useState({});
  const [joinConfirmFamily, setJoinConfirmFamily] = useState(null);
  const [cancelConfirmFamily, setCancelConfirmFamily] = useState(null);
  const [cancellingFamilies, setCancellingFamilies] = useState({});
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const errorAlertRef = useRef(errorAlert);

  useEffect(() => {
    errorAlertRef.current = errorAlert;
  }, [errorAlert]);

  const loadFamilies = useCallback(() => {
    setLoaded(false);
    axios
      .get("/api/family/discover", {
        params: {
          search,
          sort,
          openOnly,
          page,
          limit: 12,
        },
      })
      .then((res) => {
        setFamilies(res.data.families || []);
        setTotalPages(res.data.totalPages || 1);
        setTotal(res.data.total || 0);
        setLoaded(true);
      })
      .catch((e) => {
        setFamilies([]);
        setLoaded(true);
        errorAlertRef.current(e);
      });
  }, [openOnly, page, search, sort]);

  useEffect(() => {
    document.title = "Find Families | PassionMafia";
  }, []);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function onSortChange(event) {
    setPage(1);
    setSort(event.target.value);
  }

  function onOpenOnlyChange(event) {
    setPage(1);
    setOpenOnly(event.target.checked);
  }

  function onCancelApplicationClick(family) {
    setCancelConfirmFamily(family);
  }

  function cancelApplication(familyId) {
    if (cancellingFamilies[familyId]) return;

    setCancelConfirmFamily(null);
    setCancellingFamilies((prev) => ({ ...prev, [familyId]: true }));

    axios
      .delete(`/api/family/${familyId}/applications/mine`)
      .then((res) => {
        siteInfo.showAlert("Application cancelled", "success");
        if (res.data?.coins !== undefined) {
          user.set((prev) => ({
            ...prev,
            coins: Number(res.data.coins ?? prev.coins ?? 0),
            balanceDollar: Number(
              res.data.balanceDollar ?? prev.balanceDollar ?? 0
            ),
          }));
        }
        setFamilies((prev) =>
          prev.map((f) => {
            if (f.id !== familyId) return f;
            const isFull = f.memberCount >= f.memberLimit;
            return {
              ...f,
              hasPendingApplication: false,
              canRequestJoin: f.applicationsOpen && !isFull,
              treasury: Math.max(
                0,
                Number(f.treasury || 0) - Number(f.joinFee || 0)
              ),
            };
          })
        );
      })
      .catch(errorAlert)
      .finally(() => {
        setCancellingFamilies((prev) => {
          const next = { ...prev };
          delete next[familyId];
          return next;
        });
      });
  }

  function onRequestJoinClick(family) {
    if (Number(family.joinFee || 0) > 0) {
      setJoinConfirmFamily(family);
      return;
    }

    submitJoinRequest(family.id);
  }

  function submitJoinRequest(familyId) {
    if (requestingFamilies[familyId]) return;

    setJoinConfirmFamily(null);
    setRequestingFamilies((prev) => ({
      ...prev,
      [familyId]: true,
    }));

    axios
      .post(`/api/family/${familyId}/apply`, { message: "" })
      .then((res) => {
        siteInfo.showAlert("Join request submitted", "success");
        if (res.data?.coins !== undefined) {
          user.set((prev) => ({
            ...prev,
            coins: Number(res.data.coins ?? prev.coins ?? 0),
            balanceDollar: Number(
              res.data.balanceDollar ?? prev.balanceDollar ?? 0
            ),
          }));
        }
        setFamilies((prev) =>
          prev.map((family) =>
            family.id === familyId
              ? {
                  ...family,
                  hasPendingApplication: true,
                  canRequestJoin: false,
                  treasury:
                    Number(family.treasury || 0) +
                    Number(res.data?.joinFee || 0),
                }
              : family
          )
        );
      })
      .catch(errorAlert)
      .finally(() => {
        setRequestingFamilies((prev) => {
          const next = { ...prev };
          delete next[familyId];
          return next;
        });
      });
  }

  return (
    <Stack direction="column" spacing={2}>
      <Paper
        sx={{
          p: 2,
          borderRadius: "4px",
          backgroundColor: "var(--scheme-color)",
        }}
      >
        <Stack direction="column" spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="h2">Find Families</Typography>
              <Typography variant="body2" color="text.secondary">
                Browse active families and find one that is accepting members.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/user/settings/family"
              variant="outlined"
              startIcon={
                <Box component="i" className="fas fa-plus" aria-hidden="true" />
              }
            >
              Create Family
            </Button>
          </Stack>

          <Stack
            component="form"
            onSubmit={submitSearch}
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ alignItems: { xs: "stretch", md: "center" } }}
          >
            <TextField
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search families"
              inputProps={{ maxLength: 40 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      component="i"
                      className="fas fa-search"
                      aria-hidden="true"
                    />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <Select size="small" value={sort} onChange={onSortChange}>
              <MenuItem value="score">Top Score</MenuItem>
              <MenuItem value="open">Open First</MenuItem>
              <MenuItem value="members">Most Members</MenuItem>
              <MenuItem value="treasury">Most Treasury</MenuItem>
              <MenuItem value="newest">Newest</MenuItem>
            </Select>
            <FormControlLabel
              control={
                <Switch checked={openOnly} onChange={onOpenOnlyChange} />
              }
              label="Open only"
              sx={{ mx: 0 }}
            />
            <Button type="submit" variant="contained">
              Search
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            {total.toLocaleString()} families found
          </Typography>
        </Stack>
      </Paper>

      {!loaded && <Loading small />}

      {loaded && families.length === 0 && (
        <Paper
          sx={{
            p: 2,
            borderRadius: "4px",
            backgroundColor: "var(--scheme-color)",
          }}
        >
          <Typography>No families found.</Typography>
        </Paper>
      )}

      {loaded && families.length > 0 && (
        <>
          <Grid container spacing={2}>
            {families.map((family) => (
              <Grid item xs={12} md={6} xl={4} key={family.id}>
                <FamilyCard
                  family={family}
                  isRequesting={Boolean(requestingFamilies[family.id])}
                  onRequestJoin={onRequestJoinClick}
                  onCancelApplication={onCancelApplicationClick}
                  user={user}
                />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Stack direction="row" sx={{ justifyContent: "center" }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
      <ConfirmDialog
        open={Boolean(joinConfirmFamily)}
        title="Pay Join Fee"
        message={`Requesting to join ${
          joinConfirmFamily?.name || "this family"
        } costs ${Number(
          joinConfirmFamily?.joinFee || 0
        ).toLocaleString()} coins. The fee is refunded if the request is rejected.`}
        confirmLabel="Pay and Request"
        loading={Boolean(
          joinConfirmFamily && requestingFamilies[joinConfirmFamily.id]
        )}
        onClose={() => setJoinConfirmFamily(null)}
        onConfirm={() => submitJoinRequest(joinConfirmFamily.id)}
      />
      <ConfirmDialog
        open={Boolean(cancelConfirmFamily)}
        title="Cancel Application"
        message={
          Number(cancelConfirmFamily?.joinFee || 0) > 0
            ? `Are you sure you want to cancel your application to ${
                cancelConfirmFamily?.name || "this family"
              }? Your ${Number(
                cancelConfirmFamily?.joinFee || 0
              ).toLocaleString()} coin join fee will be refunded.`
            : `Are you sure you want to cancel your application to ${
                cancelConfirmFamily?.name || "this family"
              }?`
        }
        confirmLabel="Cancel Application"
        confirmColor="error"
        loading={Boolean(
          cancelConfirmFamily && cancellingFamilies[cancelConfirmFamily.id]
        )}
        onClose={() => setCancelConfirmFamily(null)}
        onConfirm={() => cancelApplication(cancelConfirmFamily.id)}
      />
    </Stack>
  );
}
