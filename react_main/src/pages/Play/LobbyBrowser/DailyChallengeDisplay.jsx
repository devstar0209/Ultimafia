import React, { useContext } from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { UserContext } from "Contexts";
import { DailyChallengeData } from "constants/DailyChallenge";
import { RoleCount } from "components/Roles";

import LobbySidebarPanel from "./LobbySidebarPanel";

export const DailyChallenges = () => {
  const user = useContext(UserContext);

  let dailys = user.dailyChallenges?.map((m) => m.split(":"));

  if (!dailys || dailys.length <= 0) {
    return "";
  }

  const dailyRows = dailys.map((quest, index) => {
    //quest[0]
    let thing = Object.entries(DailyChallengeData).filter(
      (DailyChallenge) => quest[0] === DailyChallenge[1].ID
    );
    let name = thing[0][0].replace(`ExtraData`, quest[2]);
    let description = thing[0][1].description.replace(`ExtraData`, quest[2]);
    let reward = Number.isFinite(Number(quest[3]))
      ? Number(quest[3])
      : thing[0][1].reward;
    let isRole = thing[0][1].extraData === "Role Name";

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
  });

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
