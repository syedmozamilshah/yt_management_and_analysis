import { AbsoluteFill } from "remotion";

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1
        style={{
          color: "white",
          fontSize: 80,
          fontWeight: "bold",
        }}
      >
        Video Stash Gallery
      </h1>
    </AbsoluteFill>
  );
};
