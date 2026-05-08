function getCustomEmoteFilepath(userId, id, extension) {
  if (String(id || "").startsWith("emote-")) {
    return `${process.env.UPLOAD_PATH}/store/emotes/${id}.${extension}`;
  }

  return `${process.env.UPLOAD_PATH}/${userId}_customEmote_${id}.${extension}`;
}

function remapCustomEmotes(user, userId) {
  user.settings.customEmotes = {};
  user.customEmotes.forEach((customEmote) => {
    user.settings.customEmotes[`:${customEmote.name}:`] = {
      userId: userId,
      id: customEmote.id,
      extension: customEmote.extension,
      name: customEmote.name,
      path: getCustomEmoteFilepath(
        userId,
        customEmote.id,
        customEmote.extension
      ),
    };
  });
}

module.exports = {
  getCustomEmoteFilepath,
  remapCustomEmotes,
};
