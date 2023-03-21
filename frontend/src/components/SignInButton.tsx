import React, { useEffect, useRef } from "react";

const SignInButton = () => {
  const signInButtonContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (window as any).google.accounts.id.renderButton(
      signInButtonContainerRef.current!,
      {
        theme: "filled_blue",
        width: 250,
      }
    );
  }, []);

  return <div ref={signInButtonContainerRef} />;
};

export default SignInButton;
