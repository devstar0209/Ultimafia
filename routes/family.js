const express = require("express");
const routeUtils = require("./utils");
const redis = require("../modules/redis");
const models = require("../db/models");
const logger = require("../modules/logging")(".");
const router = express.Router();
const shortid = require("shortid");
const bluebird = require("bluebird");
const formidable = bluebird.promisifyAll(require("formidable"), {
  multiArgs: true,
});
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const uploadUtils = require("../lib/Utils");

const BASE_FAMILY_MEMBER_LIMIT = 20;
const EXPANDED_FAMILY_MEMBER_LIMIT = 25;
const FAMILY_UPLOAD_PATH = "families";
const FAMILY_PERKS = [
  {
    key: "expandedRoster",
    name: "Expanded Roster",
    description: "Raises the family member limit from 20 to 25.",
    cost: 1000,
  },
  {
    key: "familyBadge",
    name: "Family Badge",
    description: "Adds a cosmetic supporter badge to the family profile.",
    cost: 500,
  },
  {
    key: "trophySpotlight",
    name: "Trophy Spotlight",
    description: "Adds a cosmetic trophy spotlight perk to the family profile.",
    cost: 750,
  },
];

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFamilyMemberLimit(family) {
  return family?.perks?.includes("expandedRoster")
    ? EXPANDED_FAMILY_MEMBER_LIMIT
    : BASE_FAMILY_MEMBER_LIMIT;
}

function getMembershipRole(inFamily, family, user) {
  if (!inFamily || !family || !user) return null;
  const leaderId = family.leader?._id || family.leader;
  if (leaderId?.toString() === user._id.toString()) return "leader";
  return inFamily.role || "member";
}

function canManageFamilyApplications(role) {
  return role === "leader" || role === "officer";
}

async function getFamilyMembership(family, user) {
  if (!family || !user) return null;

  return models.InFamily.findOne({
    family: family._id,
    user: user._id,
  });
}

function buildFamilyQuests(family, trophyCount) {
  const memberCount = family.members ? family.members.length : 0;
  const memberLimit = getFamilyMemberLimit(family);
  const treasury = Number(family.treasury || 0);
  const perkCount = family.perks ? family.perks.length : 0;

  return [
    {
      id: "firstFive",
      name: "First Five",
      description: "Reach 5 family members.",
      current: Math.min(memberCount, 5),
      target: 5,
      completed: memberCount >= 5,
    },
    {
      id: "fullHouse",
      name: "Full House",
      description: `Reach the current member limit of ${memberLimit}.`,
      current: Math.min(memberCount, memberLimit),
      target: memberLimit,
      completed: memberCount >= memberLimit,
    },
    {
      id: "trophyCase",
      name: "Trophy Case",
      description: "Collect 5 trophies across all family members.",
      current: Math.min(trophyCount, 5),
      target: 5,
      completed: trophyCount >= 5,
    },
    {
      id: "communityChest",
      name: "Community Chest",
      description: "Deposit 1,000 coins into the family treasury.",
      current: Math.min(treasury, 1000),
      target: 1000,
      completed: treasury >= 1000,
    },
    {
      id: "perkCollector",
      name: "Perk Collector",
      description: "Buy all family perks.",
      current: Math.min(perkCount, FAMILY_PERKS.length),
      target: FAMILY_PERKS.length,
      completed: perkCount >= FAMILY_PERKS.length,
    },
  ];
}

function getFamilyPerks(family) {
  const owned = new Set(family?.perks || []);

  return FAMILY_PERKS.map((perk) => ({
    ...perk,
    owned: owned.has(perk.key),
  }));
}

function getFormImageFile(files = {}) {
  const image = files.image;
  return Array.isArray(image) ? image[0] : image;
}

function getFormFilePath(file) {
  return file?.filepath || file?.path;
}

function getFamilyUploadKey(familyId, type) {
  return `${familyId}_${type}`;
}

function getFamilyUploadUrl(familyId, type) {
  return uploadUtils.toPublicUrl(
    FAMILY_UPLOAD_PATH,
    getFamilyUploadKey(familyId, type)
  );
}

function getFamilyUploadAbsolutePath(familyId, type) {
  return path.join(
    uploadUtils.resolveUploadPath(FAMILY_UPLOAD_PATH),
    `${getFamilyUploadKey(familyId, type)}.webp`
  );
}

function removeFamilyUpload(currentUrl, familyId, type) {
  uploadUtils.removeUploadFile(currentUrl || getFamilyUploadUrl(familyId, type));

  // Older family images were stored at /uploads/<familyId>_family_avatar.webp.
  uploadUtils.removeUploadFile(
    `/uploads/${getFamilyUploadKey(familyId, type)}.webp`
  );
}

