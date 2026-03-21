import { NATIVE_TOKEN_SYMBOL } from "@/data/constants";
import { useUnwrapTokensMutation } from "@/indexer/generated";
import TokenOperation from "./TokenOperation";

interface UnwrapProps {
  value: string;
  refetch: () => void;
  buttonLabel?: string;
  title?: string;
  className?: string;
  outline?: boolean;
  size?: "sm" | "md" | "lg";
}

const Unwrap = ({
  value,
  refetch,
  buttonLabel = `Unwrap to ${NATIVE_TOKEN_SYMBOL}`,
  title = "Unwrap",
  className,
  outline = true,
  size = "sm"
}: UnwrapProps) => {
  return (
    <TokenOperation
      buildRequest={(amount) => ({ amount })}
      buttonLabel={buttonLabel}
      className={className}
      outline={outline}
      refetch={refetch}
      resultKey="unwrapTokens"
      size={size}
      successMessage="Unwrap Successful"
      title={title}
      useMutationHook={useUnwrapTokensMutation}
      value={value}
    />
  );
};

export default Unwrap;
