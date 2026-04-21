import React, { useContext, useEffect, useMemo, useState } from "react";
import { Box, Container, Typography, Paper, Grid2 } from "@mui/material";
import { Navigate } from "react-router-dom";
import "css/main.css";
import { Auth } from "../../components/Auth";
import IconGallery from "../../components/IconGallery";
import GameIcon, { getGameIconSrc } from "../../components/GameIcon";
import bannerImage from "../../images/welcome_page/banner.png";
import welcomeImage1 from "../../images/welcome_page/welcome-page_1.png";
import welcomeImage2 from "../../images/welcome_page/welcome-page_2.png";
import welcomeImage3 from "../../images/welcome_page/welcome-page_3.png";
import welcomeImage4 from "../../images/welcome_page/welcome-page_4.png";
import {
  getAuth,
  getRedirectResult,
  inMemoryPersistence,
} from "firebase/auth";
import axios from "axios";
import { useSnackbar } from "hooks/useSnackbar";
import { Loading } from "../../components/Loading";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import { SiteInfoContext, UserContext } from "Contexts";
import { GameTypes } from "../../Constants";

const MAFIA_FEATURES = [
  {
    image: welcomeImage1,
    text: "Experience Mafia in live-chat format. No need for bots or referees. Real-time and responsive actions facilitated by the game itself.",
  },
  {
    image: welcomeImage2,
    text: "Over 400 roles combined with countless modifiers and items allowing you to tailor your setups to any playstyle.",
  },
  {
    image: welcomeImage3,
    text: "Compete and hone your skills of deception and deduction in seasonal play. Join the community in off-season events as well.",
  },
  {
    image: welcomeImage4,
    text: "Take a break from Mafia and play all manner of card, dice, and word games.",
  },
];

const DESKTOP_COLUMN_HEIGHT = 800;

const SHARED_FEATURE_IMAGES = [
  welcomeImage1,
  welcomeImage2,
  welcomeImage3,
  welcomeImage4,
];

const buildSharedImageFeatures = (texts) =>
  texts.map((text, index) => ({
    image: SHARED_FEATURE_IMAGES[index] || SHARED_FEATURE_IMAGES[0],
    text,
  }));

const GAME_WELCOME_CONTENT = {
  Mafia: {
    tileDescription: "Classic social deduction",
    headline: "The classic social deduction game, online.",
    description:
      "UltiMafia is a community-built rendition of Mafia. Join casual and competitive matches and build fully customizable setups tailored to your group.",
    features: MAFIA_FEATURES,
  },
  Resistance: {
    tileDescription: "Hidden spies and missions",
    headline: "Build teams, vote, and expose the spies.",
    description:
      "In Resistance, rebels try to complete missions while hidden spies sabotage them. Every vote and mission result reveals new clues.",
  },
  Jotto: {
    tileDescription: "Word deduction duel",
    headline: "Crack the word before your opponent does.",
    description:
      "Jotto is a logic word game where you infer a hidden word from letter-overlap clues and narrow the possibilities each turn.",
  },
  Acrotopia: {
    tileDescription: "Creative backronym battles",
    headline: "Turn acronyms into clever answers.",
    description:
      "Players receive an acronym and write creative backronyms. Everyone votes, points are awarded each round, and the top scorer wins.",
  },
  "Secret Dictator": {
    tileDescription: "Policy drafting and deception",
    headline: "Pass policies while hunting hidden fascists.",
    description:
      "Secret Dictator is a social strategy game of elections, policy cards, and bluffing. Liberals and fascists race toward different win conditions.",
  },
  "Wacky Words": {
    tileDescription: "Party prompts and votes",
    headline: "Write funny responses and win the room.",
    description:
      "Wacky Words is a creative party game where players answer prompts, vote for favorites, and score points across multiple modes.",
  },
  "Liars Dice": {
    tileDescription: "Bluff, bid, and challenge",
    headline: "Call bluffs at the right moment.",
    description:
      "Each player sees only their own dice. Raise bids or call a lie, and survive longer than everyone else to win.",
  },
  "Texas Hold Em": {
    tileDescription: "Poker tables online",
    headline: "Bet smart and build the best hand.",
    description:
      "Play Texas Hold Em with shared community cards, chip betting, and classic poker decision-making on each round.",
  },
  Cheat: {
    tileDescription: "Card bluffing chaos",
    headline: "Play honest cards or fake it.",
    description:
      "In Cheat, players race to empty their hand by playing required cards or bluffing. Catch lies to punish risky plays.",
  },
  Ratscrew: {
    tileDescription: "Fast slap-card action",
    headline: "Slap quickly and win the pile.",
    description:
      "Ratscrew is a reaction card game where players slap valid card patterns to claim the stack and build momentum.",
  },
  Battlesnakes: {
    tileDescription: "Arena survival strategy",
    headline: "Outmaneuver every other snake.",
    description:
      "Control your snake on a shared grid, collect food, avoid collisions, and be the last snake alive.",
  },
  "Connect Four": {
    tileDescription: "Classic four-in-a-row",
    headline: "Plan your drops and connect four first.",
    description:
      "Take turns dropping discs into the board and create a line of four before your opponent blocks you.",
  },
  "Dice Wars": {
    tileDescription: "Territory conquest",
    headline: "Expand your borders and roll for control.",
    description:
      "Dice Wars is a turn-based strategy game where you attack neighboring territories, reinforce connected regions, and eliminate rivals.",
  },
};

