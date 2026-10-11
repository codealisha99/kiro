import type { SVGProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Search01Icon,
  BookOpen01Icon,
  BubbleChatIcon,
  ArrowUp02Icon,
  Cancel01Icon,
  Menu01Icon,
  File01Icon,
  Upload04Icon,
  Logout01Icon,
  ArrowRight01Icon,
  LockKeyIcon,
  Tick02Icon,
  UserCircleIcon,
  Mail01Icon,
  Shield01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

const icons = {
  plus: Add01Icon,
  search: Search01Icon,
  book: BookOpen01Icon,
  message: BubbleChatIcon,
  arrow: ArrowUp02Icon,
  close: Cancel01Icon,
  menu: Menu01Icon,
  file: File01Icon,
  upload: Upload04Icon,
  logout: Logout01Icon,
  chevron: ArrowRight01Icon,
  lock: LockKeyIcon,
  check: Tick02Icon,
  user: UserCircleIcon,
  mail: Mail01Icon,
  shield: Shield01Icon,
  settings: Settings01Icon,
};
export type IconName = keyof typeof icons;

export function WorkspaceIcon({
  name,
  strokeWidth,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={18}
      strokeWidth={Number(strokeWidth ?? 1.6)}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function KiroMark() {
  return (
    <svg
      width="26"
      height="30"
      viewBox="0 0 26 30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 4v22M21 4 10 15l11 11M5 15h5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
