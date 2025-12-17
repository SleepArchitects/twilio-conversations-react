import { SVGProps } from "react";

const MiniXIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
  </svg>
);

export default MiniXIcon;