function movePendingFamilyAvatar(userId, familyId) {
  const pendingId = `pending_${userId}`;
  const pendingPath = getFamilyUploadAbsolutePath(pendingId, "family_avatar");

  if (!fs.existsSync(pendingPath)) return "";

  const avatarUrl = getFamilyUploadUrl(familyId, "family_avatar");
  const avatarPath = getFamilyUploadAbsolutePath(familyId, "family_avatar");

  uploadUtils.ensureDirectory(path.dirname(avatarPath));
  uploadUtils.removeUploadFile(avatarUrl);
  fs.renameSync(pendingPath, avatarPath);

  return avatarUrl;
}

router.get("/leaderboard", async function (req, res) {
  try {
    const families = await models.Family.find({})
      .select("id name avatar avatarUrl members treasury perks createdAt")
      .populate("members", "id")
      .lean();

    const memberIds = [];
    for (const family of families) {
      for (const member of family.members || []) {
        if (member?.id) memberIds.push(member.id);
      }
    }

    const trophyCounts = memberIds.length
      ? await models.Trophy.aggregate([
          {
            $match: {
              ownerId: { $in: memberIds },
              revoked: { $ne: true },
            },
          },
          { $group: { _id: "$ownerId", count: { $sum: 1 } } },
        ])
      : [];
    const trophyCountByUser = new Map(
      trophyCounts.map((item) => [item._id, item.count])
    );

    const leaderboard = families
      .map((family) => {
        const members = family.members || [];
        const trophyCount = members.reduce(
          (total, member) => total + (trophyCountByUser.get(member.id) || 0),
          0
        );
        const treasury = Number(family.treasury || 0);
        const perks = family.perks || [];
        const score =
          trophyCount * 100 +
          members.length * 25 +
          perks.length * 50 +
          Math.floor(treasury / 100);

        return {
          id: family.id,
          name: family.name,
          avatar: family.avatarUrl || family.avatar,
          memberCount: members.length,
          trophyCount,
          treasury,
          perkCount: perks.length,
          score,
          createdAt: family.createdAt,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.trophyCount - a.trophyCount ||
          b.memberCount - a.memberCount ||
          a.createdAt - b.createdAt
      )
      .slice(0, 25)
      .map((family, index) => ({
        ...family,
        rank: index + 1,
      }));

    res.send({ leaderboard });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading family leaderboard.");
  }
});

router.get("/discover", async function (req, res) {
  try {
    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "score");
    const openOnly = String(req.query.openOnly || "") === "true";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(6, Number(req.query.limit) || 12));
    const query = {};

    if (search) {
      query.name = { $regex: escapeRegex(search), $options: "i" };
    }

    if (openOnly) {
      query.applicationsOpen = { $ne: false };
    }

    const families = await models.Family.find(query)
      .select(
        "id name avatar avatarUrl leader members treasury perks applicationsOpen createdAt bio"
      )
      .populate("leader", "id name avatar vanityUrl")
      .populate("members", "id")
      .lean();

    const memberIds = [];
    for (const family of families) {
      for (const member of family.members || []) {
        if (member?.id) memberIds.push(member.id);
      }
    }

    const trophyCounts = memberIds.length
      ? await models.Trophy.aggregate([
          {
            $match: {
              ownerId: { $in: memberIds },
            },
          },
          {
            $group: {
              _id: "$ownerId",
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const trophyCountByUser = new Map(
      trophyCounts.map((entry) => [entry._id, entry.count])
    );

    const discoveredFamilies = families.map((family) => {
      const members = family.members || [];
      const trophyCount = members.reduce(
        (total, member) => total + (trophyCountByUser.get(member.id) || 0),
        0
      );
      const treasury = Number(family.treasury || 0);
      const perks = family.perks || [];
      const memberLimit = getFamilyMemberLimit(family);
      const score =
        trophyCount * 10 +
        members.length * 25 +
        perks.length * 50 +
        Math.floor(treasury / 100);

      return {
        id: family.id,
        name: family.name,
        avatar: family.avatarUrl || family.avatar,
        leader: family.leader
          ? {
              id: family.leader.id,
              name: family.leader.name,
              avatar: family.leader.avatar,
              vanityUrl: family.leader.vanityUrl,
            }
          : null,
        memberCount: members.length,
        memberLimit,
        applicationsOpen: family.applicationsOpen !== false,
        treasury,
        perkCount: perks.length,
        trophyCount,
        score,
        createdAt: family.createdAt,
        bioPreview: String(family.bio || "").replace(/\s+/g, " ").slice(0, 160),
      };
    });

    discoveredFamilies.sort((a, b) => {
      if (sort === "newest") return Number(b.createdAt) - Number(a.createdAt);
      if (sort === "members") return b.memberCount - a.memberCount;
      if (sort === "treasury") return b.treasury - a.treasury;
      if (sort === "open") {
        return (
          Number(b.applicationsOpen) - Number(a.applicationsOpen) ||
          b.score - a.score
        );
      }

      return (
        b.score - a.score ||
        b.memberCount - a.memberCount ||
        b.treasury - a.treasury ||
        Number(b.createdAt) - Number(a.createdAt)
      );
    });

    const total = discoveredFamilies.length;
    const start = (page - 1) * limit;

    res.send({
      families: discoveredFamilies.slice(start, start + limit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error discovering families.");
  }
});

router.get("/user/family", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);

    if (!userId) {
      res.send({ family: null });
      return;
    }

    var user = await models.User.findOne({ id: userId });
    if (!user) {
      res.send({ family: null });
      return;
    }

    const inFamily = await models.InFamily.findOne({
      user: user._id,
    });

    if (!inFamily || !inFamily.family) {
      res.send({ family: null });
      return;
    }

    // Get family ID - handle both populated and unpopulated references
    const familyId = inFamily.family._id || inFamily.family;

    // Query family directly and populate leader properly
    const family = await models.Family.findById(familyId)
      .select(
        "id name avatar avatarUrl leader members background backgroundUrl backgroundRepeatMode applicationsOpen treasury perks"
      )
      .populate("leader", "_id");

    if (!family) {
      res.send({ family: null });
      return;
    }

    const isLeader =
      family.leader &&
      family.leader._id &&
      family.leader._id.toString() === user._id.toString();
    const role = getMembershipRole(inFamily, family, user);
    const memberCount = family.members ? family.members.length : 0;

    res.send({
      family: {
        id: family.id,
        name: family.name,
        avatar: family.avatarUrl || family.avatar,
        background: family.backgroundUrl || family.background || false,
        backgroundRepeatMode: family.backgroundRepeatMode || "checker",
        isLeader: isLeader,
        role: role,
        canManageApplications: canManageFamilyApplications(role),
        memberCount: memberCount,
        memberLimit: getFamilyMemberLimit(family),
        applicationsOpen: family.applicationsOpen !== false,
        treasury: Number(family.treasury || 0),
        perks: getFamilyPerks(family),
      },
    });
  } catch (e) {
    logger.error(e);
    res.send({ family: null });
  }
});

router.post("/create", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId }).select("itemsOwned");

    if (!user.itemsOwned.createFamily) {
      res.status(500);
      res.send("You must purchase 'Create Family' from the Shop.");
      return;
    }

    // Check if user already has a family
    const existingFamily = await models.InFamily.findOne({
      user: user._id,
    });

    if (existingFamily) {
      res.status(500);
      res.send("You already belong to a family.");
      return;
    }

    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(500);
      res.send("Family name is required.");
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 20) {
      res.status(500);
      res.send("Family name must be 20 characters or less.");
      return;
    }

    const familyId = shortid.generate();
    const avatarUrl = movePendingFamilyAvatar(userId, familyId);

    const family = new models.Family({
      id: familyId,
      name: trimmedName,
      avatar: Boolean(avatarUrl),
      avatarUrl,
      founder: user._id,
      leader: user._id,
      members: [user._id],
      applicationsOpen: true,
      createdAt: Date.now(),
    });

    await family.save();

    // Add user to family
    const inFamily = new models.InFamily({
      user: user._id,
      family: family._id,
      role: "leader",
    });
    await inFamily.save();

    res.send({ familyId: familyId });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error creating family.");
  }
});

