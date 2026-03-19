import { useApolloClient } from "@apollo/client";
import {
  ArrowsRightLeftIcon as SwapOutline,
  BellIcon as BellOutline,
  BoltIcon as StreaksOutline,
  BookmarkIcon as BookmarkOutline,
  StarIcon as CreatorsOutline,
  FlagIcon as MissionsOutline,
  GlobeAltIcon as GlobeOutline,
  HomeIcon as HomeOutline,
  TrophyIcon as LeaderboardOutline,
  UserGroupIcon as UserGroupOutline
} from "@heroicons/react/24/outline";
import {
  ArrowsRightLeftIcon as SwapSolid,
  BellIcon as BellSolid,
  BoltIcon as StreaksSolid,
  BookmarkIcon as BookmarkSolid,
  StarIcon as CreatorsSolid,
  FlagIcon as MissionsSolid,
  GlobeAltIcon as GlobeSolid,
  HomeIcon as HomeSolid,
  TrophyIcon as LeaderboardSolid,
  UserGroupIcon as UserGroupSolid
} from "@heroicons/react/24/solid";
import {
  type MouseEvent,
  memo,
  type ReactNode,
  useCallback,
  useState
} from "react";
import { Link, useLocation } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { Image, Spinner, Tooltip } from "@/components/Shared/UI";
import useHasNewNotifications from "@/hooks/useHasNewNotifications";
import {
  GroupsDocument,
  NotificationIndicatorDocument,
  NotificationsDocument,
  PostBookmarksDocument,
  PostsExploreDocument,
  PostsForYouDocument,
  TimelineDocument,
  TimelineHighlightsDocument
} from "@/indexer/generated";
import { useAuthModalStore } from "@/store/non-persisted/modal/useAuthModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import SignedAccount from "./SignedAccount";

const navigationItems = {
  "/": {
    outline: <HomeOutline className="size-6" />,
    refreshDocs: [
      TimelineDocument,
      TimelineHighlightsDocument,
      PostsForYouDocument
    ],
    solid: <HomeSolid className="size-6" />,
    title: "Home"
  },
  "/bookmarks": {
    outline: <BookmarkOutline className="size-6" />,
    refreshDocs: [PostBookmarksDocument],
    solid: <BookmarkSolid className="size-6" />,
    title: "Bookmarks"
  },
  "/explore": {
    outline: <GlobeOutline className="size-6" />,
    refreshDocs: [PostsExploreDocument],
    solid: <GlobeSolid className="size-6" />,
    title: "Explore"
  },
  "/creators": {
    outline: <CreatorsOutline className="size-6" />,
    solid: <CreatorsSolid className="size-6" />,
    title: "Creators"
  },
  "/leaderboard": {
    outline: <LeaderboardOutline className="size-6" />,
    solid: <LeaderboardSolid className="size-6" />,
    title: "Leaderboard"
  },
  "/swap": {
    outline: <SwapOutline className="size-6" />,
    solid: <SwapSolid className="size-6" />,
    title: "Swap"
  },
  "/missions": {
    outline: <MissionsOutline className="size-6" />,
    solid: <MissionsSolid className="size-6" />,
    title: "Missions"
  },
  "/streaks": {
    outline: <StreaksOutline className="size-6" />,
    solid: <StreaksSolid className="size-6" />,
    title: "Streaks"
  },
  "/groups": {
    outline: <UserGroupOutline className="size-6" />,
    refreshDocs: [GroupsDocument],
    solid: <UserGroupSolid className="size-6" />,
    title: "Groups"
  },
  "/notifications": {
    outline: <BellOutline className="size-6" />,
    refreshDocs: [NotificationsDocument, NotificationIndicatorDocument],
    solid: <BellSolid className="size-6" />,
    title: "Notifications"
  }
};

interface NavItemProps {
  url: string;
  icon: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

const NavItem = memo(({ icon, onClick, url }: NavItemProps) => (
  <Tooltip content={navigationItems[url as keyof typeof navigationItems].title}>
    <Link onClick={onClick} to={url}>
      {icon}
    </Link>
  </Tooltip>
));

const NavItems = memo(({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { pathname } = useLocation();
  const hasNewNotifications = useHasNewNotifications();
  const client = useApolloClient();
  const [refreshingRoute, setRefreshingRoute] = useState<string | null>(null);
  const routes = [
    "/",
    "/explore",
    "/creators",
    "/leaderboard",
    "/swap",
    "/missions",
    "/streaks",
    ...(isLoggedIn ? ["/notifications", "/groups", "/bookmarks"] : [])
  ];

  return (
    <>
      {routes.map((route) => {
        let icon =
          pathname === route
            ? navigationItems[route as keyof typeof navigationItems].solid
            : navigationItems[route as keyof typeof navigationItems].outline;

        if (refreshingRoute === route) {
          icon = <Spinner className="my-0.5" size="sm" />;
        }

        const iconWithIndicator =
          route === "/notifications" ? (
            <span className="relative">
              {icon}
              {hasNewNotifications && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500" />
              )}
            </span>
          ) : (
            icon
          );

        const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
          const item = navigationItems[route as keyof typeof navigationItems];
          const isSameRoute = pathname === route;
          if (!isSameRoute || !("refreshDocs" in item) || !item.refreshDocs) {
            return;
          }
          e.preventDefault();
          window.scrollTo(0, 0);
          setRefreshingRoute(route);
          try {
            await client.refetchQueries({ include: item.refreshDocs });
          } finally {
            setRefreshingRoute(null);
          }
        };

        return (
          <NavItem
            icon={iconWithIndicator}
            key={route}
            onClick={handleClick}
            url={route}
          />
        );
      })}
    </>
  );
});

const Navbar = () => {
  const { pathname } = useLocation();
  const { currentAccount } = useAccountStore();
  const { setShowAuthModal } = useAuthModalStore();

  const handleLogoClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (pathname === "/") {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    },
    [pathname]
  );

  const handleAuthClick = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  return (
    <aside className="sticky top-5 mt-5 hidden w-10 shrink-0 flex-col items-center gap-y-5 md:flex">
      <Link onClick={handleLogoClick} to="/">
        <Image
          alt="Logo"
          className="size-8 rounded-lg object-cover"
          height={32}
          src={evLogo}
          width={32}
        />
      </Link>
      <NavItems isLoggedIn={!!currentAccount} />
      {currentAccount ? (
        <SignedAccount />
      ) : (
        <button onClick={handleAuthClick} type="button">
          <Tooltip content="Login">
            <Image
              alt="Profile"
              className="size-6 rounded-full object-cover"
              height={24}
              src={evLogo}
              width={24}
            />
          </Tooltip>
        </button>
      )}
    </aside>
  );
};

export default memo(Navbar);
