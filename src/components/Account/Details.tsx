import {
  MapPinIcon,
  PencilSquareIcon,
  ShareIcon
} from "@heroicons/react/24/outline";
import { BeakerIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import FollowUnfollowButton from "@/components/Shared/Account/FollowUnfollowButton";
import TipButton from "@/components/Shared/Account/TipButton";
import Markup from "@/components/Shared/Markup";
import Followers from "@/components/Shared/Modal/Followers";
import Following from "@/components/Shared/Modal/Following";
import Slug from "@/components/Shared/Slug";
import { H3, Image, LightBox, Modal, Tooltip } from "@/components/Shared/UI";
import { STATIC_IMAGES_URL, TRANSFORMS } from "@/data/constants";
import getAccount from "@/helpers//getAccount";
import getAvatar from "@/helpers//getAvatar";
import getAccountAttribute from "@/helpers/getAccountAttribute";
import getFavicon from "@/helpers/getFavicon";
import getMentions from "@/helpers/getMentions";
import humanize from "@/helpers/humanize";
import { isEvery1OnlyAccount } from "@/helpers/privy";
import useEvery1AccountProfile from "@/hooks/useEvery1AccountProfile";
import useEvery1FollowRelationship from "@/hooks/useEvery1FollowRelationship";
import useEvery1FollowStats from "@/hooks/useEvery1FollowStats";
import { useTheme } from "@/hooks/useTheme";
import {
  type AccountFragment,
  useAccountStatsQuery
} from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import ENSBadge from "../Shared/Account/ENSBadge";
import CreatorCoin from "./CreatorCoin";
import Followerings from "./Followerings";
import FollowersYouKnowOverview from "./FollowersYouKnowOverview";
import AccountMenu from "./Menu";
import MetaDetails from "./MetaDetails";

interface DetailsProps {
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  account: AccountFragment;
}

const Details = ({
  isBlockedByMe = false,
  hasBlockedMe = false,
  account
}: DetailsProps) => {
  const navigate = useNavigate();
  const { currentAccount } = useAccountStore();
  const [showLightBox, setShowLightBox] = useState<boolean>(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const { theme } = useTheme();
  const supportsLegacyActions = !isEvery1OnlyAccount(account);
  const { profile: every1Profile, profileId } =
    useEvery1AccountProfile(account);
  const { relationship } = useEvery1FollowRelationship(profileId);
  const { stats: every1FollowStats } = useEvery1FollowStats(profileId);
  const { data: legacyAccountStats } = useAccountStatsQuery({
    skip: Boolean(profileId) || !supportsLegacyActions,
    variables: { request: { account: account.address } }
  });
  const accountInfo = getAccount(account);
  const isCurrentProfile = currentAccount?.address === account.address;
  const creatorCoinAddress = getAccountAttribute(
    "creatorCoinAddress",
    account?.metadata?.attributes
  );
  const tickerLabel =
    creatorCoinAddress && accountInfo.username
      ? `₦${accountInfo.username.replace(/^@/, "")}`
      : null;
  const displayTickerLabel = accountInfo.username
    ? `\u20A6${accountInfo.username.replace(/^[@#]/, "")}`
    : tickerLabel;
  const followsYou =
    relationship.isFollowingMe || account.operations?.isFollowingMe || false;
  const verificationStatus =
    every1Profile?.verificationStatus ||
    (account.hasSubscribed ? "verified" : "unverified");
  const isOfficial = verificationStatus === "verified" || account.hasSubscribed;
  const followersCount = profileId
    ? every1FollowStats.followers
    : (legacyAccountStats?.accountStats.graphFollowStats.followers ?? 0);
  const followingCount = profileId
    ? every1FollowStats.following
    : (legacyAccountStats?.accountStats.graphFollowStats.following ?? 0);

  const handleShowLightBox = useCallback(() => {
    setShowLightBox(true);
  }, []);

  const handleCloseLightBox = useCallback(() => {
    setShowLightBox(false);
  }, []);

  const handleShareProfile = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareTitle = `View ${accountInfo.name} on Every1`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: shareTitle,
          title: accountInfo.name,
          url: shareUrl
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Profile link copied");
    } catch {
      toast.error("Unable to share right now");
    }
  }, [accountInfo.name]);

  const renderAccountAttribute = (
    attribute: "location" | "website" | "x",
    icon: ReactNode
  ) => {
    if (isBlockedByMe || hasBlockedMe) return null;

    const value = getAccountAttribute(attribute, account?.metadata?.attributes);
    if (!value) return null;

    return (
      <MetaDetails icon={icon}>
        <Link
          rel="noreferrer noopener"
          target="_blank"
          to={
            attribute === "website"
              ? `https://${value.replace(/https?:\/\//, "")}`
              : `https://x.com/${value.replace("https://x.com/", "")}`
          }
        >
          {value.replace(/https?:\/\//, "")}
        </Link>
      </MetaDetails>
    );
  };

  const websiteMeta = renderAccountAttribute(
    "website",
    <img
      alt="Website"
      className="size-4 rounded-full"
      height={16}
      src={getFavicon(
        getAccountAttribute("website", account?.metadata?.attributes)
      )}
      width={16}
    />
  );
  const xMeta = renderAccountAttribute(
    "x",
    <Image
      alt="X Logo"
      className="size-4"
      height={16}
      src={`${STATIC_IMAGES_URL}/brands/${theme === "dark" ? "x-dark.png" : "x-light.png"}`}
      width={16}
    />
  );

  const metaItems = [
    !isBlockedByMe &&
    !hasBlockedMe &&
    getAccountAttribute("location", account?.metadata?.attributes) ? (
      <MetaDetails icon={<MapPinIcon className="size-4" />} key="location">
        {getAccountAttribute("location", account?.metadata?.attributes)}
      </MetaDetails>
    ) : null,
    websiteMeta ? <div key="website">{websiteMeta}</div> : null,
    xMeta ? <div key="x">{xMeta}</div> : null
  ].filter(Boolean);

  return (
    <div className="relative z-10 mb-4 px-4 md:px-0">
      <div className="overflow-hidden rounded-[1.5rem] border border-gray-200/90 bg-white shadow-[0_20px_60px_-42px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#09090c] dark:shadow-[0_30px_90px_-54px_rgba(15,23,42,0.8)]">
        <div className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_32%)]" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-gray-100/80 to-transparent dark:from-white/[0.05]" />

          <div className="relative px-3.5 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
            <div className="flex items-center justify-end gap-2">
              {!isBlockedByMe && !hasBlockedMe ? (
                <TipButton account={account} />
              ) : null}
              <button
                className="rounded-full border border-gray-200 bg-gray-100/90 p-2 text-gray-600 transition hover:bg-gray-200/90 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/[0.88] dark:hover:bg-white/[0.12]"
                onClick={() => void handleShareProfile()}
                type="button"
              >
                <ShareIcon className="size-4" />
              </button>
              <div className="rounded-full border border-gray-200 bg-gray-100/90 dark:border-white/10 dark:bg-white/[0.06]">
                <AccountMenu account={account} />
              </div>
            </div>

            <div className="mt-1.5 flex flex-col items-center text-center">
              <div className="group relative rounded-[1.4rem]">
                <button
                  className="relative block rounded-[1.4rem] bg-transparent"
                  onClick={handleShowLightBox}
                  type="button"
                >
                  <Image
                    alt={account.address}
                    className="size-20 cursor-pointer rounded-[1rem] bg-gray-200 object-cover sm:size-[5.5rem] dark:bg-gray-700"
                    height={88}
                    src={getAvatar(account, TRANSFORMS.AVATAR_BIG)}
                    width={88}
                  />
                </button>
                {isCurrentProfile ? (
                  <button
                    className="absolute right-[-0.15rem] bottom-[-0.15rem] flex size-7 items-center justify-center rounded-full border border-gray-300 bg-transparent text-gray-700 transition hover:text-gray-950 dark:border-white/20 dark:text-white/90 dark:hover:text-white"
                    onClick={() => navigate("/settings")}
                    type="button"
                  >
                    <PencilSquareIcon className="size-3.5" />
                  </button>
                ) : null}
                {isOfficial ? (
                  <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-[10px] text-blue-700 backdrop-blur dark:border-blue-300/[0.2] dark:bg-blue-500/12 dark:text-blue-100">
                    <CheckBadgeIcon className="size-3 text-blue-500 dark:text-blue-300" />
                    Official
                  </span>
                ) : isCurrentProfile && verificationStatus === "pending" ? (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-[10px] text-blue-700 backdrop-blur dark:border-blue-300/[0.15] dark:bg-blue-500/10 dark:text-blue-100">
                    Pending review
                  </span>
                ) : null}
              </div>

              <LightBox
                images={[getAvatar(account, TRANSFORMS.EXPANDED_AVATAR)]}
                onClose={handleCloseLightBox}
                show={showLightBox}
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                <H3 className="!text-[1.35rem] !text-gray-950 sm:!text-[1.7rem] dark:!text-white max-w-[15rem] truncate sm:max-w-none">
                  {accountInfo.name}
                </H3>
                {account.isBeta ? (
                  <Tooltip content="Beta" placement="right">
                    <BeakerIcon className="size-5 text-lime-300" />
                  </Tooltip>
                ) : null}
                <ENSBadge
                  account={account}
                  className="size-5"
                  linkToDashboard
                />
              </div>

              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <Slug
                  className="text-gray-500 text-xs sm:text-sm dark:text-white/[0.65]"
                  slug={accountInfo.username}
                />
                {displayTickerLabel ? (
                  <div className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 font-medium text-[10px] text-gray-700 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/80">
                    {displayTickerLabel}
                  </div>
                ) : null}
                {followsYou ? (
                  <div className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/80">
                    Follows you
                  </div>
                ) : null}
                {!isOfficial &&
                isCurrentProfile &&
                verificationStatus !== "pending" ? (
                  <button
                    className="flex items-center gap-x-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-[10px] text-blue-700 dark:border-blue-300/[0.2] dark:bg-blue-500/12 dark:text-blue-100"
                    onClick={() => navigate("/settings/verification")}
                    type="button"
                  >
                    <CheckBadgeIcon className="size-3.5 text-blue-500 dark:text-blue-300" />
                    Verify
                  </button>
                ) : null}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-gray-500 sm:text-[13px] dark:text-white/[0.68]">
                <button
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  onClick={() => {
                    umami.track("open_followers");
                    setShowFollowersModal(true);
                  }}
                  type="button"
                >
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {humanize(followersCount)}
                  </span>{" "}
                  Followers
                </button>
                <span className="text-gray-300 dark:text-white/20">•</span>
                <button
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  onClick={() => {
                    umami.track("open_following");
                    setShowFollowingModal(true);
                  }}
                  type="button"
                >
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {humanize(followingCount)}
                  </span>{" "}
                  Following
                </button>
              </div>

              {!isCurrentProfile && !isBlockedByMe && !hasBlockedMe ? (
                <div className="mt-2.5 flex w-full flex-wrap items-center justify-center gap-2">
                  <FollowUnfollowButton
                    account={account}
                    buttonClassName="min-w-[10.5rem] justify-center !rounded-[1rem] !border-white !bg-white !text-gray-950 hover:!bg-gray-100 dark:!border-white dark:!bg-white dark:!text-gray-950"
                    unfollowTitle="Following"
                  />
                </div>
              ) : null}

              {!isBlockedByMe && !hasBlockedMe && account?.metadata?.bio ? (
                <div className="mt-3 max-w-xl text-center text-[13px] text-gray-600 leading-5 dark:text-white/[0.72]">
                  <div className="markup linkify">
                    <Markup mentions={getMentions(account?.metadata.bio)}>
                      {account?.metadata.bio}
                    </Markup>
                  </div>
                </div>
              ) : null}

              <div className="mt-3.5 w-full max-w-4xl">
                <Followerings
                  account={account}
                  e1xpTotal={every1Profile?.e1xpTotal || 0}
                />
              </div>

              {metaItems.length > 0 ||
              (!isBlockedByMe && !hasBlockedMe && creatorCoinAddress) ? (
                <div className="mt-3.5 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-[1.2rem] border border-gray-200 bg-gray-50/90 px-2.5 py-2.5 backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
                  {metaItems.map((item, index) => (
                    <div
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[13px] text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/[0.88]"
                      key={index}
                    >
                      {item}
                    </div>
                  ))}
                  {!isBlockedByMe && !hasBlockedMe ? (
                    <CreatorCoin account={account} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!isBlockedByMe &&
      !hasBlockedMe &&
      !isCurrentProfile &&
      supportsLegacyActions ? (
        <div className="mt-4 px-1">
          <FollowersYouKnowOverview
            address={account.address}
            username={accountInfo.username}
          />
        </div>
      ) : null}
      <Modal
        onClose={() => setShowFollowersModal(false)}
        show={showFollowersModal}
        title="Followers"
      >
        <Followers
          address={String(account.address)}
          profileId={profileId}
          username={accountInfo.username}
        />
      </Modal>
      <Modal
        onClose={() => setShowFollowingModal(false)}
        show={showFollowingModal}
        title="Following"
      >
        <Following
          address={String(account.address)}
          profileId={profileId}
          username={accountInfo.username}
        />
      </Modal>
    </div>
  );
};

export default Details;
