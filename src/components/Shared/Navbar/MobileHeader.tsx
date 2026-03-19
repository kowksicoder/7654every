import {
  Bars3Icon,
  BellIcon,
  ChatBubbleOvalLeftEllipsisIcon
} from "@heroicons/react/24/solid";
import { memo, useCallback } from "react";
import { Link } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { Image } from "@/components/Shared/UI";
import getAvatar from "@/helpers//getAvatar";
import useHasNewNotifications from "@/hooks/useHasNewNotifications";
import { useAuthModalStore } from "@/store/non-persisted/modal/useAuthModalStore";
import { useMobileDrawerModalStore } from "@/store/non-persisted/modal/useMobileDrawerModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const MobileHeader = () => {
  const { currentAccount } = useAccountStore();
  const { setShowAuthModal } = useAuthModalStore();
  const { setShow: setShowMobileDrawer } = useMobileDrawerModalStore();
  const hasNewNotifications = useHasNewNotifications();
  const notificationCount = hasNewNotifications ? 1 : 0;

  const handleAuthClick = useCallback(() => {
    setShowAuthModal(true);
  }, [setShowAuthModal]);

  const handleDrawerOpen = useCallback(() => {
    setShowMobileDrawer(true);
  }, [setShowMobileDrawer]);

  return (
    <header className="sticky top-0 z-[6] bg-[#edf4ff] px-4 py-3 md:hidden dark:bg-black">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="Open menu"
            className="text-gray-900 dark:text-gray-100"
            onClick={handleDrawerOpen}
            type="button"
          >
            <Bars3Icon className="size-6" />
          </button>

          <div className="flex min-w-0 items-center">
            <Image
              alt="Every1"
              className="size-9 rounded-2xl object-cover"
              height={36}
              src={evLogo}
              width={36}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            aria-label="Support"
            className="flex size-8 items-center justify-center text-gray-800 transition-colors hover:text-gray-950 dark:text-gray-200 dark:hover:text-white"
            to="/support"
          >
            <ChatBubbleOvalLeftEllipsisIcon className="size-4.5" />
          </Link>

          <Link
            aria-label="Notifications"
            className="relative flex size-8 items-center justify-center text-gray-800 transition-colors hover:text-gray-950 dark:text-gray-200 dark:hover:text-white"
            to="/notifications"
          >
            <BellIcon className="size-4.5" />
            {notificationCount ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full border border-white bg-pink-500 px-1 text-center text-[10px] font-semibold leading-4 text-white dark:border-gray-950">
                {notificationCount}
              </span>
            ) : null}
          </Link>

          {currentAccount ? (
            <button
              aria-label="Open account menu"
              onClick={handleDrawerOpen}
              type="button"
            >
              <Image
                alt={currentAccount.address}
                className="size-8 rounded-full border-2 border-white object-cover shadow-sm dark:border-gray-900"
                height={32}
                src={getAvatar(currentAccount)}
                width={32}
              />
            </button>
          ) : (
            <button aria-label="Login" onClick={handleAuthClick} type="button">
              <Image
                alt="Login"
                className="size-8 rounded-full border-2 border-white object-cover shadow-sm dark:border-gray-900"
                height={32}
                src={evLogo}
                width={32}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default memo(MobileHeader);
