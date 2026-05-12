function buildBrandingPayload(doc) {
  if (!doc) {
    return {
      platformLogo: null,
      banners: {},
      carousel: [],
    };
  }

  const payload = {
    platformLogo: doc.platformLogoPath,
    banners: {},
    carousel: [],
  };

  if (doc.banners) {
    for (const [key, path] of Object.entries(doc.banners)) {
      payload.banners[key] = path;
    }
  }

  if (doc.carouselBanners) {
    payload.carousel = doc.carouselBanners;
  }

  return payload;
}

module.exports = {
  buildBrandingPayload,
};
