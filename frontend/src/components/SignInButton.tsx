import React, { useEffect } from "react";

const SignInButton = () => {
  useEffect(() => {
    (window as any).gapi.signin2.render("signInButton", {
      scope: "email",
      width: 250,
      height: 56,
      longtitle: true,
      theme: "light",
      prompt: "select_account",
    });
  }, []);

  return <div id="signInButton" />;
};

export default SignInButton;
