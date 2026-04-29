import React from "react";
import { createTheme } from "@mui/material";
import { Box } from "@mui/material";

import surprised from "images/emotes/surprised.webp";
import sad from "images/emotes/sad.webp";
import {
  isHalloweenThemeActive,
  isValentinesThemeActive,
} from "../utils/holidayThemes";

const CUSTOM_EXPAND_ICON = (
  <Box
    sx={{
      ".Mui-expanded & > .collapsIconWrapper": {
        display: "none",
      },
      ".expandIconWrapper": {
        display: "none",
      },
      ".Mui-expanded & > .expandIconWrapper": {
        display: "block",
      },
    }}
  >
    <div className="expandIconWrapper">
      <img src={surprised} alt="" />
    </div>
    <div className="collapsIconWrapper">
      <img src={sad} alt="" />
    </div>
  </Box>
);

export function getSiteTheme(customPrimaryColor, sitePalette = "dark") {
  const isValentines = isValentinesThemeActive();
  const isHalloween = isHalloweenThemeActive();

  // Determine primary color based on custom color, Halloween, or default
  const getPrimaryColor = (mode) => {
    if (customPrimaryColor) {
      return customPrimaryColor;
    }
    if (isHalloween) {
      return "#FF8C00";
    }
    else if (isValentines) {
      return "#fc007e";
    }
    // Different colors for light and dark modes
    else return mode === "light" ? "#c95d16" : "#ff8c42";
  };

  const getSecondaryColor = (mode) => {
    if (customPrimaryColor) {
      return customPrimaryColor;
    }
    if (isHalloween) {
      return "#FF8C00";
    }
    else if (isValentines) {
      return "#fc007e";
    }
    // Different colors for light and dark modes that complement the primary
    return mode === "light" ? "#2f9e96" : "#5fd1c7";
  };

  const lightPalette = {
    primary: {
      main: getPrimaryColor("light"),
      light: "#ffb26f",
      dark: "#c95d16",
    },
    secondary: {
      main: getSecondaryColor("light"),
      light: "#9df0e8",
      dark: "#2f9e96",
    },
    info: {
      main: "#2878c7",
    },
    success: {
      main: "#2f9e66",
    },
    warning: {
      main: "#c77918",
    },
    error: {
      main: "#d44b42",
    },
    background: {
      default: "#eef3f6",
      paper: "#ffffff",
    },
    text: {
      primary: "#17212b",
      secondary: "#53616e",
    },
  };

  const darkPalette = {
    primary: {
      main: getPrimaryColor("dark"),
      light: "#ffb26f",
      dark: "#c95d16",
    },
    secondary: {
      main: getSecondaryColor("dark"),
      light: "#9df0e8",
      dark: "#2f9e96",
    },
    info: {
      main: "#74b9ff",
    },
    success: {
      main: "#6dd3a0",
    },
    warning: {
      main: "#ffb347",
    },
    error: {
      main: "#ff6f61",
    },
    background: {
      default: "#0f141a",
      paper: "#16212b",
    },
    text: {
      primary: "#d7dee5",
      secondary: "#8f9ba6",
    },
  };

  const commonComponents = {
    MuiAccordion: {
      defaultProps: {
        defaultExpanded: true,
      },
      styleOverrides: {
        root: {
          backgroundColor: "var(--scheme-color-background)",
        },
      },
    },
    MuiAccordionSummary: {
      defaultProps: {
        expandIcon: CUSTOM_EXPAND_ICON,
      },
      styleOverrides: {
        expandIconWrapper: {
          transition: "none",
          "&.Mui-expanded": {
            transform: "none",
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        variant: "contained",
        color: "primary",
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
          paddingInline: 18,
          textTransform: "none",
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          opacity: 0.8,
          "&:hover": {
            opacity: 1,
          },
        },
      },
    },
    MuiModal: {
      defaultProps: {
        disableScrollLock: true,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: "none",
          border: `1px solid ${
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(23,33,43,0.12)"
          }`,
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }),
      },
      variants: [
        {
          props: { variant: "outlined" },
          style: {
            backgroundColor: "var(--scheme-color-sec)",
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: "none",
          border: `1px solid ${
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(23,33,43,0.12)"
          }`,
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backdropFilter: "blur(16px)",
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(22, 33, 43, 0.96)"
              : "rgba(255, 255, 255, 0.96)",
          border: `1px solid ${
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.1)"
              : "rgba(23,33,43,0.12)"
          }`,
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiTable: {
      minWidth: 650,
      size: "small",
    },
    MuiTableCell: {
      defaultProps: {
        align: "center",
      },
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
    MuiTabs: {
      defaultProps: {
        variant: "scrollable",
        scrollButtons: "auto",
        allowScrollButtonsMobile: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  };


  return createTheme({
    colorSchemes: {
      light: {
        components: {
          ...commonComponents,
        },
        palette: {
          ...lightPalette,
          activeAppBarText: {
            main: "var(--scheme-color-sec)",
          },
        },
      },
      dark: {
        components: {
          ...commonComponents,
        },
        palette: {
          ...darkPalette,
          activeAppBarText: {
            main: "var(--mui-palette-primary-main)",
          },
        },
      },
    },
    cssVariables: {
      colorSchemeSelector: "data",
    },
    shape: {
      borderRadius: 18,
    },
    typography: {
      fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
      h1: { fontSize: "2.8rem", fontWeight: 800, letterSpacing: 0 },
      h2: { fontSize: "2rem", fontWeight: 800, letterSpacing: 0 },
      h3: {
        fontSize: "1.05rem",
        fontWeight: 800,
        letterSpacing: 0,
        textTransform: "uppercase",
      },
      h4: { fontSize: "1rem", fontWeight: 700, letterSpacing: 0 },
      h5: { fontSize: "0.9rem", fontWeight: 700, letterSpacing: 0 },
      h6: { fontSize: "0.78rem", fontWeight: 700, letterSpacing: 0 },
      body1: { lineHeight: 1.65 },
      button: { fontWeight: 700, textTransform: "none" },
      italicRelation: {
        // "Created by", "Authored by", "In love with", etc.
        fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
        fontSize: "1em",
        fontStyle: "italic",
      },
    },
  });
}
