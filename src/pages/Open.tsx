import { useEffect } from "react";

const androidStoreUrl = "https://play.google.com/store/apps/details?id=com.fraktal.runlab";
const iosStoreUrl = "https://apps.apple.com/br/app/runlab/id6475360973";

const Open = () => {
  useEffect(() => {
    document.title = "Abrindo RunLab...";

    const fallbackUrl = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? iosStoreUrl
      : androidStoreUrl;

    window.location.href = "runlab://open";

    const timeoutId = window.setTimeout(() => {
      window.location.href = fallbackUrl;
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return <p>Abrindo o RunLab...</p>;
};

export default Open;
