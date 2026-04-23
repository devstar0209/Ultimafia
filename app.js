const path = require("path");
const dotenv = require("dotenv").config({ path: path.join(__dirname, ".env") });
const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const cors = require("cors");
const passport = require("passport");

const logger = require("./modules/logging")(".");

// Routers
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const gameRouter = require("./routes/game");
const setupRouter = require("./routes/setup");
const deckRouter = require("./routes/anonymousDeck");
const roleRouter = require("./routes/roles");
const achievementsRouter = require("./routes/achievements");
const userRouter = require("./routes/user");
const forumsRouter = require("./routes/forums");
const votesRouter = require("./routes/votes");
const commentRouter = require("./routes/comment");
const strategyRouter = require("./routes/strategy");
const modRouter = require("./routes/mod");
const chatRouter = require("./routes/chat");
const notifsRouter = require("./routes/notifs");
const shopRouter = require("./routes/shop");
const stampTradesRouter = require("./routes/stampTrades");
const reportRouter = require("./routes/report");
const siteRouter = require("./routes/site");
const pollRouter = require("./routes/poll");
const competitiveRouter = require("./routes/competitive");
const vanityUrlRouter = require("./routes/vanityUrl");
const familyRouter = require("./routes/family");
const fanartRouter = require("./routes/fanart");
const itemsRouter = require("./routes/items");
const adminRouter = require("./routes/admin");

const session = require("./modules/session");
const csrf = require("./modules/csrf");

const app = express();

const frontendBuildPath = path.join(__dirname, "react_main/build_public");
const adminBuildPath = path.join(__dirname, "admin/build");

app.set("trust proxy", 1);

// ========================
// MIDDLEWARE
// ========================
app.use(morgan("combined", { stream: logger.stream }));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
  origin: ["https://passionmafia.io"],
  credentials: true
}));

app.use(helmet());

app.use(session);
app.use(passport.initialize());
app.use(passport.session());

app.use(csrf);

app.use(compression());

// ========================
// RATE LIMITING
// ========================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // increased to avoid blocking legit users
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

// ========================
// API ROUTES
// ========================
const apiRouter = express.Router();

apiRouter.use("/", indexRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/game", gameRouter);
apiRouter.use("/setup", setupRouter);
apiRouter.use("/deck", deckRouter);
apiRouter.use("/roles", roleRouter);
apiRouter.use("/achievements", achievementsRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/forums", forumsRouter);
apiRouter.use("/votes", votesRouter);
apiRouter.use("/comment", commentRouter);
apiRouter.use("/strategy", strategyRouter);
apiRouter.use("/mod", modRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/notifs", notifsRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/stampTrades", stampTradesRouter);
apiRouter.use("/report", reportRouter);
apiRouter.use("/site", siteRouter);
apiRouter.use("/poll", pollRouter);
apiRouter.use("/competitive", competitiveRouter);
apiRouter.use("/vanityUrl", vanityUrlRouter);
apiRouter.use("/family", familyRouter);
apiRouter.use("/items", itemsRouter);
apiRouter.use("/fanart", fanartRouter);
apiRouter.use("/admin", adminRouter);

// Apply limiters
app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/admin", adminLimiter);

// Origin guard
function originGuard(req, res, next) {
  const allowedOrigin = "https://passionmafia.io";
  const origin = req.headers.origin;

  if (!origin) return next();
  if (origin !== allowedOrigin) {
    return res.status(403).send("Forbidden");
  }

  next();
}

app.use("/api", originGuard, apiRouter);

// ========================
// STATIC FILES (CRITICAL ORDER)
// ========================

// Serve admin FIRST under /admin
app.use("/admin", express.static(adminBuildPath));

// Serve main frontend
app.use(express.static(frontendBuildPath));

// Uploads
app.use(
  "/uploads",
  express.static(path.join(__dirname, process.env.UPLOAD_PATH), {
    maxAge: "1h",
  })
);

// ========================
// SPA FALLBACK (FIXES MIME ERROR)
// ========================
app.get("*", (req, res) => {
  // ❌ prevent JS/CSS from being hijacked
  if (req.path.includes(".")) {
    return res.status(404).end();
  }

  if (req.path.startsWith("/admin")) {
    return res.sendFile(path.join(adminBuildPath, "index.html"));
  }

  return res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// ========================
// ERROR HANDLING
// ========================
app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  if (err.status === 404) {
    return res.status(404).send("404");
  }

  res.status(err.status || 500).send("Error");
});

module.exports = app;