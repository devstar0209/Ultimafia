import React, { useContext, useEffect, useState } from "react";
import { Box, Container, Typography, Paper, Grid2 } from "@mui/material";
import { Navigate } from "react-router-dom";
import "css/main.css";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from "react-responsive-carousel";
import { Auth } from "../../components/Auth";
import IconGallery from "../../components/IconGallery";
import GameIcon, { getGameIconSrc } from "../../components/GameIcon";
import bannerImage from "../../images/welcome_page/banner.png";
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

const DESKTOP_COLUMN_HEIGHT = 800;


const GAME_WELCOME_CONTENT = {
  Mafia: {
    tileDescription: "Classic social deduction",
    headline: "The classic social deduction game, online.",
    description:
      "PassionMafia is a community-built rendition of Mafia. Join casual and competitive matches and build fully customizable setups tailored to your group.",
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
  const [carouselBanners, setCarouselBanners] = useState([]);
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
  const gameContent = GAME_WELCOME_CONTENT.Mafia;
  const activeBanner = siteInfo?.branding?.banners?.welcome || bannerImage;

  useEffect(() => {
    const carouselBannersFromContext = siteInfo?.branding?.banners?.carousel || [];
    setCarouselBanners(carouselBannersFromContext);
  }, [siteInfo?.branding?.banners?.carousel]);

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
          Play PassionMafia online.
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
                  <Box
                    component="img"
                    src={activeBanner}
                    alt="Welcome banner"
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
                </Paper>
                {carouselBanners.length > 0 ? (
                  <Paper
                    elevation={2}
                    sx={{
                      p: 0,
                      display: "flex",
                      flex: 1,
                      overflow: "hidden",
                      borderRadius: 1,
                    }}
                  >
                    <Carousel
                      showArrows
                      showStatus={false}
                      showThumbs={false}
                      infiniteLoop
                      autoPlay
                      interval={5000}
                      transitionTime={600}
                      swipeable
                      emulateTouch
                      dynamicHeight={false}
                      useKeyboardArrows
                      renderIndicator={(onClickHandler, isSelected, index, label) => (
                        <button
                          type="button"
                          onClick={onClickHandler}
                          style={{
                            background: isSelected ? "#333" : "#ccc",
                            border: "none",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            margin: "0 4px",
                            padding: 0,
                            cursor: "pointer",
                          }}
                          aria-label={`${label} ${index + 1}`}
                        />
                      )}
                    >
                      {carouselBanners.map((banner, index) => (
                        <Box
                          key={banner.id || banner._id || index}
                          component="img"
                          src={banner.url}
                          alt={`Carousel banner ${index + 1}`}
                          sx={{
                            width: "100%",
                            height: "auto",
                            objectFit: "cover",
                            minHeight: 150,
                          }}
                        />
                      ))}
                    </Carousel>
                  </Paper>
                ) : (
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
                  </Grid2>
                )}
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
                {(siteInfo?.gameCatalog || []).map((game) => (
                  <Grid2 key={game.key} size={{ xs: 6 }}>
                    <Box
                      component="div"
                      sx={{
                        width: "100%",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 0.75,
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        minHeight: 88,
                      }}
                    >
                      <Box
                        component="img"
                        src={getGameIconSrc(
                          game.key,
                          siteInfo?.branding?.gameLogos,
                          siteInfo?.gameCatalogMap
                        )}
                        alt={`${game.title || game.key} icon`}
                        sx={{
                          width: "100%",
                          height: "100%",
                          borderRadius: 2,
                          objectFit: "contain",
                        }}
                      />
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
