import { Box, HelpIcon } from "@pancakeswap/uikit";
import Image from "next/image";
import { memo } from "react";
import { SpaceProps } from "styled-system";
import { ASSET_CDN } from "../../utils/endpoints";

export const ChainLogo = memo(
  ({
    chainId,
    width = 24,
    height = 24,
    ...props
  }: { chainId?: number; width?: number; height?: number } & SpaceProps) => {
    const icon = chainId ? (
      <Image
        alt={`chain-${chainId}`}
        style={{ maxHeight: `${height}px` }}
        src={`${ASSET_CDN}/web/chains/${chainId}.png`}
        width={width}
        height={height}
        unoptimized
      />
    ) : (
      <HelpIcon width={width} height={height} />
    );
    return <Box {...props}>{icon}</Box>;
  }
);
