import React, { useCallback, useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

import {
  Alert,
  Button,
  LinearProgress,
  Stack,
} from "@mui/material";
import { SiteInfoContext, UserContext } from "Contexts";
import { useErrorAlert } from "components/Alerts";
import Form from "components/Form";
import { useForm } from "components/Form";
import Setup from "components/Setup";

import HostMafia from "./gameTypeHostForms/HostMafia";
import HostResistance from "./gameTypeHostForms/HostResistance";
import HostJotto from "./gameTypeHostForms/HostJotto";
import HostAcrotopia from "./gameTypeHostForms/HostAcrotopia";
import HostSecretDictator from "./gameTypeHostForms/HostSecretDictator";
import HostWackyWords from "./gameTypeHostForms/HostWackyWords";
import HostLiarsDice from "./gameTypeHostForms/HostLiarsDice";
import HostTexasHoldEm from "./gameTypeHostForms/HostTexasHoldEm";
import HostCheat from "./gameTypeHostForms/HostCheat";
import HostRatscrew from "./gameTypeHostForms/HostRatscrew";
import HostBattlesnakes from "./gameTypeHostForms/HostBattlesnakes";
import HostDiceWars from "./gameTypeHostForms/HostDiceWars";
import HostConnectFour from "./gameTypeHostForms/HostConnectFour";
import { useIsPhoneDevice } from "hooks/useIsPhoneDevice";
import { getSetupBackgroundColor } from "pages/Play/LobbyBrowser/gameRowColors";

export default function HostGameDialogue({ open, setOpen, setup, preSelectedDeck }) {
  const user = useContext(UserContext);
  const siteInfo = useContext(SiteInfoContext);
  const errorAlert = useErrorAlert();
  const isPhoneDevice = useIsPhoneDevice();
  const navigate = useNavigate();
  const [hosting, setHosting] = useState(false);

  const GameTypeHostForm = useCallback((gameType, catalogItem) => {
    switch (gameType) {
      case "Mafia":
        return HostMafia();
      case "Resistance":
        return HostResistance();
      case "Jotto":
        return HostJotto();
      case "Acrotopia":
        return HostAcrotopia();
      case "Secret Dictator":
        return HostSecretDictator();
      case "Wacky Words":
        return HostWackyWords();
      case "Liars Dice":
        return HostLiarsDice();
      case "Texas Hold Em":
        return HostTexasHoldEm(catalogItem);
      case "Cheat":
        return HostCheat();
      case "Ratscrew":
        return HostRatscrew();
      case "Battlesnakes":
        return HostBattlesnakes();
      case "Dice Wars":
        return HostDiceWars();
      case "Connect Four":
        return HostConnectFour();
      default:
        break;
    }

    // Fail fast
    throw new Error(
      `Failed to get form fields for game type: ${gameType}`
    );
  }, []);

  const gameCatalogItem = (siteInfo?.gameCatalog || []).find(
    (game) =>
      game.key === setup.gameType ||
      game.title === setup.gameType ||
      game.slug === setup.gameType
  );
  const [initialFormFields, onHostGame] = GameTypeHostForm(
    setup.gameType,
    gameCatalogItem
  );

  const [formFields, updateFormFields] = useForm(initialFormFields);

  useEffect(
    function () {
      const [newFormFields] = GameTypeHostForm(setup.gameType, gameCatalogItem);
      if (preSelectedDeck) {
        for (let field of newFormFields) {
          if (field.ref === "anonymousGame") field.value = true;
          if (field.ref === "anonymousDeckId") field.value = preSelectedDeck;
        }
      }
      for (let field of newFormFields) {
        if (field.ref === "lobby") {
          field.value = getDefaultLobby(setup.gameType, newFormFields);
        }
        if (field.ref === "lobbyName") {
          field.value = "";
        }
      }
      updateFormFields({ type: "setFields", fields: newFormFields });
    },
    [GameTypeHostForm, gameCatalogItem, setup.gameType, preSelectedDeck, updateFormFields]
  );

  function getFormFieldValue(ref) {
    if (ref === "lobby") return getDefaultLobby(setup.gameType, formFields);
    if (ref === "lobbyName") return "";
    for (let field of formFields) if (field.ref === ref) return field.value;
  }

  const onHostGameWrapper = async () => {
    if (hosting) return;

    setHosting(true);
    try {
      const res = await onHostGame(setup.id, getFormFieldValue);
      navigate(`/game/${res.data}`);
    } catch (e) {
      setHosting(false);
      errorAlert(e);
    }
  };

  const lobby = getFormFieldValue("lobby");
  const isRanked = getFormFieldValue("ranked");
  const isCompetitive = getFormFieldValue("competitive");
  const coinsRequired = Number(gameCatalogItem?.coins || 0);
  const startingChips = Number(gameCatalogItem?.startingChips || 50);
  const userCoins = Number(user?.coins || 0);
  const hasEnoughCoins = coinsRequired <= 0 || userCoins >= coinsRequired;

  useEffect(() => {
    if (isCompetitive) {
      updateFormFields({
        ref: "lobby",
        prop: "value",
        value: "Competitive",
      });
    }
  }, [isCompetitive, updateFormFields]);

  var alertText = "";

  if (!user.canPlayRanked && isRanked) {
    // TODO use npm link so that the frontend can access constants.js and stop hardcoding this
    alertText = `You must play 5 games before playing ranked.`;
  } else if (!hasEnoughCoins) {
    alertText = `This game requires ${coinsRequired} coins. You have ${userCoins} coins.`;
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          if (!hosting) setOpen(false);
        }}
        scroll="body"
        fullScreen={isPhoneDevice}
      >
        <DialogContent
          sx={{
            px: 2,
          }}
        >
          <Stack direction="column" spacing={1}>
            <Stack direction="row">
              <Button
                variant="outlined"
                onClick={() => setOpen(false)}
                disabled={hosting}
                sx={{
                  flex: "1",
                }}
              >
                Cancel
              </Button>
              <div style={{ flex: "1" }} />
              <Button
                onClick={onHostGameWrapper}
                disabled={!hasEnoughCoins || hosting}
                sx={{
                  flex: "1",
                }}
              >
                Host
              </Button>
            </Stack>
            {hosting && <LinearProgress />}
            <Setup
              setup={setup}
              backgroundColor={getSetupBackgroundColor(
                {
                  lobby: lobby,
                  competitive: isCompetitive,
                  ranked: isRanked,
                },
                true
              )}
            />
            {setup.gameType === "Texas Hold Em" && (
              <Alert severity="info">
                Starting chips: {startingChips.toLocaleString()}
              </Alert>
            )}
            {alertText && <Alert severity="warning">{alertText}</Alert>}
            <Form
              compact
              fields={formFields.filter(
                (field) => !["lobby", "lobbyName"].includes(field.ref)
              )}
              onChange={updateFormFields}
            />
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getDefaultLobby(gameType, fields = []) {
  const competitiveField = fields.find((field) => field.ref === "competitive");
  if (competitiveField?.value) return "Competitive";
  if (gameType === "Mafia") return "Main";
  return "Games";
}
