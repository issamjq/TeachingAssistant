import React from "react";
import { getAvatar } from "../lib/avatars";

// Round profile avatar. If `avatarId` matches a chosen avatar it renders that
// person (a face-cropped brand illustration); otherwise it falls back to the
// user's initial on a clay circle. `size` is the diameter in px. Used in the
// landing nav dropdown, the studio sidebar, and the avatar picker — colours
// are inline so it works in both the landing and studio stylesheets.
// `style = undefined` marks the prop optional for TypeScript callers.
export default function Avatar({ avatarId, photoUrl = "", initial = "U", size = 38, className = "", style = undefined }) {
  const av = getAvatar(avatarId);
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-block",
    ...style,
  };
  // A real photo from the identity provider wins over a chosen
  // illustration: somebody who signed in with LinkedIn expects to see
  // their own face, not a cartoon they never picked. Only https is
  // rendered — this value goes into a background-image, so a
  // javascript:/data: URL would be a stored-XSS foothold.
  if (photoUrl && /^https:\/\//i.test(photoUrl)) {
    return (
      <span
        className={`murchid-avatar ${className}`}
        aria-hidden="true"
        style={{
          ...base,
          backgroundImage: `url("${encodeURI(photoUrl)}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#e7dcc8",
        }}
      />
    );
  }
  if (av) {
    return (
      <span
        className={`murchid-avatar ${className}`}
        aria-hidden="true"
        style={{
          ...base,
          backgroundImage: `url("${av.src}")`,
          backgroundSize: av.size === "cover" ? "cover" : `${av.size} auto`,
          backgroundPosition: av.pos,
          backgroundRepeat: "no-repeat",
          backgroundColor: "#e7dcc8",
        }}
      />
    );
  }
  return (
    <span
      className={`murchid-avatar ${className}`}
      aria-hidden="true"
      style={{
        ...base,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#8e5435",
        color: "#f7f3ec",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );
}
