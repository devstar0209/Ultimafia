import React, { useContext } from "react";

import { Link } from "react-router-dom";

import { SiteInfoContext } from "../Contexts";

export default function SiteLogo({
  small = false,
  large = false,
  newTab = false,
}) {
  const siteInfo = useContext(SiteInfoContext);

  const getLogoSrc = () => {
    return siteInfo.branding.platformLogo;
  };

  let width = 100;
  let height = 53;
  if (small === true) {
    width = 100;
    height = 38;
  }
  else if (large === true) {
    width = 100;
    height = 75;
  }

  let linkProps = {};
  if (newTab === true) {
    linkProps = { target: "_blank", rel: "noopener noreferrer" };
  }

  return (
    <Link to="/play" {...linkProps} style={{ lineHeight: 0 }}>
      <img
        height={height}
        width={width}
        alt="Site logo"
        src={getLogoSrc()}
      />
    </Link>
  );
}
