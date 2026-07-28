"use client";

import { useEffect } from "react";

const NODE_ART = `
   \\   |   /
    \\  |  /
     \\ | /
      (●)
     / | \\
    /  |  \\
   /   |   \\
`;

/** For the curious few who open the console — no achievement tied to this one, just a nod. */
export function ConsoleEasterEgg() {
  useEffect(() => {
    console.log(`%c${NODE_ART}`, "color:#39ffb0; font-weight:bold;");
    console.log(
      "%cUNCLHUBPOURLESGOUVERNERTOUS",
      "color:#39ffb0; background:#08080d; font-size:14px; font-weight:bold; padding:6px 10px; letter-spacing:2px;",
    );
  }, []);

  return null;
}
