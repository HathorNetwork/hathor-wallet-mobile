# New Wallet Flow

This document describes what happens with the app and the lib during the new wallet start flow

1. After the wallet is opened, the wallet navigates to the DecideStackScreen
  1. On `componentDidMount`, this screen decides based on the return of the `hathorLib.wallet.loaded()` method whether to navigate to `AppStack` or the `InitStack`
  1. Since our wallet is not initialized yet, it will navigate to the `InitStack`
1. The `initialRoute` for the `InitStack` is the `WelcomeScreen`, so this is the screen that gets rendered
1. On the `WelcomeScreen`, the user first has to agree with our terms of service and privacy policy (which are external URLs)
1. The user then clicks the "Start" button and the app navigates to the `InitialScreen`
1. On the `InitialScreen`, the user is prompted to select if he wants to import a wallet or create a new wallet
  1. If he clicks `New Wallet`, he will navigate to the `NewWordsScreen`
    1. On the `NewWordsScreen`, a list of words (generated with the hathorLib) will be presented to him and a `Next` button will be displayed
      1. Pressing the `Next` button, the app will navigate to the `BackupWords` screen
        1. On the `BackupWords` screen, he will confirm that he successfuly backed up his wallet
        1. A modal will be shown saying that the backup was successful and dismissing it will navigate to the `ChoosePinScreen` with the `words` as parameter.
  1. After the PIN is selected on the `ChoosePinScreen`, a button "Start the Wallet" will be displayed, pressing it will navigate to the `HomeScreen`
    1. It will also dispatch the `unlockScreen` action and the `setInitWallet` action with the words and the pin as action payload
  1. If the app is configured as `MULTI_TOKEN` (as defined in the constants.js file), the `DashboardStack` screen will be rendered, being the `Dashboard` screen the initial route
  1. If the app is configured as not `MULTI_TOKEN`, the `MainScreen` will be rendered.
1. 

