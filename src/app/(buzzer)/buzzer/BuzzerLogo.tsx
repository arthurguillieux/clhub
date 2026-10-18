/** The CLHUB hub icon (same as the favicon / home-screen icon). */
export function BuzzerLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size app icon, nothing to optimise
    <img src="/icons/icon-192.png" alt="LE CLHUB" className={`rounded-2xl ${className}`} />
  );
}
