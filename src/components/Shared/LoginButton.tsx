import { type MouseEvent, useCallback } from "react";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { Button } from "@/components/Shared/UI";
import { useAuthModalStore } from "@/store/non-persisted/modal/useAuthModalStore";

interface LoginButtonProps {
  className?: string;
  isBig?: boolean;
  title?: string;
}

const LoginButton = ({
  className = "",
  isBig = false,
  title = "Login"
}: LoginButtonProps) => {
  const { setShowAuthModal } = useAuthModalStore();

  const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    umami.track("open_login");
    return setShowAuthModal(true);
  }, []);

  return (
    <Button
      className={className}
      icon={
        <img
          alt="Every1 Logo"
          className="mr-1 size-4 rounded-md object-cover"
          height={16}
          src={evLogo}
          width={16}
        />
      }
      onClick={handleClick}
      size={isBig ? "lg" : "md"}
    >
      {title}
    </Button>
  );
};

export default LoginButton;