router.post("/avatar", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var user = await models.User.findOne({ id: userId }).select("itemsOwned");

    // Check if user has purchased createFamily
    if (!user.itemsOwned.createFamily) {
      res.status(500);
      res.send("You must purchase 'Create Family' from the Shop.");
      return;
    }

    // Check if user already has a family
    const inFamily = await models.InFamily.findOne({
      user: user._id,
    }).populate("family");

    let familyId;
    let isExistingFamily = false;

    if (inFamily && inFamily.family) {
      // User has an existing family, check if they're the leader
      const family = inFamily.family;
      if (family.leader.toString() !== user._id.toString()) {
        res.status(500);
        res.send("Only the family leader can upload an avatar.");
        return;
      }
      familyId = family.id;
      isExistingFamily = true;
    } else {
      // User doesn't have a family yet, store avatar temporarily with user ID
      familyId = `pending_${userId}`;
    }

    var form = new formidable();
    form.maxFileSize = 1024 * 1024;
    form.maxFields = 1;

    var [, files] = await form.parseAsync(req);
    const image = getFormImageFile(files);
    const imagePath = getFormFilePath(image);

    if (!imagePath) {
      res.status(400);
      res.send("Image file is required.");
      return;
    }

    if (isExistingFamily) {
      removeFamilyUpload(inFamily.family.avatarUrl, familyId, "family_avatar");
    }

    const imageUrl = await uploadUtils.uploadImage(
      imagePath,
      FAMILY_UPLOAD_PATH,
      getFamilyUploadKey(familyId, "family_avatar"),
      {
        resize: {
          width: 100,
          height: 100,
          kernel: sharp.kernel.lanczos3,
          fit: sharp.fit.cover,
          position: sharp.strategy.center,
        },
        quality: 100,
      }
    );

    // If it's an existing family, update the database
    if (isExistingFamily) {
      await models.Family.updateOne(
        { id: familyId },
        { $set: { avatar: true, avatarUrl: imageUrl } }
      );
    }

    res.send({ url: imageUrl });
  } catch (e) {
    res.status(500);

    if (e.message && e.message.indexOf("maxFileSize exceeded") === 0)
      res.send("Image is too large, avatar must be less than 1 MB.");
    else {
      logger.error(e);
      res.send("Error uploading family avatar image.");
    }
  }
});

