import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the ScamShield mark on the site's black, rendered to PNG at build time. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090A",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 22 22" fill="none">
          <path
            d="M11 1.5 3.5 4.6v6.1c0 4.5 3.1 8.3 7.5 9.8 4.4-1.5 7.5-5.3 7.5-9.8V4.6L11 1.5Z"
            stroke="#EDEBE6"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M6.5 10.4h9" stroke="#E5533A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