const GAME_FEATURES = {
  Mafia: MAFIA_FEATURES,
  Resistance: buildSharedImageFeatures([
    "Team proposals and vote phases create social reads every round.",
    "Mission outcomes reveal partial information, so lineup tracking matters.",
    "Spies must sabotage carefully while avoiding obvious blame.",
    "Great for deduction-focused groups with quick round flow.",
  ]),
  Jotto: buildSharedImageFeatures([
    "Use letter-match feedback to eliminate impossible words.",
    "Each guess gives information, even when it is incorrect.",
    "Win through logic, pattern recognition, and smart narrowing.",
    "A clean competitive word format with fast turns.",
  ]),
  Acrotopia: buildSharedImageFeatures([
    "Create witty backronyms from random acronyms.",
    "Players vote for favorites every round.",
    "Strong creativity and humor lead to higher scores.",
    "Perfect for party sessions with short, replayable rounds.",
  ]),
  "Secret Dictator": buildSharedImageFeatures([
    "Election rounds and policy drafting drive social pressure.",
    "Hidden teams must bluff around incomplete information.",
    "Executive powers shift momentum as the game progresses.",
    "Every policy vote becomes a key trust signal.",
  ]),
  "Wacky Words": buildSharedImageFeatures([
    "Answer prompts creatively to earn votes from other players.",
    "Multiple modes keep the pacing and style fresh.",
    "Scoring rewards humor, originality, and social reads.",
    "Ideal for casual groups that enjoy word-play party games.",
  ]),
  "Liars Dice": buildSharedImageFeatures([
    "Raise bids or call lies based on risk and probability.",
    "Read player confidence to catch bluffs at the right time.",
    "Special rules like spot-on calls add high-swing moments.",
    "Last player with dice remaining takes the win.",
  ]),
  "Texas Hold Em": buildSharedImageFeatures([
    "Build the strongest hand from hole cards and community cards.",
    "Bet sizing and position create deep strategic decisions.",
    "Bluffing and pot control matter as much as card strength.",
    "Great for competitive tables and social poker sessions.",
  ]),
  Cheat: buildSharedImageFeatures([
    "Play required cards honestly or bluff to dump your hand.",
    "Challenge suspicious plays to punish risky lies.",
    "Timing your calls is the key to controlling pile swings.",
    "Fast rounds make it easy to run multiple rematches.",
  ]),
  Ratscrew: buildSharedImageFeatures([
    "React quickly to valid slap patterns and claim the stack.",
    "Challenge incorrect slaps to swing cards back.",
    "Momentum shifts fast based on reflexes and judgment.",
    "A high-energy card mode for rapid multiplayer sessions.",
  ]),
  Battlesnakes: buildSharedImageFeatures([
    "Control movement each turn on a shared survival grid.",
    "Grow by collecting food while denying space to rivals.",
    "Pathing and board control decide late-game outcomes.",
    "Last snake alive wins the arena.",
  ]),
  "Connect Four": buildSharedImageFeatures([
    "Drop pieces with turn-by-turn tactical planning.",
    "Create forks and block opponent threats early.",
    "Spatial prediction is critical for consistent wins.",
    "Simple rules with strong head-to-head strategy depth.",
  ]),
  "Dice Wars": buildSharedImageFeatures([
    "Attack neighboring territories with dice total battles.",
    "Connected regions grant stronger reinforcement growth.",
    "Balance expansion pressure against defensive positioning.",
    "Eliminate opponents and hold the board to win.",
  ]),
};

