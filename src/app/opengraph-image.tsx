import { ImageResponse } from "next/og";

// Social share card (WhatsApp / Instagram / X / etc.). Generated at build time
// on the Modern Apothecary palette. 1200×630 is the standard OG size.
export const alt =
  "Klenich — Bliss in Every Drop. Plant-powered home care, made in India.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1F3D2B",
          color: "#F5F1E8",
          padding: "72px 84px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            letterSpacing: "0.28em",
            fontSize: 22,
            textTransform: "uppercase",
            color: "#B08D4C",
            fontFamily: "sans-serif",
          }}
        >
          <span>A Bharat Bliss Brand</span>
          <span>Made in India</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 168,
              fontWeight: 600,
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}
          >
            Klenich
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 54,
              marginTop: 18,
              color: "#C8D1C0",
              fontStyle: "italic",
            }}
          >
            Bliss in Every Drop
          </div>
        </div>

        <div
          style={{
            display: "flex",
            letterSpacing: "0.24em",
            fontSize: 23,
            textTransform: "uppercase",
            color: "#F5F1E8",
            fontFamily: "sans-serif",
          }}
        >
          Plant-Powered · Made in India
        </div>
      </div>
    ),
    { ...size },
  );
}