router.get("/:familyId/profile", async function (req, res) {
  try {
    var familyId = req.params.familyId;
    var userId = await routeUtils.verifyLoggedIn(req, true);

    var family = await models.Family.findOne({ id: familyId })
      .populate("founder", "id name avatar vanityUrl")
      .populate("leader", "id name avatar vanityUrl")
      .populate("members", "id name avatar vanityUrl");

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if leader is populated (required)
    if (!family.leader) {
      logger.error("Family leader not populated", { familyId });
      res.status(500);
      res.send("Error loading family profile: missing leader data.");
      return;
    }

    // If founder doesn't exist (for old families), use leader as founder
    if (!family.founder) {
      family.founder = family.leader;
      // Optionally update the database to set founder
      await models.Family.updateOne(
        { id: familyId },
        { $set: { founder: family.leader._id } }
      );
    }

    var user = userId ? await models.User.findOne({ id: userId }) : null;
    var isLeader = user && family.leader._id.toString() === user._id.toString();
    var leaderId = family.leader.id;
    var founderId = family.founder.id;
    var currentMembership = user ? await getFamilyMembership(family, user) : null;
    var userRole = getMembershipRole(currentMembership, family, user);
    var familyMemberships = await models.InFamily.find({
      family: family._id,
    }).populate("user", "id");
    var roleByUserId = new Map(
      familyMemberships
        .filter((membership) => membership.user?.id)
        .map((membership) => [membership.user.id, membership.role || "member"])
    );

    // Get member info with leader/founder flags
    var members = (family.members || []).map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      vanityUrl: member.vanityUrl,
      isLeader: member.id === leaderId,
      isFounder: member.id === founderId,
      role:
        member.id === leaderId
          ? "leader"
          : roleByUserId.get(member.id) || "member",
    }));

    // Get all trophies from all family members, sorted by createdAt
    var memberIds = [];
    if (family.members && family.members.length > 0) {
      memberIds = family.members
        .filter((member) => member && member.id) // Filter out any null/undefined members
        .map((member) => member.id);
    }

    // If no members, return empty trophies array
    var allTrophies = [];
    if (memberIds.length > 0) {
      try {
        allTrophies = await models.Trophy.find({
          ownerId: { $in: memberIds },
          revoked: { $ne: true },
        })
          .populate("owner", "id name avatar vanityUrl")
          .select("id name ownerId owner type createdAt -_id")
          .sort("-createdAt")
          .lean();
      } catch (trophyError) {
        logger.error("Error fetching family trophies:", trophyError);
        allTrophies = [];
      }
    }

    var trophies = (allTrophies || []).map((trophy) => ({
      id: trophy.id,
      name: trophy.name,
      ownerId: trophy.ownerId,
      type: trophy.type || "silver", // Default to silver for backward compatibility
      owner: trophy.owner
        ? {
            id: trophy.owner.id,
            name: trophy.owner.name,
            avatar: trophy.owner.avatar,
            vanityUrl: trophy.owner.vanityUrl,
          }
        : null,
      createdAt: trophy.createdAt,
    }));

    res.send({
      id: family.id,
      name: family.name,
      avatar: family.avatarUrl || family.avatar,
      background: family.backgroundUrl || family.background || false,
      backgroundRepeatMode: family.backgroundRepeatMode || "checker",
      bio: family.bio,
      founder: {
        id: family.founder.id,
        name: family.founder.name,
        avatar: family.founder.avatar,
        vanityUrl: family.founder.vanityUrl,
      },
      leader: {
        id: family.leader.id,
        name: family.leader.name,
        avatar: family.leader.avatar,
        vanityUrl: family.leader.vanityUrl,
      },
      members: members,
      trophies: trophies || [],
      trophyCount: trophies ? trophies.length : 0,
      isLeader: isLeader,
      userRole: userRole,
      canManageApplications: canManageFamilyApplications(userRole),
      applicationsOpen: family.applicationsOpen !== false,
      treasury: Number(family.treasury || 0),
      memberLimit: getFamilyMemberLimit(family),
      perks: getFamilyPerks(family),
      quests: buildFamilyQuests(family, trophies ? trophies.length : 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading family profile.");
  }
});

router.post("/:familyId/bio", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can edit the bio.");
      return;
    }

    const { bio } = req.body;

    if (bio && bio.length > 20000) {
      res.status(500);
      res.send("Family bio must be 20,000 characters or less.");
      return;
    }

    await models.Family.updateOne(
      { id: familyId },
      { $set: { bio: bio || "" } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating family bio.");
  }
});

