import type { Address } from "viem";
import { useWithdrawMutation } from "@/indexer/generated";
import TokenOperation from "./TokenOperation";

interface WithdrawProps {
  currency?: Address;
  value: string;
  refetch: () => void;
  buttonLabel?: string;
  title?: string;
  successMessage?: string;
  className?: string;
  outline?: boolean;
  size?: "sm" | "md" | "lg";
}

const Withdraw = ({
  currency,
  value,
  refetch,
  buttonLabel = "Withdraw",
  title = "Withdraw",
  successMessage = "Withdrawal Successful",
  className,
  outline = true,
  size = "sm"
}: WithdrawProps) => {
  return (
    <TokenOperation
      buildRequest={(amount) =>
        currency ? { erc20: { currency, value: amount } } : { native: amount }
      }
      buttonLabel={buttonLabel}
      className={className}
      outline={outline}
      refetch={refetch}
      resultKey="withdraw"
      size={size}
      successMessage={successMessage}
      title={title}
      useMutationHook={useWithdrawMutation}
      value={value}
    />
  );
};

export default Withdraw;
