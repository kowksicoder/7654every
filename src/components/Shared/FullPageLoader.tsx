import evLogo from "@/assets/fonts/evlogo.jpg";
import { Image } from "@/components/Shared/UI";

const FullPageLoader = () => {
  return (
    <div className="grid h-screen place-items-center">
      <Image
        alt="Logo"
        className="size-28 rounded-3xl object-cover"
        height={112}
        src={evLogo}
        width={112}
      />
    </div>
  );
};

export default FullPageLoader;