router.post("/:familyId/applicationsOpen", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var { applicationsOpen } = req.body;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can change application settings.");
      return;
    }

    await models.Family.updateOne(
      { id: familyId },
      { $set: { applicationsOpen: Boolean(applicationsOpen) } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating application settings.");
  }
});

router.post("/:familyId/apply", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var message = String(req.body.message || "").trim();

    if (message.length > 500) {
      res.status(500);
      res.send("Application message must be 500 characters or less.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    if (family.applicationsOpen === false) {
      res.status(500);
      res.send("This family is not accepting applications.");
      return;
    }

    if ((family.members || []).length >= getFamilyMemberLimit(family)) {
      res.status(500);
      res.send("This family has reached its member limit.");
      return;
    }

    var existingFamily = await models.InFamily.findOne({
      user: user._id,
    });

    if (existingFamily) {
      res.status(500);
      res.send("You already belong to a family.");
      return;
    }

    var existingApplication = await models.FamilyApplication.findOne({
      familyId: familyId,
      applicantId: userId,
      status: "pending",
    });

    if (existingApplication) {
      res.status(500);
      res.send("You already have a pending application for this family.");
      return;
    }

    await new models.FamilyApplication({
      familyId: familyId,
      family: family._id,
      applicantId: userId,
      applicant: user._id,
      message: message,
      createdAt: Date.now(),
    }).save();

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error submitting family application.");
  }
});

router.get("/:familyId/applications", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var membership = await getFamilyMembership(family, user);
    var role = getMembershipRole(membership, family, user);
    if (!canManageFamilyApplications(role)) {
      res.status(500);
      res.send("Only family leaders and officers can view applications.");
      return;
    }

    var applications = await models.FamilyApplication.find({
      familyId: familyId,
      status: "pending",
    })
      .populate("applicant", "id name avatar vanityUrl")
      .sort("createdAt")
      .lean();

    res.send({
      applications: applications
        .filter((application) => application.applicant)
        .map((application) => ({
          id: application._id,
          applicant: {
            id: application.applicant.id,
            name: application.applicant.name,
            avatar: application.applicant.avatar,
            vanityUrl: application.applicant.vanityUrl,
          },
          message: application.message || "",
          createdAt: application.createdAt,
        })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading family applications.");
  }
});

async function resolveFamilyApplication(req, res, status) {
  var userId = await routeUtils.verifyLoggedIn(req);
  var familyId = req.params.familyId;
  var applicationId = req.params.applicationId;

  var user = await models.User.findOne({ id: userId });
  var family = await models.Family.findOne({ id: familyId });

  if (!family) {
    res.status(404);
    res.send("Family not found.");
    return;
  }

  var membership = await getFamilyMembership(family, user);
  var role = getMembershipRole(membership, family, user);
  if (!canManageFamilyApplications(role)) {
    res.status(500);
    res.send("Only family leaders and officers can manage applications.");
    return;
  }

  var application = await models.FamilyApplication.findOne({
    _id: applicationId,
    familyId: familyId,
    status: "pending",
  }).populate("applicant", "id name");

  if (!application || !application.applicant) {
    res.status(404);
    res.send("Application not found.");
    return;
  }

  if (status === "accepted") {
    if ((family.members || []).length >= getFamilyMemberLimit(family)) {
      res.status(500);
      res.send("This family has reached its member limit.");
      return;
    }

    var existingFamily = await models.InFamily.findOne({
      user: application.applicant._id,
    });

    if (existingFamily) {
      res.status(500);
      res.send("User already belongs to a family.");
      return;
    }

    await new models.InFamily({
      user: application.applicant._id,
      family: family._id,
      role: "member",
    }).save();

    await models.Family.updateOne(
      { id: familyId },
      { $push: { members: application.applicant._id } }
    );
  }

  await models.FamilyApplication.updateOne(
    { _id: application._id },
    {
      $set: {
        status: status,
        resolvedAt: Date.now(),
        resolvedBy: userId,
      },
    }
  );

  await routeUtils.createNotification(
    {
      content:
        status === "accepted"
          ? `Your application to join ${family.name} was accepted!`
          : `Your application to join ${family.name} was rejected.`,
      icon: "fas fa-users",
      link: `/user/family/${familyId}`,
    },
    [application.applicant.id]
  );

  res.sendStatus(200);
}

router.post("/:familyId/applications/:applicationId/accept", async function (req, res) {
  try {
    await resolveFamilyApplication(req, res, "accepted");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error accepting family application.");
  }
});

router.post("/:familyId/applications/:applicationId/reject", async function (req, res) {
  try {
    await resolveFamilyApplication(req, res, "rejected");
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error rejecting family application.");
  }
});

router.post("/:familyId/member/:memberId/role", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var memberId = req.params.memberId;
    var role = String(req.body.role || "");

    if (role !== "member" && role !== "officer") {
      res.status(500);
      res.send("Invalid family role.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can change member roles.");
      return;
    }

    var member = await models.User.findOne({ id: memberId });
    if (!member) {
      res.status(404);
      res.send("Member not found.");
      return;
    }

    if (family.leader.toString() === member._id.toString()) {
      res.status(500);
      res.send("The family leader role is changed by transferring leadership.");
      return;
    }

    var result = await models.InFamily.updateOne(
      { user: member._id, family: family._id },
      { $set: { role: role } }
    );

    if (!result.matchedCount) {
      res.status(500);
      res.send("User is not a member of this family.");
      return;
    }

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating family role.");
  }
});