// localStorage.setItem('firebase:debug', 'true');

if (localStorage.getItem("firebase:debug") !== null) {
  localStorage.removeItem("firebase:debug");
}
if (localStorage.getItem("showChatTab") !== null) {
  localStorage.removeItem("showChatTab");
}

export const Welcome = () => {
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState("Mafia");
  const isPhoneDevice = useIsPhoneDevice();
  const snackbarHook = useSnackbar();

  useEffect(() => {
    const auth = getAuth();
    auth.setPersistence(inMemoryPersistence);

    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        const idToken = await auth.currentUser.getIdToken(true);
        axios
          .post("/api/auth", { idToken })
          .then(() => {
            window.location.reload();
          })
          .catch((err) => {
            console.log(err);

            // Check if this is a site-ban error
            if (err?.response?.status === 403 && err?.response?.data) {
              try {
                const data =
                  typeof err.response.data === "string"
                    ? JSON.parse(err.response.data)
                    : err.response.data;
                if (data.siteBanned) {
                  snackbarHook.popSiteBanned(data.banExpires);
                  setIsLoading(false);
                  return;
                }
                if (data.deleted) {
                  snackbarHook.popUserDeleted();
                  setIsLoading(false);
                  return;
                }
              } catch (parseErr) {
                // Not a site-ban error, continue with regular error handling
              }
            }

            snackbarHook.popUnexpectedError();
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const paddingX = isPhoneDevice ? 1.5 : 5;
  const activeGame = useMemo(() => {
    return GameTypes.includes(selectedGame) ? selectedGame : "Mafia";
  }, [selectedGame]);

  const gameContent = GAME_WELCOME_CONTENT[activeGame] || GAME_WELCOME_CONTENT.Mafia;
  const infoCards = GAME_FEATURES[activeGame] || MAFIA_FEATURES;
  const activeBanner = siteInfo?.branding?.banners?.welcome || bannerImage;
  const activeGameTitle = siteInfo?.gameCatalogMap?.[activeGame]?.title || activeGame;

  if (user && user.loggedIn) {
    return <Navigate to="/play" />;
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          maxWidth: "1700px",
          mx: "auto",
          paddingLeft: paddingX,
          paddingRight: paddingX,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          pb: isPhoneDevice ? 4 : 8,
        }}
      >
        <Typography
          variant={isPhoneDevice ? "body1" : "h4"}
          align="center"
          color="text.secondary"
          paragraph
          sx={{
            m: 0,
            py: 2,
          }}
        >
          Play <Box component="span" sx={{ color: "primary.main" }}>{activeGameTitle}</Box> online.
        </Typography>
        <Grid2 container rowSpacing={1} columnSpacing={1} sx={{ alignItems: "stretch" }}>
          <Grid2
            size={{ xs: 12, md: 3 }}
            sx={{ display: "flex", order: { xs: 1, md: 1 } }}
          >
            <Paper
              elevation={2}
              sx={{
                p: 2,
                height: { xs: "auto", md: `${DESKTOP_COLUMN_HEIGHT}px` },
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflowY: { xs: "visible", md: "auto" },
              }}
            >
              <Auth defaultTab={0} />
            </Paper>
          </Grid2>

          <Grid2
            size={{ xs: 12, md: 6 }}
            sx={{ display: "flex", order: { xs: 3, md: 2 } }}
          >
            <Paper
              elevation={0}
              sx={{
                px: 2,
                pb: 0,
                pt: 0,
                height: { xs: "auto", md: `${DESKTOP_COLUMN_HEIGHT}px` },
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflowY: { xs: "visible", md: "auto" },
                backgroundColor: "transparent",
                backgroundImage: "none",
                boxShadow: "none",
              }}
            >
              <Box
                sx={{
                  mt: 0.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  flex: { xs: "0 0 auto", md: 1 },
                  minHeight: 0,
                }}
              >
                <Paper
                  elevation={2}
                  sx={{
                    p: 1.5,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <GameIcon gameType={activeGame} size={36} />
                    <Typography variant={isPhoneDevice ? "h5" : "h4"}>{activeGameTitle}</Typography>
                  </Box>
                  <Box
                    component="img"
                    src={activeBanner}
                    alt={`${activeGame} welcome banner`}
                    sx={{
                      width: "100%",
                      height: "auto",
                      objectFit: "contain",
                      mb: 1.5,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 1 }}>
                    {gameContent.headline}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 0 }}>
                    {gameContent.description}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <IconGallery />
                  </Box>
                </Paper>
                <Grid2
                  container
                  rowSpacing={2}
                  columnSpacing={2}
                  sx={{
                    flex: { xs: "0 0 auto", md: 1 },
                    minHeight: 0,
                    alignItems: "stretch",
                  }}
                >
                  {infoCards.map((card, index) => (
                    <Grid2
                      key={`${activeGame}-${index}`}
                      size={{ xs: 12, sm: 6, md: 3 }}
                      sx={{ display: "flex" }}
                    >
                      <Paper
                        elevation={2}
                        sx={{
                          p: 1.5,
                          display: "flex",
                          flexDirection: "column",
                          height: "100%",
                          flex: 1,
                          backgroundColor: "background.paper",
                        }}
                      >
                        {card.image ? (
                          <Box
                            component="img"
                            src={card.image}
                            alt={`${activeGame} welcome feature ${index + 1}`}
                            sx={{
                              width: "100%",
                              height: "auto",
                              objectFit: "contain",
                              mb: 1.5,
                            }}
                          />
                        ) : (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <GameIcon gameType={activeGame} size={22} />
                            <Typography variant="subtitle2">{card.title}</Typography>
                          </Box>
                        )}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          paragraph
                          sx={{ flex: 1, mb: 0 }}
                        >
                          {card.text}
                        </Typography>
                      </Paper>
                    </Grid2>
                  ))}
                </Grid2>
              </Box>
            </Paper>
          </Grid2>

          <Grid2
            size={{ xs: 12, md: 3 }}
            sx={{ display: "flex", order: { xs: 2, md: 3 } }}
          >
            <Paper
              elevation={2}
              sx={{
                p: 2,
                height: { xs: "auto", md: `${DESKTOP_COLUMN_HEIGHT}px` },
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflowY: { xs: "visible", md: "auto" },
              }}
            >
              <Grid2 container rowSpacing={1} columnSpacing={1}>
                {GameTypes.map((game) => (
                  <Grid2 key={game} size={{ xs: 6 }}>
                    <Box
                      component="button"
                      onClick={() => setSelectedGame(game)}
                      sx={{
                        width: "100%",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1,
                        backgroundColor: "background.paper",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        minHeight: 102,
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={getGameIconSrc(
                          game,
                          siteInfo?.branding?.gameLogos,
                          siteInfo?.gameCatalogMap
                        )}
                        alt={`${siteInfo?.gameCatalogMap?.[game]?.title || game} icon`}
                        sx={{ width: 38, height: 38, mb: 0.75 }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ textAlign: "center", lineHeight: 1.2, fontWeight: 600 }}
                      >
                        {siteInfo?.gameCatalogMap?.[game]?.title || game}
                      </Typography>
                    </Box>
                  </Grid2>
                ))}
              </Grid2>
            </Paper>
          </Grid2>
        </Grid2>
      </Container>
    </>
  );
};

export default Welcome;
