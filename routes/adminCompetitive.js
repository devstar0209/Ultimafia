/**
 * Admin Competitive Management Routes
 * Handles creation and configuration of competitive seasons and ranked game terms
 */

const express = require("express");
const router = express.Router();
const models = require("../db/models");
const routeUtils = require("./utils");
const logger = require("../modules/logging")("(admin-competitive)");
const mongo = require("mongodb");
const ObjectID = mongo.ObjectID;
const { verifyAdminAccess } = require("./admin");

const iso8601DateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /admin/competitive/setups
 * List all setups with their competitive status
 */
router.get("/setups", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const setups = await models.Setup.find({})
      .sort("-createdAt")
      .select("id name competitive description createdAt updatedAt")
      .lean();

    const items = setups.map((setup) => ({
      id: setup._id || setup.id,
      name: setup.name,
      competitive: Boolean(setup.competitive),
      description: setup.description || "No description",
      createdAt: new Date(setup.createdAt).toLocaleDateString(),
      updatedAt: setup.updatedAt ? new Date(setup.updatedAt).toLocaleDateString() : "—",
    }));

    res.json({
      setups: items,
      total: items.length,
      competitiveCount: items.filter((s) => s.competitive).length,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error fetching setups" });
  }
});

/**
 * PATCH /admin/competitive/setups/:setupId/toggle
 * Toggle competitive status of a setup
 */
router.patch("/setups/:setupId/toggle", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { setupId } = req.params;
    const userId = req.user?.id;

    const setup = await models.Setup.findById(setupId);

    if (!setup) {
      return res.status(404).json({ error: "Setup not found" });
    }

    const newCompetitiveStatus = !setup.competitive;

    await models.Setup.updateOne(
      { _id: setupId },
      { $set: { competitive: newCompetitiveStatus, updatedAt: Date.now() } }
    );

    routeUtils.createModAction(
      userId,
      newCompetitiveStatus ? "Approved Setup for Competitive" : "Removed Setup from Competitive",
      [`Setup: ${setup.name}`, `ID: ${setupId}`]
    );

    res.json({
      success: true,
      setupId,
      competitive: newCompetitiveStatus,
      message: newCompetitiveStatus
        ? `"${setup.name}" is now approved for competitive play`
        : `"${setup.name}" has been removed from competitive play`,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error toggling competitive setup status" });
  }
});

/**
 * POST /admin/competitive/setups
 * Create a new competitive setup
 */