router.get("/:familyId/ledger", async function (req, res) {
  try {
    var familyId = req.params.familyId;
    var ledger = await models.FamilyLedger.find({ familyId: familyId })
      .populate("user", "id name avatar vanityUrl")
      .sort("-createdAt")
      .limit(20)
      .lean();

    res.send({
      ledger: ledger.map((entry) => ({
        id: entry._id,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        createdAt: entry.createdAt,
        user: entry.user
          ? {
              id: entry.user.id,
              name: entry.user.name,
              avatar: entry.user.avatar,
              vanityUrl: entry.user.vanityUrl,
            }
          : null,
      })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error loading family ledger.");
  }
});

router.post("/:familyId/treasury/deposit", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var amount = Math.floor(Number(req.body.amount || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(500);
      res.send("Deposit amount must be a positive number.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var membership = await getFamilyMembership(family, user);
    if (!membership) {
      res.status(500);
      res.send("Only family members can deposit coins.");
      return;
    }

    var debit = await models.User.findOneAndUpdate(
      { id: userId, coins: { $gte: amount } },
      { $inc: { coins: -amount } },
      { new: true }
    )
      .select("coins balanceDollar")
      .lean();

    if (!debit) {
      res.status(500);
      res.send("You do not have enough coins for this deposit.");
      return;
    }

    var updatedFamily = await models.Family.findOneAndUpdate(
      { id: familyId },
      { $inc: { treasury: amount } },
      { new: true }
    )
      .select("treasury")
      .lean();

    await new models.FamilyLedger({
      familyId: familyId,
      family: family._id,
      userId: userId,
      user: user._id,
      type: "deposit",
      amount: amount,
      description: `Deposited ${amount} coins`,
      createdAt: Date.now(),
    }).save();

    await redis.cacheUserInfo(userId, true);

    res.send({
      coins: Number(debit.coins || 0),
      balanceDollar: Number(debit.balanceDollar || 0),
      treasury: Number(updatedFamily?.treasury || 0),
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error depositing into family treasury.");
  }
});

router.post("/:familyId/perks/:perkKey/buy", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var perkKey = req.params.perkKey;
    var perk = FAMILY_PERKS.find((item) => item.key === perkKey);

    if (!perk) {
      res.status(404);
      res.send("Family perk not found.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var membership = await getFamilyMembership(family, user);
    var role = getMembershipRole(membership, family, user);
    if (!canManageFamilyApplications(role)) {
      res.status(500);
      res.send("Only family leaders and officers can buy perks.");
      return;
    }

    if ((family.perks || []).includes(perk.key)) {
      res.status(500);
      res.send("This family already owns that perk.");
      return;
    }

    var result = await models.Family.updateOne(
      {
        id: familyId,
        treasury: { $gte: perk.cost },
        perks: { $ne: perk.key },
      },
      {
        $inc: { treasury: -perk.cost },
        $push: { perks: perk.key },
      }
    );

    if (!result.modifiedCount) {
      res.status(500);
      res.send("The family treasury does not have enough coins.");
      return;
    }

    await new models.FamilyLedger({
      familyId: familyId,
      family: family._id,
      userId: userId,
      user: user._id,
      type: "perk",
      amount: -perk.cost,
      description: `Bought ${perk.name}`,
      createdAt: Date.now(),
    }).save();

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error buying family perk.");
  }
});

router.post("/:familyId/transferLeadership", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var { newLeaderId } = req.body;

    if (!newLeaderId) {
      res.status(500);
      res.send("New leader ID is required.");
      return;
    }

    var family = await models.Family.findOne({ id: familyId }).populate(
      "members",
      "id"
    );

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var user = await models.User.findOne({ id: userId });
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the current leader can transfer leadership.");
      return;
    }

    var newLeader = await models.User.findOne({ id: newLeaderId });
    if (!newLeader) {
      res.status(404);
      res.send("New leader not found.");
      return;
    }

    // Check if new leader is a member of the family
    var isMember = family.members.some((member) => member.id === newLeaderId);
    if (!isMember) {
      res.status(500);
      res.send("The new leader must be a member of the family.");
      return;
    }

    // Transfer leadership
    await models.Family.updateOne(
      { id: familyId },
      { $set: { leader: newLeader._id } }
    );
    await models.InFamily.updateOne(
      { user: user._id, family: family._id },
      { $set: { role: "member" } }
    );
    await models.InFamily.updateOne(
      { user: newLeader._id, family: family._id },
      { $set: { role: "leader" } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error transferring leadership.");
  }
});

router.delete("/:familyId/member/:memberId", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var memberId = req.params.memberId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if user is the leader
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can remove members.");
      return;
    }

    // Find the member to remove
    var memberToRemove = await models.User.findOne({ id: memberId });
    if (!memberToRemove) {
      res.status(404);
      res.send("Member not found.");
      return;
    }

    // Check if member is actually in the family
    var inFamily = await models.InFamily.findOne({
      user: memberToRemove._id,
      family: family._id,
    });

    if (!inFamily) {
      res.status(500);
      res.send("User is not a member of this family.");
      return;
    }

    // Cannot remove the leader
    if (family.leader.toString() === memberToRemove._id.toString()) {
      res.status(500);
      res.send("Cannot remove the family leader. Transfer leadership first.");
      return;
    }

    // Remove member from family
    await models.InFamily.deleteOne({
      user: memberToRemove._id,
      family: family._id,
    });

    // Remove from members array
    await models.Family.updateOne(
      { id: familyId },
      { $pull: { members: memberToRemove._id } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error removing member from family.");
  }
});

router.delete("/:familyId", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can delete the family.");
      return;
    }

    // Remove all members from the family
    await models.InFamily.deleteMany({ family: family._id });

    // Delete all pending join requests
    await models.FamilyJoinRequest.deleteMany({ family: family._id });
    await models.FamilyApplication.deleteMany({ family: family._id });
    await models.FamilyLedger.deleteMany({ family: family._id });

    // Delete the family images if they exist
    removeFamilyUpload(family.avatarUrl, familyId, "family_avatar");
    removeFamilyUpload(family.backgroundUrl, familyId, "familyBackground");

    // Delete the family
    await models.Family.deleteOne({ id: familyId });

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error deleting family.");
  }
});

router.post("/:familyId/requestJoin", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var targetUserId = String(req.body.targetUserId);

    var family = await models.Family.findOne({ id: familyId })
      .populate("leader", "id name")
      .populate("members");

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if requester is the leader
    var requester = await models.User.findOne({ id: userId });
    var requesterMembership = await getFamilyMembership(family, requester);
    var requesterRole = getMembershipRole(requesterMembership, family, requester);
    if (!canManageFamilyApplications(requesterRole)) {
      res.status(500);
      res.send("Only family leaders and officers can send join requests.");
      return;
    }

    // Check if family is at member limit
    const currentMemberCount = family.members.length;
    if (currentMemberCount >= getFamilyMemberLimit(family)) {
      res.status(500);
      res.send("This family has reached its member limit.");
      return;
    }

    // Check if target user is already a member
    var targetUser = await models.User.findOne({ id: targetUserId });
    if (!targetUser) {
      res.status(404);
      res.send("Target user not found.");
      return;
    }

    var isMember = await models.InFamily.findOne({
      user: targetUser._id,
      family: family._id,
    });

    if (isMember) {
      res.status(500);
      res.send("User is already a member of this family.");
      return;
    }

    // Check if target user already belongs to another family
    var existingFamily = await models.InFamily.findOne({
      user: targetUser._id,
    });

    if (existingFamily) {
      res.status(500);
      res.send("User already belongs to a family.");
      return;
    }

    // Check if there's already a pending request
    var existingRequest = await models.FamilyJoinRequest.findOne({
      familyId: familyId,
      requesterId: targetUserId,
    });

    if (existingRequest) {
      res.status(500);
      res.send("A join request has already been sent to this user.");
      return;
    }

    // Create join request
    var joinRequest = new models.FamilyJoinRequest({
      familyId: familyId,
      family: family._id,
      requesterId: targetUserId,
      requester: targetUser._id,
      createdAt: Date.now(),
    });
    await joinRequest.save();

    // Create notification
    var requesterName = await redis.getUserName(userId);
    await routeUtils.createNotification(
      {
        content: `${requesterName} invited you to join ${family.name}!`,
        icon: "fas fa-users",
        link: `/user/family/${familyId}`,
      },
      [targetUserId]
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error sending join request.");
  }
});

