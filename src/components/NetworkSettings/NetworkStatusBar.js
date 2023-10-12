import { useSelector } from "react-redux";
import { eq } from "lodash";
import { AlertUI } from "../../styles/themes";
import { ToplineBar } from "../../components/ToplineBar";
import { PRE_SETTINGS_MAINNET, PRE_SETTINGS_TESTNET } from "../../constants";

export const NetworkStatusBar = () => {
  const networkSettings = useSelector((state) => state.networkSettings);
  if (eq(networkSettings , PRE_SETTINGS_MAINNET)
    || eq(networkSettings, PRE_SETTINGS_TESTNET)) {
    return null;
  }

  const style = {
    backgroundColor: AlertUI.primaryColor,
    color: AlertUI.dark40Color,
  };
  const text = 'n='+networkSettings.network+' • s='+networkSettings.stage;
  return (
    <ToplineBar style={style} text={text} />
  );
};
