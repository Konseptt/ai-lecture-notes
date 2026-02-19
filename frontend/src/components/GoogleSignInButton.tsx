import { useEffect, useRef } from "react";

interface Props {
  onCredential: (credential: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleSignInButton({ onCredential }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || rendered.current) return;

    function tryRender() {
      if (!window.google || !buttonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          onCredential(response.credential);
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: "100%",
        text: "continue_with",
        shape: "rectangular",
      });
      rendered.current = true;
      return true;
    }

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-neutral-400" style={{ background: "var(--bg)" }}>or</span>
        </div>
      </div>
      <div ref={buttonRef} className="flex justify-center [&>div]:w-full" />
    </>
  );
}
