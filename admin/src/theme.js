import { createTheme } from "@mui/material/styles";

export const adminTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff8c42",
      light: "#ffb26f",
      dark: "#c95d16",
    },
    secondary: {
      main: "#5fd1c7",
      light: "#9df0e8",
      dark: "#2f9e96",
    },
    background: {
      default: "#0f141a",
      paper: "#16212b",
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
    info: {
      main: "#74b9ff",
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
    h1: {
      fontSize: "3rem",
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontSize: "2.25rem",
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontSize: "1.2rem",
      fontWeight: 700,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
    },
    h4: {
      fontSize: "1rem",
      fontWeight: 700,
    },
    body1: {
      lineHeight: 1.65,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
        },
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
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background:
            "linear-gradient(180deg, rgba(24,34,43,0.98) 0%, rgba(13,19,25,0.98) 100%)",
        },
      },
    },
  },
});
