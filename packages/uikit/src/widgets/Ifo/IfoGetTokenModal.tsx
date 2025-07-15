import { useTranslation } from "@pancakeswap/localization";
import { Button } from "../../components/Button";
import { Image } from "../../components/Image";
import { Link } from "../../components/Link";
import { OpenNewIcon } from "../../components/Svg";
import { Text } from "../../components/Text";
import { useMatchBreakpoints } from "../../contexts";
import { Modal, ModalBody } from "../Modal";

interface Props {
  symbol: string;
  address: string;
  imageSrc: string;
  onDismiss?: () => void;
}

const IfoGetTokenModal: React.FC<React.PropsWithChildren<Props>> = ({ symbol, address, imageSrc, onDismiss }) => {
  const { t } = useTranslation();
  const { isMobile } = useMatchBreakpoints();

  return (
    <Modal title={t("%symbol% required", { symbol })} onDismiss={onDismiss}>
      <ModalBody maxWidth={isMobile ? "100%" : "288px"}>
        <Image src={imageSrc} width={72} height={72} margin="auto" mb="24px" />
        <Text mb="16px">{t("You’ll need %symbol% tokens to participate in the IFO!", { symbol })}</Text>
        <Text mb="24px">{t("Get %symbol%, or make sure your tokens aren’t staked somewhere else.", { symbol })}</Text>
        <Button
          as={Link}
          external
          href={`/swap?outputCurrency=${address}`}
          color="invertedContrast"
          endIcon={<OpenNewIcon color="invertedContrast" />}
          minWidth="100%" // Bypass the width="fit-content" on Links
        >
          {t("Get %symbol%", { symbol })}
        </Button>
        <Button
          mt="1rem"
          as={Link}
          external
          href="https://pancakeswap.finance/bridge"
          color="invertedContrast"
          endIcon={<OpenNewIcon color="invertedContrast" />}
          minWidth="100%" // Bypass the width="fit-content" on Links
        >
          {t("Bridge CAKE")}
        </Button>
      </ModalBody>
    </Modal>
  );
};

export default IfoGetTokenModal;
