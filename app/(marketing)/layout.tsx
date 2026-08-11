import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AssistantMount from "@/features/assistant/AssistantMount";

// Route group for the public marketing surface. `(marketing)` adds no path
// segment — the page inside it is "/".
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <RouterBridge />
      {children}
      {/* ONE floating control, not two. The assistant answers product
          questions from knowledge.json (no /api/chat, no credits, no
          account) AND carries the full accessibility panel — including the
          theme control — as its accessibility tab. A second launcher for
          accessibility sat right next to this one and read as clutter. */}
      {/* The assistant, answering visitor questions about the product.
          On this surface it runs entirely from src/features/assistant/
          knowledge.json: no /api/chat call, no AI credits, no account
          needed. Only scope="studio" reaches the model, which is why a
          signed-out visitor can ask it anything here for free. */}
      <AssistantMount scope="landing" />
    </LanguageProvider>
  );
}