router.post("/setups", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Setup name is required" });
    }

    const setup = new models.Setup({
      name: name.trim(),
      description: description?.trim() || "",
      competitive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await setup.save();

    routeUtils.createModAction(userId, "Created Setup", [
      `Name: ${setup.name}`,
      `ID: ${setup._id}`,
    ]);

    res.json({
      success: true,
      setup: {
        id: setup._id,
        name: setup.name,
        description: setup.description,
        competitive: setup.competitive,
        createdAt: new Date(setup.createdAt).toLocaleDateString(),
        updatedAt: new Date(setup.updatedAt).toLocaleDateString(),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error creating setup" });
  }
});

/**
 * PATCH /admin/competitive/setups/:setupId
 * Update a competitive setup
 */
router.patch("/setups/:setupId", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { setupId } = req.params;
    const { name, description } = req.body;
    const userId = req.user?.id;

    const setup = await models.Setup.findById(setupId);

    if (!setup) {
      return res.status(404).json({ error: "Setup not found" });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Setup name is required" });
    }

    const oldName = setup.name;
    const updates = {
      name: name.trim(),
      description: description?.trim() || "",
      updatedAt: Date.now(),
    };

    const updated = await models.Setup.findByIdAndUpdate(setupId, updates, {
      new: true,
    }).lean();

    routeUtils.createModAction(userId, "Updated Setup", [
      `Old name: ${oldName}`,
      `New name: ${updated.name}`,
      `ID: ${setupId}`,
    ]);

    res.json({
      success: true,
      setup: {
        id: updated._id,
        name: updated.name,
        description: updated.description,
        competitive: updated.competitive,
        createdAt: new Date(updated.createdAt).toLocaleDateString(),
        updatedAt: new Date(updated.updatedAt).toLocaleDateString(),
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error updating setup" });
  }
});

/**
 * DELETE /admin/competitive/setups/:setupId
 * Delete a competitive setup
 */
router.delete("/setups/:setupId", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { setupId } = req.params;
    const userId = req.user?.id;

    const setup = await models.Setup.findById(setupId);

    if (!setup) {
      return res.status(404).json({ error: "Setup not found" });
    }

    await models.Setup.deleteOne({ _id: setupId });

    routeUtils.createModAction(userId, "Deleted Setup", [
      `Name: ${setup.name}`,
      `ID: ${setupId}`,
    ]);

    res.json({
      success: true,
      message: `"${setup.name}" has been deleted`,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error deleting setup" });
  }
});

/**
 * GET /admin/competitive/setups/approved
 * Get all approved competitive setups
 */
router.get("/setups/approved", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const setups = await models.Setup.find({ competitive: true })
      .select("id name")
      .lean();

    res.json({
      setups,
      count: setups.length,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error fetching approved competitive setups" });
  }
});

/**
 * GET /admin/competitive/seasons
 * List all competitive seasons with current status
 */
router.get("/seasons", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const seasons = await models.CompetitiveSeason.find({})
      .sort({ number: -1 })
      .select("number startDate currentRound numRounds setupsPerRound completed paused createdAt")
      .lean();

    const seasonsWithStatus = seasons.map((season) => ({
      ...season,
      status: season.completed ? "Completed" : season.paused ? "Paused" : "Active",
    }));

    res.json({ seasons: seasonsWithStatus });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error fetching competitive seasons" });
  }
});

/**
 * POST /admin/competitive/seasons/create
 * Create a new competitive season
 */
router.post("/seasons/create", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { startDate, numRounds, setupsPerRound } = req.body;
    const userId = req.user?.id;

    // Validate inputs
    if (!startDate || startDate.trim() === "") {
      return res.status(400).json({ error: "Start date is required (YYYY-MM-DD format)" });
    }

    if (!iso8601DateRegex.test(startDate)) {
      return res.status(400).json({ error: "Start date must be in YYYY-MM-DD format" });
    }

    const _startDate = new Date(startDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (_startDate < tomorrow) {
      return res.status(400).json({ error: "Start date must be at least one day in the future" });
    }

    // Check if season already in progress
    const latestSeason = await models.CompetitiveSeason.findOne({})
      .sort({ number: -1 })
      .lean();

    if (latestSeason && !latestSeason.completed) {
      return res.status(400).json({ error: "A competitive season is already in progress" });
    }

    // Get competitive setups
    const setups = await models.Setup.find({ competitive: true })
      .select("_id")
      .lean();

    if (setups.length === 0) {
      return res.status(400).json({ error: "No competitive setups approved. Admin must approve setups first." });
    }

    // Calculate season number
    const seasonNumber = (latestSeason?.number || 0) + 1;
    const _numRounds = Math.max(1, Number.parseInt(numRounds || "12"));
    const _setupsPerRound = Math.max(1, Number.parseInt(setupsPerRound || "2"));

    // Create setup order
    let setupIds = setups.map((s) => ObjectID(s._id));
    let setupOrder = [];

    for (let roundNumber = 0; roundNumber < _numRounds; roundNumber++) {
      let roundSetups = [];
      for (let i = 0; i < _setupsPerRound; i++) {
        const setupIndex = (roundNumber * _setupsPerRound + i) % setupIds.length;
        roundSetups.push(setupIndex);
      }
      setupOrder.push(roundSetups);
    }

    // Create season
    const season = new models.CompetitiveSeason({
      number: seasonNumber,
      startDate,
      setups: setupIds,
      setupOrder,
      numRounds: _numRounds,
      setupsPerRound: _setupsPerRound,
    });

    await season.save();

    // Log admin action
    routeUtils.createModAction(userId, "Create Competitive Season", [
      `Season ${seasonNumber}`,
      `Start: ${startDate}`,
      `Rounds: ${_numRounds}`,
      `Setups/Round: ${_setupsPerRound}`,
    ]);

    res.json({
      success: true,
      season: {
        number: season.number,
        startDate: season.startDate,
        numRounds: season.numRounds,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error creating competitive season" });
  }
});

/**
 * POST /admin/competitive/seasons/:seasonNumber/pause
 * Toggle pause state of a season
 */
router.post("/seasons/:seasonNumber/pause", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const { seasonNumber } = req.params;
    const userId = req.user?.id;

    const season = await models.CompetitiveSeason.findOne({
      number: Number(seasonNumber),
    });

    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }

    if (season.completed) {
      return res.status(400).json({ error: "Cannot pause a completed season" });
    }

    const newPauseState = !season.paused;

    await models.CompetitiveSeason.updateOne(
      { _id: season._id },
      { $set: { paused: newPauseState } }
    );

    routeUtils.createModAction(userId, `Toggle Season Pause (${newPauseState ? "Paused" : "Resumed"})`, [
      `Season ${seasonNumber}`,
    ]);

    res.json({
      success: true,
      paused: newPauseState,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error toggling season pause" });
  }
});

/**
 * GET /admin/competitive/ranked-terms
 * Get current ranked game terms/rules
 */
router.get("/ranked-terms", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const terms = await models.RankedGameTerms.findOne({ key: "default" });

    if (!terms) {
      // Return defaults
      return res.json({ terms: getDefaultRankedTerms() });
    }

    res.json({ terms: terms.toObject() });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error fetching ranked game terms" });
  }
});

