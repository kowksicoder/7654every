import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/Shared/Loader";
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Select,
  TextArea,
  Toggle
} from "@/components/Shared/UI";
import { EVERY1_FANDROPS_QUERY_KEY } from "@/helpers/every1";
import nFormatter from "@/helpers/nFormatter";
import {
  listStaffCreators,
  listStaffFanDrops,
  STAFF_CREATORS_QUERY_KEY,
  STAFF_DASHBOARD_QUERY_KEY,
  STAFF_FANDROPS_QUERY_KEY,
  staffUpsertFanDropCampaign
} from "@/helpers/staff";
import type { StaffFanDropRow } from "@/types/staff";

type FanDropAdminFormState = {
  about: string;
  bannerUrl: string;
  buyAmount: string;
  coverLabel: string;
  creatorProfileId: string;
  creatorSearch: string;
  endsAt: string;
  isBuyOptional: boolean;
  missionId: null | string;
  referralTarget: string;
  rewardE1xp: string;
  rewardPoolLabel: string;
  startsAt: string;
  status: "active" | "archived" | "completed" | "draft" | "paused";
  subtitle: string;
  title: string;
};

const createEmptyForm = (): FanDropAdminFormState => ({
  about: "",
  bannerUrl: "/buycoin.png",
  buyAmount: "500",
  coverLabel: "FanDrop",
  creatorProfileId: "",
  creatorSearch: "",
  endsAt: dayjs().add(12, "hour").format("YYYY-MM-DDTHH:mm"),
  isBuyOptional: true,
  missionId: null,
  referralTarget: "2",
  rewardE1xp: "250",
  rewardPoolLabel: "",
  startsAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  status: "draft",
  subtitle: "",
  title: ""
});

const toDateTimeInput = (value?: null | string) =>
  value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";

const getCreatorLabel = (
  creator?: null | {
    displayName?: null | string;
    username?: null | string;
    walletAddress?: null | string;
  }
) =>
  creator?.displayName ||
  creator?.username ||
  creator?.walletAddress ||
  "Unknown creator";

