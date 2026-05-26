import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { UserContext } from "Contexts";
import { RoleCount } from "components/Roles";

import LobbySidebarPanel from "./LobbySidebarPanel";

export const DailyChallenges = () => {
  const user = useContext(UserContext);
  const [dailyChallengeData, setDailyChallengeData] = useState({});

  useEffect(() => {
    let mounted = true;

    axios
      .get("/api/game/daily-challenges")
      .then((response) => {
        if (!mounted) return;
        setDailyChallengeData(response.data?.byId || {});
      })
      .catch(() => {
        if (!mounted) return;
        setDailyChallengeData({});
      });

    return () => {
      mounted = false;
    };
  }, []);

  let dailys = user.dailyChallenges?.map((m) => m.split(":"));

  if (!dailys || dailys.length <= 0) {
    return "";
  }

  const dailyRows = dailys.map((quest, index) => {
    const challenge = dailyChallengeData[quest[0]];
    if (!challenge) return null;

    let name = challenge.name.replace(`ExtraData`, quest[2]);
    let description = challenge.description.replace(`ExtraData`, quest[2]);
    let reward = Number.isFinite(Number(quest[3]))
      ? Number(quest[3])
      : challenge.reward;
    let isRole = challenge.extraData === "Role Name";

    return (
      <Box
        key={`${quest[0]}-${quest[1]}-${quest[2] || "none"}-${index}`}
        sx={{
          pt: 0.5,
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
          }}
        >
          <Typography fontWeight="bold">{name}</Typography>
          {isRole && (
            <Box
              sx={{
                ml: 0.5,
              }}
            >
              <RoleCount
                key={0}
                scheme="vivid"
                role={quest[2]}
                gameType={"Mafia"}
              />
            </Box>
          )}
          <Typography
            sx={{
              ml: "auto",
            }}
          >
            {reward}
          </Typography>
          <Box
                    component="i"
                    className="fas fa-coins"
                    aria-label="Coins"
                    sx={{ fontSize: 20, color: "#f5c542" }}
                  />
        </Stack>
        <Typography> {description}</Typography>
      </Box>
    );
  }).filter(Boolean);

  if (dailyRows.length <= 0) {
    return "";
  }

  return (
    <LobbySidebarPanel title="Daily Challenges">
      <Stack
        spacing={1}
        divider={<Divider orientation="horizontal" flexItem />}
      >
        {dailyRows}
      </Stack>
    </LobbySidebarPanel>
  );
};
