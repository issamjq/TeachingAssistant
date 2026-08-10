"use client";

// Client boundary for the assistant, so the route-group layouts can stay
// server components.
//
// It used to also hold the router, because the assistant could ask to
// navigate. Answering from knowledge.json cannot — the destination has
// to come from something that reasons about the request — so that came
// out rather than being left as a wire attached to nothing.
import AssistantWidget from "./AssistantWidget";

export default function AssistantMount({ scope = "landing" }: { scope?: "landing" | "studio" }) {
  return <AssistantWidget scope={scope} />;
}