const FanDropManager = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FanDropAdminFormState>(createEmptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const fanDropsQuery = useQuery({
    queryFn: listStaffFanDrops,
    queryKey: [STAFF_FANDROPS_QUERY_KEY]
  });
  const creatorsQuery = useQuery({
    queryFn: () => listStaffCreators(form.creatorSearch, 8, 0),
    queryKey: [STAFF_CREATORS_QUERY_KEY, "fandrop-picker", form.creatorSearch]
  });

  const selectedCreator = useMemo(
    () =>
      creatorsQuery.data?.find(
        (creator) => creator.profileId === form.creatorProfileId
      ) || null,
    [creatorsQuery.data, form.creatorProfileId]
  );

  const startEdit = (fanDrop: StaffFanDropRow) => {
    setForm({
      about: fanDrop.about || "",
      bannerUrl: fanDrop.bannerUrl || "/buycoin.png",
      buyAmount:
        fanDrop.buyAmount === null || fanDrop.buyAmount === undefined
          ? ""
          : String(fanDrop.buyAmount),
      coverLabel: fanDrop.coverLabel || "FanDrop",
      creatorProfileId: fanDrop.creatorProfileId || "",
      creatorSearch: fanDrop.creatorName || fanDrop.creatorUsername || "",
      endsAt: toDateTimeInput(fanDrop.endsAt),
      isBuyOptional: fanDrop.buyIsOptional,
      missionId: fanDrop.missionId,
      referralTarget: String(fanDrop.referralTarget || 2),
      rewardE1xp: String(fanDrop.rewardE1xp || 0),
      rewardPoolLabel: fanDrop.rewardPoolLabel || "",
      startsAt: toDateTimeInput(fanDrop.startsAt),
      status: fanDrop.status as FanDropAdminFormState["status"],
      subtitle: fanDrop.subtitle || "",
      title: fanDrop.title
    });
  };

  const handleSubmit = async () => {
    if (!form.creatorProfileId.trim()) {
      toast.error("Choose a creator profile first.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("FanDrop title is required.");
      return;
    }

    setIsSaving(true);

    try {
      await staffUpsertFanDropCampaign({
        about: form.about || null,
        bannerUrl: form.bannerUrl || null,
        buyAmount: form.buyAmount.trim()
          ? Number.parseFloat(form.buyAmount)
          : null,
        coverLabel: form.coverLabel || null,
        creatorProfileId: form.creatorProfileId,
        endsAt: form.endsAt || null,
        isBuyOptional: form.isBuyOptional,
        missionId: form.missionId,
        referralTarget: Number.parseInt(form.referralTarget || "2", 10),
        rewardE1xp: Number.parseInt(form.rewardE1xp || "0", 10),
        rewardPoolLabel: form.rewardPoolLabel || null,
        startsAt: form.startsAt || null,
        status: form.status,
        subtitle: form.subtitle || null,
        title: form.title.trim()
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [STAFF_FANDROPS_QUERY_KEY] }),
        queryClient.invalidateQueries({
          queryKey: [STAFF_DASHBOARD_QUERY_KEY]
        }),
        queryClient.invalidateQueries({ queryKey: [EVERY1_FANDROPS_QUERY_KEY] })
      ]);

      toast.success(form.missionId ? "FanDrop updated" : "FanDrop created");
      setForm(createEmptyForm());
    } catch (error) {
      console.error("Failed to save FanDrop", error);
      toast.error("Couldn't save this FanDrop.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="p-3 md:p-4" forceRounded>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[15px] text-gray-950 md:text-base dark:text-gray-50">
                  {form.missionId ? "Edit FanDrop" : "Create FanDrop"}
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:text-xs dark:text-gray-400">
                  Create or manage creator reward races from the staff side.
                </p>
              </div>
              {form.missionId ? (
                <Button
                  onClick={() => setForm(createEmptyForm())}
                  outline
                  size="sm"
                >
                  Reset
                </Button>
              ) : null}
            </div>

            <Input
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  creatorSearch: event.target.value
                }))
              }
              placeholder="Search creator"
              value={form.creatorSearch}
            />

            <div className="grid gap-2">
              {creatorsQuery.data?.slice(0, 5).map((creator) => (
                <button
                  className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/75 px-3 py-2 text-left dark:border-gray-800/75"
                  key={creator.profileId}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      creatorProfileId: creator.profileId,
                      creatorSearch:
                        creator.displayName || creator.username || ""
                    }))
                  }
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {getCreatorLabel(creator)}
                    </p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {creator.profileId}
                    </p>
                  </div>
                  {form.creatorProfileId === creator.profileId ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-[10px] text-emerald-700 dark:text-emerald-300">
                      Selected
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {selectedCreator ? (
              <div className="rounded-[1rem] bg-gray-50 px-3 py-2 dark:bg-gray-900">
                <p className="font-semibold text-[12px] text-gray-900 dark:text-gray-100">
                  {getCreatorLabel(selectedCreator)}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {selectedCreator.profileId}
                </p>
              </div>
            ) : null}

            <div className="grid gap-2.5 md:grid-cols-2">
              <Input
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="FanDrop title"
                value={form.title}
              />
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    coverLabel: event.target.value
                  }))
                }
                placeholder="Cover label"
                value={form.coverLabel}
              />
            </div>

            <Input
              onChange={(event) =>
                setForm((prev) => ({ ...prev, subtitle: event.target.value }))
              }
              placeholder="Subtitle"
              value={form.subtitle}
            />

            <TextArea
              onChange={(event) =>
                setForm((prev) => ({ ...prev, about: event.target.value }))
              }
              placeholder="Campaign brief"
              rows={4}
              value={form.about}
            />

            <div className="grid gap-2.5 md:grid-cols-2">
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    rewardPoolLabel: event.target.value
                  }))
                }
                placeholder="Reward pool label"
                value={form.rewardPoolLabel}
              />
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    bannerUrl: event.target.value
                  }))
                }
                placeholder="Banner image URL"
                value={form.bannerUrl}
              />
            </div>

            <div className="grid gap-2.5 md:grid-cols-4">
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    rewardE1xp: event.target.value
                  }))
                }
                placeholder="Reward E1XP"
                type="number"
                value={form.rewardE1xp}
              />
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    referralTarget: event.target.value
                  }))
                }
                placeholder="Invite target"
                type="number"
                value={form.referralTarget}
              />
              <Input
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    buyAmount: event.target.value
                  }))
                }
                placeholder="Buy amount"
                type="number"
                value={form.buyAmount}
              />
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
                <span className="text-[12px] text-gray-600 dark:text-gray-300">
                  Optional buy
                </span>
                <Toggle
                  on={form.isBuyOptional}
                  setOn={(value) =>
                    setForm((prev) => ({ ...prev, isBuyOptional: value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3">
              <Input
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startsAt: event.target.value }))
                }
                type="datetime-local"
                value={form.startsAt}
              />
              <Input
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endsAt: event.target.value }))
                }
                type="datetime-local"
                value={form.endsAt}
              />
              <Select
                defaultValue={form.status}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    status: value as FanDropAdminFormState["status"]
                  }))
                }
                options={[
                  {
                    label: "Draft",
                    selected: form.status === "draft",
                    value: "draft"
                  },
                  {
                    label: "Active",
                    selected: form.status === "active",
                    value: "active"
                  },
                  {
                    label: "Paused",
                    selected: form.status === "paused",
                    value: "paused"
                  },
                  {
                    label: "Completed",
                    selected: form.status === "completed",
                    value: "completed"
                  },
                  {
                    label: "Archived",
                    selected: form.status === "archived",
                    value: "archived"
                  }
                ]}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSubmit()} size="sm">
                {isSaving
                  ? "Saving..."
                  : form.missionId
                    ? "Update FanDrop"
                    : "Create FanDrop"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4" forceRounded>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-[15px] text-gray-950 md:text-base dark:text-gray-50">
                FanDrop inventory
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:text-xs dark:text-gray-400">
                Review live, draft, paused, and completed FanDrops.
              </p>
            </div>

            {fanDropsQuery.isLoading ? (
              <Loader className="py-10" message="Loading FanDrops..." />
            ) : fanDropsQuery.error ? (
              <ErrorMessage
                error={fanDropsQuery.error}
                title="Failed to load FanDrops"
              />
            ) : fanDropsQuery.data?.length ? (
              <div className="space-y-2">
                {fanDropsQuery.data.map((fanDrop) => (
                  <div
                    className="rounded-[1rem] border border-gray-200/75 px-3 py-3 dark:border-gray-800/75"
                    key={fanDrop.missionId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                          {fanDrop.title}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {fanDrop.slug}
                        </p>
                      </div>
                      <Button
                        onClick={() => startEdit(fanDrop)}
                        outline
                        size="sm"
                      >
                        <PencilSquareIcon className="size-4" />
                        Edit
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                        {fanDrop.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                        {getCreatorLabel({
                          displayName: fanDrop.creatorName,
                          username: fanDrop.creatorUsername,
                          walletAddress: fanDrop.creatorWalletAddress
                        })}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                        {nFormatter(fanDrop.participantCount, 1)} joined
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                        {fanDrop.rewardPoolLabel || "Reward pool live"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1rem] border border-gray-200/75 border-dashed px-3 py-10 text-center text-[12px] text-gray-500 dark:border-gray-800/75 dark:text-gray-400">
                No FanDrops yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FanDropManager;
