import { HiOutlineDocumentDuplicate } from "react-icons/hi2";

interface CopyIconProps {
  className?: string;
}

export default function CopyIcon({ className = "h-4 w-4" }: CopyIconProps) {
  return <HiOutlineDocumentDuplicate className={className} />;
}
