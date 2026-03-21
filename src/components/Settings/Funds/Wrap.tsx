import { WRAPPED_NATIVE_TOKEN_SYMBOL } from "@/data/constants";
import { useWrapTokensMutation } from "@/indexer/generated";
import TokenOperation from "./TokenOperation";

interface WrapProps {
  value: string;
  refetch: () => void;
  buttonLabel?: string;
  title?: string;
  className?: string;
  outline?: boolean;
  size?: "sm" | "md" | "lg";
}

const Wrap = ({
  value,
  refetch,
  buttonLabel = `Wrap to ${WRAPPED_NATIVE_TOKEN_SYMBOL}`,
  title = "Wrap",
  className,
  outline = true,
  size = "sm"
}: WrapProps) => {
  return (
    <TokenOperation
      buildRequest={(amount) => ({ amount })}
      buttonLabel={buttonLabel}
      className={className}
      outline={outline}
      refetch={refetch}
      resultKey="wrapTokens"
      size={size}
      successMessage="Wrap Successful"
      title={title}
      useMutationHook={useWrapTokensMutation}
      value={value}
    />
  );
};

export default Wrap;
