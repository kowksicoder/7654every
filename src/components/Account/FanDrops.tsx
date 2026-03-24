import { FireIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import Loader from "@/components/Shared/Loader";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  TextArea,
  Toggle
} from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import {
  EVERY1_FANDROPS_QUERY_KEY,
  upsertProfileFanDropCampaign
} from "@/helpers/every1";
import useProfileFanDrops from "@/hooks/useProfileFanDrops";
import type { Every1FanDropCampaign } from "@/types/every1";
import { mapEvery1FanDropToCard } from "../Missions/data";

type FanDropFormState = {
  about: string;
  bannerUrl: string;
  buyAmount: string;
  coverLabel: string;
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

const statusBadgeClassName: Record<Every1FanDropCampaign["status"], string> = {
  active:
    "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300",
  archived: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  completed: "bg-sky-500/12 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300",
  draft:
    "bg-amber-500/12 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300",
  paused:
    "bg-orange-500/12 text-orange-700 dark:bg-orange-500/12 dark:text-orange-300"
};

const createEmptyForm = (): FanDropFormState => ({
  about: "",
  bannerUrl: "/buycoin.png",
  buyAmount: "500",
  coverLabel: "FanDrop",
  endsAt: dayjs().add(12, "hour").format("YYYY-MM-DDTHH:mm"),
  isBuyOptional: true,
  missionId: null,
  referralTarget: "2",
  rewardE1xp: "250",
  rewardPoolLabel: "",
  startsAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  status: "active",
  subtitle: "",
  title: ""
});

const toDateTimeInput = (value?: null | string) =>
  value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";

const FanDrops = ({
  creatorName,
  creatorProfileId,
  isCurrentProfile
}: {
  creatorName: string;
  creatorProfileId?: null | string;
  isCurrentProfile: boolean;
}) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FanDropFormState>(createEmptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const fanDropsQuery = useProfileFanDrops({
    creatorProfileId: creatorProfileId || null
  });

  const campaigns = useMemo(
    () =>
      (fanDropsQuery.data || []).map((campaign) => ({
        campaign,
        card: mapEvery1FanDropToCard(campaign)
      })),
    [fanDropsQuery.data]
  );

  const startCreate = () => {
    setForm(createEmptyForm());
    setIsEditorOpen(true);
  };

  const startEdit = (campaign: Every1FanDropCampaign) => {
    const buyTask = campaign.tasks.find((task) =>
      task.label.toLowerCase().includes("buy")
    );
    const inviteTask = campaign.tasks.find((task) =>
      task.label.toLowerCase().includes("invite")
    );

    setForm({
      about: campaign.about || "",
      bannerUrl: campaign.bannerUrl || "/buycoin.png",
      buyAmount:
        buyTask?.targetValue === null || buyTask?.targetValue === undefined
          ? ""
          : String(buyTask.targetValue),
      coverLabel: campaign.coverLabel || "FanDrop",
      endsAt: toDateTimeInput(campaign.endsAt),
      isBuyOptional: buyTask?.isOptional ?? true,
      missionId: campaign.missionId,
      referralTarget: String(
        inviteTask?.targetValue === null ||
          inviteTask?.targetValue === undefined
          ? 2
          : inviteTask.targetValue
      ),
      rewardE1xp: String(campaign.rewardE1xp || 0),
      rewardPoolLabel: campaign.rewardPoolLabel || "",
      startsAt: toDateTimeInput(campaign.startsAt),
      status: campaign.status,
      subtitle: campaign.subtitle || "",
      title: campaign.title
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = async () => {
    if (!creatorProfileId) {
      toast.error("Creator profile not ready yet.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("FanDrop title is required.");
      return;
    }

    setIsSaving(true);

    try {
      await upsertProfileFanDropCampaign(creatorProfileId, {
        about: form.about || null,
        bannerUrl: form.bannerUrl || null,
        buyAmount: form.buyAmount.trim()
          ? Number.parseFloat(form.buyAmount)
          : null,
        coverLabel: form.coverLabel || null,
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

      await queryClient.invalidateQueries({
        queryKey: [EVERY1_FANDROPS_QUERY_KEY]
      });

      toast.success(form.missionId ? "FanDrop updated" : "FanDrop created");
      setIsEditorOpen(false);
      setForm(createEmptyForm());
    } catch (error) {
      console.error("Failed to save FanDrop", error);
      toast.error("Couldn't save this FanDrop.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderBody = () => {
    if (fanDropsQuery.isLoading) {
      return <Loader className="py-10" message="Loading FanDrops..." />;
    }

    if (!campaigns.length) {
      return (
        <EmptyState
          icon={<FireIcon className="size-7" />}
          message={
            isCurrentProfile
              ? "No FanDrops yet. Launch your first reward race here."
              : `${creatorName} has no live FanDrops yet.`
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {campaigns.map(({ campaign, card }) => (
          <Card className="p-3.5 md:p-4" forceRounded key={campaign.missionId}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-[0.14em]",
                      statusBadgeClassName[campaign.status]
                    )}
                  >
                    {campaign.status}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {card.timeLabel}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm md:text-base dark:text-gray-50">
                    {campaign.title}
                  </p>
                  {campaign.subtitle ? (
                    <p className="mt-1 text-[12px] text-gray-500 leading-5 dark:text-gray-400">
                      {campaign.subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                    {campaign.rewardPoolLabel || "Reward pool live"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                    {campaign.participantCount} joined
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">
                    {campaign.progressTotal} tasks
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {campaign.status !== "draft" && campaign.status !== "paused" ? (
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 px-3 py-2 font-semibold text-[12px] text-gray-700 dark:border-gray-800 dark:text-gray-200"
                    to={`/fandrop/${campaign.slug}`}
                  >
                    Open
                  </Link>
                ) : null}
                {isCurrentProfile ? (
                  <Button onClick={() => startEdit(campaign)} outline size="sm">
                    <PencilSquareIcon className="size-4" />
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="mx-5 space-y-3 md:mx-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base text-gray-950 dark:text-gray-50">
              FanDrops
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {isCurrentProfile
                ? "Create and manage reward races for your supporters."
                : `See ${creatorName}'s active and recent FanDrops.`}
            </p>
          </div>
          {isCurrentProfile ? (
            <Button onClick={startCreate} size="sm">
              <FireIcon className="size-4" />
              Create FanDrop
            </Button>
          ) : null}
        </div>
        {renderBody()}
      </div>

      <Modal
        onClose={() => setIsEditorOpen(false)}
        show={isEditorOpen}
        size="lg"
      >
        <div className="space-y-3 p-4 md:p-5">
          <div>
            <h3 className="font-semibold text-gray-950 text-lg dark:text-gray-50">
              {form.missionId ? "Edit FanDrop" : "Create FanDrop"}
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              Set the campaign copy, timing, pool label, and action targets.
            </p>
          </div>

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
            placeholder="Short subtitle"
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
                setForm((prev) => ({ ...prev, bannerUrl: event.target.value }))
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

          <div className="grid gap-2.5 md:grid-cols-2">
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
          </div>

          <Select
            defaultValue={form.status}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                status: value as FanDropFormState["status"]
              }))
            }
            options={[
              {
                label: "Active",
                selected: form.status === "active",
                value: "active"
              },
              {
                label: "Draft",
                selected: form.status === "draft",
                value: "draft"
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

          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsEditorOpen(false)} outline size="sm">
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} size="sm">
              {isSaving ? "Saving..." : form.missionId ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default FanDrops;
