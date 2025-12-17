export const customDropdownTheme = {
  arrowIcon: "ml-2 h-4 w-4",
  content: "py-1 focus:outline-none",
  floating: {
    animation: "transition-opacity",
    arrow: {
      base: "absolute z-10 h-2 w-2 rotate-45",
      style: {
        dark: "bg-gray-900 dark:bg-gray-700",
        light: "bg-white",
        auto: "bg-white dark:bg-gray-700",
      },
      placement: "-4px",
    },
    base: "z-50 w-fit rounded-xl shadow-xl focus:outline-none",
    content: "py-1 text-sm text-gray-700 dark:text-gray-200",
    divider: "my-1 h-px bg-gray-100/50 dark:bg-gray-700/30",
    header:
      "block px-4 py-3 text-sm border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800",
    hidden: "invisible opacity-0",
    item: {
      container: "",
      base: "flex items-center justify-start py-2.5 px-4 text-sm text-gray-700 cursor-pointer w-full hover:bg-purple-50 focus:bg-purple-50 focus:outline-none dark:text-gray-200 dark:hover:bg-purple-900/30 dark:focus:bg-purple-900/30 transition-colors duration-150",
      icon: "mr-2 h-4 w-4",
    },
    style: {
      dark: "bg-gray-900 text-white dark:bg-gray-800",
      light: "bg-white text-gray-900",
      auto: "bg-white text-gray-900 dark:bg-gray-800 dark:text-white",
    },
    target: "w-fit",
  },
  inlineWrapper: "flex items-center",
};

export const customAvatarTheme = {
  root: {
    base: "flex items-center justify-center space-x-4 rounded-full",
    bordered: "p-1 ring-2",
    rounded: "rounded-full",
    size: {
      xs: "h-6 w-6",
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-20 w-20",
      xl: "h-36 w-36",
    },
    img: {
      off: "relative overflow-hidden bg-gray-100 dark:bg-gray-600",
      on: "rounded-full",
      placeholder: "absolute -bottom-1 h-auto w-auto text-gray-400",
    },
    status: {
      away: "bg-yellow-400",
      base: "absolute h-3 w-3 rounded-full border-2 border-white dark:border-gray-800",
      busy: "bg-red-400",
      offline: "bg-gray-400",
      online: "bg-green-400",
    },
    statusPosition: {
      "bottom-left": "-bottom-0.5 -left-0.5",
      "bottom-center": "-bottom-0.5 left-1/2 -translate-x-1/2",
      "bottom-right": "bottom-0 right-0",
      "top-left": "-left-0.5 -top-0.5",
      "top-center": "-top-0.5 left-1/2 -translate-x-1/2",
      "center-right": "right-0 top-1/2 -translate-y-1/2",
      "center-left": "left-0 top-1/2 -translate-y-1/2",
      "top-right": "right-0 top-0",
    },
    initials: {
      text: "font-medium text-gray-600 dark:text-gray-300",
      base: "relative inline-flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-600",
    },
  },
};

export const customFlowbiteTheme = {
  dropdown: customDropdownTheme,
  avatar: customAvatarTheme,
};
