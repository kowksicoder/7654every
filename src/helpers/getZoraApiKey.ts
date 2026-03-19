import { ZORA_API_KEY } from "@/data/constants";

const getZoraApiKey = () =>
  import.meta.env.VITE_NEXT_PUBLIC_ZORA_API_KEY ||
  import.meta.env.VITE_ZORA_API_KEY ||
  ZORA_API_KEY;

export default getZoraApiKey;
