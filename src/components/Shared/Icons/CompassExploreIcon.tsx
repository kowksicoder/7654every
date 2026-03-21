import type { SVGProps } from "react";

type CompassExploreIconProps = SVGProps<SVGSVGElement>;

export const CompassExploreOutlineIcon = (props: CompassExploreIconProps) => (
  <svg
    aria-hidden="true"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M14.9 9.1 13.3 13.3 9.1 14.9 10.7 10.7 14.9 9.1Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.75"
    />
    <circle cx="12" cy="12" fill="currentColor" r="1.15" />
  </svg>
);

export const CompassExploreSolidIcon = (props: CompassExploreIconProps) => (
  <svg
    aria-hidden="true"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="8.75" stroke="currentColor" strokeWidth="2.25" />
    <path
      d="M15.8 8.2 13.55 13.55 8.2 15.8 10.45 10.45 15.8 8.2Z"
      fill="currentColor"
    />
    <circle cx="12" cy="12" fill="currentColor" r="1.35" />
  </svg>
);
