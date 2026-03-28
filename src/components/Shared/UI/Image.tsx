import type {
  DetailedHTMLProps,
  ImgHTMLAttributes,
  Ref,
  SyntheticEvent
} from "react";
import { forwardRef, memo, useCallback, useEffect, useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/data/constants";
import sanitizeDStorageUrl from "@/helpers/sanitizeDStorageUrl";

const Image = forwardRef(
  (
    {
      onError,
      ...props
    }: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
    ref: Ref<HTMLImageElement>
  ) => {
    const [imageLoadFailed, setImageLoadFailed] = useState(false);
    const normalizedSrc =
      typeof props.src === "string"
        ? sanitizeDStorageUrl(props.src)
        : props.src;

    const handleError = useCallback(
      (event: SyntheticEvent<HTMLImageElement, Event>) => {
        if (imageLoadFailed) {
          return;
        }
        setImageLoadFailed(true);
        if (onError) {
          onError(event);
        }
      },
      [imageLoadFailed, setImageLoadFailed, onError]
    );

    useEffect(() => {
      setImageLoadFailed(false);
    }, [normalizedSrc]);

    return (
      <img
        {...props}
        alt={props.alt || ""}
        onError={handleError}
        ref={ref}
        src={imageLoadFailed ? PLACEHOLDER_IMAGE : normalizedSrc}
      />
    );
  }
);

export default memo(Image);
