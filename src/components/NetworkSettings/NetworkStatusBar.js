import { useSelector } from "react-redux";
import { eq } from "lodash";
import { t } from 'ttag';
import { AlertUI } from "../../styles/themes";
import { ToplineBar } from "../../components/ToplineBar";
import { PRE_SETTINGS_MAINNET } from "../../constants";

const customNetworkText = t`Custom network`;

export const NetworkStatusBar = () => {
  const networkSettings = useSelector((state) => state.networkSettings);
  if (eq(networkSettings , PRE_SETTINGS_MAINNET)) {
    return null;
  }

  const style = {
    backgroundColor: AlertUI.primaryColor,
    color: AlertUI.dark40Color,
  };
  const text = customNetworkText+': '+networkSettings.network;
  return (
    <ToplineBar style={style} text={text} />
  );
};
