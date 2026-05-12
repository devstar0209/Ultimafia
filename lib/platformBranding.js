function buildBrandingPayload(doc) {
  if (!doc) {
    return {
      platformLogo: null,
      banners: {},
      carouselBanners: [],
    };
  }

  const payload = {
    platformLogo: doc.platformLogoPath,
    banners: {},
    carouselBanners: [],
  };

  if (doc.banners) {
    for (const [key, path] of Object.entries(doc.banners)) {
      payload.banners[key] = path;
    }
  }

  if (doc.carouselBanners) {
    payload.carouselBanners = doc.carouselBanners.map((banner) => ({
      id: banner._id,
      url: banner.path,
    }));
  }

  return payload;
}

module.exports = {
  buildBrandingPayload,
};