router.post("/:familyId/acceptJoin", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    var user = await models.User.findOne({ id: userId });

    // Check if there's a pending request for this user
    var joinRequest = await models.FamilyJoinRequest.findOne({
      familyId: familyId,
      requesterId: userId,
    });

    if (!joinRequest) {
      res.status(404);
      res.send("No pending join request found.");
      return;
    }

    // Check if family is at member limit
    const currentMemberCount = family.members.length;
    if (currentMemberCount >= getFamilyMemberLimit(family)) {
      res.status(500);
      res.send("This family has reached its member limit.");
      return;
    }

    // Check if user already belongs to another family
    var existingFamily = await models.InFamily.findOne({
      user: user._id,
    });

    if (existingFamily) {
      res.status(500);
      res.send("You already belong to a family.");
      return;
    }

    // Add user to family
    var inFamily = new models.InFamily({
      user: user._id,
      family: family._id,
      role: "member",
    });
    await inFamily.save();

    // Update family members array
    await models.Family.updateOne(
      { id: familyId },
      { $push: { members: user._id } }
    );

    // Delete the join request
    await models.FamilyJoinRequest.deleteOne({ _id: joinRequest._id });

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error accepting join request.");
  }
});

router.post("/:familyId/leave", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if user is a member
    var inFamily = await models.InFamily.findOne({
      user: user._id,
      family: family._id,
    });

    if (!inFamily) {
      res.status(500);
      res.send("You are not a member of this family.");
      return;
    }

    // Cannot leave if you are the leader
    if (family.leader.toString() === user._id.toString()) {
      res.status(500);
      res.send(
        "The family leader cannot leave. Transfer leadership or delete the family instead."
      );
      return;
    }

    // Remove member from family
    await models.InFamily.deleteOne({
      user: user._id,
      family: family._id,
    });

    // Remove from members array
    await models.Family.updateOne(
      { id: familyId },
      { $pull: { members: user._id } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error leaving family.");
  }
});

