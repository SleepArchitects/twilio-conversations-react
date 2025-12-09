import { SVGProps } from "react";

const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-labelledby="right-arrow-title"
    {...props}
  >
    <title id="right-arrow-title">Scroll carousel right</title>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export default ArrowRightIcon;
