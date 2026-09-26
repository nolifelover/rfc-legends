import type { Metadata } from "next";
import { GameClient } from "@/components/game/game-client";

export const metadata: Metadata = {
  title: "Game | RFC Legends",
  description:
    "Your idle adventure: train, fight beside your companion rooster, and collect rare drops.",
};

export default function GamePage() {
  return (
    <main className="flex flex-1 flex-col">
      <GameClient />
    </main>
  );
}
