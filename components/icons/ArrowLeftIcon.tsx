import { SVGProps } from "react";

const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-labelledby="left-arrow-title"
    {...props}
  >
    <title id="left-arrow-title">Scroll carousel left</title>
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

export default ArrowLeftIcon;