router.post("/:familyId/rejectJoin", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var joinRequest = await models.FamilyJoinRequest.findOne({
      familyId: familyId,
      requesterId: userId,
    });

    if (!joinRequest) {
      res.status(404);
      res.send("No pending join request found.");
      return;
    }

    // Delete the join request
    await models.FamilyJoinRequest.deleteOne({ _id: joinRequest._id });

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error rejecting join request.");
  }
});

router.get("/:familyId/pendingInvite", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req, true);
    var familyId = req.params.familyId;

    if (!userId) {
      res.send({ hasPendingInvite: false });
      return;
    }

    var joinRequest = await models.FamilyJoinRequest.findOne({
      familyId: familyId,
      requesterId: userId,
    })
      .populate("family", "id name avatar avatarUrl")
      .populate("requester", "id name avatar");

    if (!joinRequest) {
      res.send({ hasPendingInvite: false });
      return;
    }

    res.send({
      hasPendingInvite: true,
      family: {
        id: joinRequest.family.id,
        name: joinRequest.family.name,
        avatar: joinRequest.family.avatarUrl || joinRequest.family.avatar,
      },
    });
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error checking pending invite.");
  }
});

router.post("/:familyId/background", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if user is the leader
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can upload a background.");
      return;
    }

    var form = new formidable();
    form.maxFileSize = 5 * 1024 * 1024; // 5 MB
    form.maxFields = 1;

    var [, files] = await form.parseAsync(req);
    const image = getFormImageFile(files);
    const imagePath = getFormFilePath(image);

    if (!imagePath) {
      res.status(400);
      res.send("Image file is required.");
      return;
    }

    removeFamilyUpload(family.backgroundUrl, familyId, "familyBackground");

    const imageUrl = await uploadUtils.uploadImage(
      imagePath,
      FAMILY_UPLOAD_PATH,
      getFamilyUploadKey(familyId, "familyBackground"),
      {
        quality: 100,
      }
    );

    await models.Family.updateOne(
      { id: familyId },
      { $set: { background: true, backgroundUrl: imageUrl } }
    );

    res.send({ url: imageUrl });
  } catch (e) {
    logger.error(e);
    res.status(500);

    if (e.message && e.message.indexOf("maxFileSize exceeded") == 0)
      res.send("Image is too large, background must be less than 5 MB.");
    else res.send("Error uploading family background.");
  }
});

router.delete("/:familyId/background", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if user is the leader
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send("Only the family leader can remove the background.");
      return;
    }

    removeFamilyUpload(family.backgroundUrl, familyId, "familyBackground");

    await models.Family.updateOne(
      { id: familyId },
      { $set: { background: false, backgroundUrl: "" } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error removing family background.");
  }
});

router.post("/:familyId/backgroundRepeatMode", async function (req, res) {
  try {
    var userId = await routeUtils.verifyLoggedIn(req);
    var familyId = req.params.familyId;
    var { backgroundRepeatMode } = req.body;

    var user = await models.User.findOne({ id: userId });
    var family = await models.Family.findOne({ id: familyId });

    if (!family) {
      res.status(404);
      res.send("Family not found.");
      return;
    }

    // Check if user is the leader
    if (family.leader.toString() !== user._id.toString()) {
      res.status(500);
      res.send(
        "Only the family leader can change the background display mode."
      );
      return;
    }

    if (
      backgroundRepeatMode !== "checker" &&
      backgroundRepeatMode !== "stretch"
    ) {
      res.status(500);
      res.send(
        "Invalid background repeat mode. Must be 'checker' or 'stretch'."
      );
      return;
    }

    await models.Family.updateOne(
      { id: familyId },
      { $set: { backgroundRepeatMode: backgroundRepeatMode } }
    );

    res.sendStatus(200);
  } catch (e) {
    logger.error(e);
    res.status(500);
    res.send("Error updating background repeat mode.");
  }
});

module.exports = router;
