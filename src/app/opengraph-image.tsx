import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#059669",
          color: "#ffffff",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            fontSize: 40,
          }}
        >
          🦷
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          DentalGPT Studio
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            opacity: 0.9,
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          AI Front Desk for Dental Clinics
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            fontSize: 20,
            opacity: 0.7,
            textAlign: "center",
          }}
        >
          24/7 patient responses · Appointment requests · Lead capture
        </div>
      </div>
    ),
    { ...size }
  );
}