/**
 * PATCH /admin/competitive/ranked-terms
 * Update ranked game terms/rules
 */
router.patch("/ranked-terms", async (req, res) => {
  try {
    if (!(await verifyAdminAccess(req, res))) return;

    const userId = req.user?.id;
    const {
      maxLeaveCount,
      maxReportCount,
      maxBanCount,
      joinGameTimeoutMinutes,
      afkTimeoutMinutes,
      winPoints,
      lossPoints,
      drawPoints,
      afkPenaltyPoints,
      leavePenaltyPoints,
      minGamesRequiredPerSeason,
      minWinsRequiredPerSeason,
      seasonResetFrequencyDays,
      ratingRangeDifference,
    } = req.body;

    const updated = await models.RankedGameTerms.findOneAndUpdate(
      { key: "default" },
      {
        maxLeaveCount: Number(maxLeaveCount || 3),
        maxReportCount: Number(maxReportCount || 2),
        maxBanCount: Number(maxBanCount || 1),
        joinGameTimeoutMinutes: Number(joinGameTimeoutMinutes || 5),
        afkTimeoutMinutes: Number(afkTimeoutMinutes || 10),
        winPoints: Number(winPoints || 100),
        lossPoints: Number(lossPoints || 10),
        drawPoints: Number(drawPoints || 50),
        afkPenaltyPoints: Number(afkPenaltyPoints || -25),
        leavePenaltyPoints: Number(leavePenaltyPoints || -50),
        minGamesRequiredPerSeason: Number(minGamesRequiredPerSeason || 5),
        minWinsRequiredPerSeason: Number(minWinsRequiredPerSeason || 1),
        seasonResetFrequencyDays: Number(seasonResetFrequencyDays || 90),
        ratingRangeDifference: Number(ratingRangeDifference || 300),
        updatedAt: Date.now(),
        updatedBy: userId || "unknown",
      },
      { upsert: true, new: true }
    );

    routeUtils.createModAction(userId, "Update Ranked Game Terms", [
      `Max Leaves: ${maxLeaveCount}`,
      `Win Points: ${winPoints}`,
      `Season Frequency: ${seasonResetFrequencyDays} days`,
    ]);

    res.json({
      success: true,
      terms: updated.toObject(),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Error updating ranked game terms" });
  }
});

/**
 * Get default ranked game terms
 */
function getDefaultRankedTerms() {
  return {
    key: "default",
    maxLeaveCount: 3,
    maxReportCount: 2,
    maxBanCount: 1,
    joinGameTimeoutMinutes: 5,
    afkTimeoutMinutes: 10,
    winPoints: 100,
    lossPoints: 10,
    drawPoints: 50,
    afkPenaltyPoints: -25,
    leavePenaltyPoints: -50,
    minGamesRequiredPerSeason: 5,
    minWinsRequiredPerSeason: 1,
    seasonResetFrequencyDays: 90,
    ratingRangeDifference: 300,
  };
}

module.exports = router;
