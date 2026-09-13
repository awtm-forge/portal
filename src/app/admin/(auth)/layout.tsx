import { THEME_SCRIPT } from "@/lib/theme";

/**
 * The three screens an admin can reach without a session: sign in, first run,
 * and the setup link. They have no shell and no controls, so there is nothing
 * to switch the theme with here, but a choice already made should still hold:
 * signing in should not flash dark at someone who works in light.
 */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </>
  );
}
