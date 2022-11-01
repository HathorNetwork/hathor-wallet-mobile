
# Windows

Instructions to run the wallet on Windows.

## Install Android Studio

See the [releases](https://developer.android.com/studio) that most fits for your use:

- Windows(64-bit) [android-studio-2021.3.1.17-windows.exe](https://redirector.gvt1.com/edgedl/android/studio/install/2021.3.1.17/android-studio-2021.3.1.17-windows.exe)
- Windows(64-bit) [android-studio-2021.3.1.17-windows.zip](https://redirector.gvt1.com/edgedl/android/studio/ide-zips/2021.3.1.17/android-studio-2021.3.1.17-windows.zip)

## Configure Android Studio Environment Variables

> INFO: The following commands should be run in your PowerShell terminal.

As the SDK installation by default is installed at `$env:USERPROFILE\AppData\Local\Android\Sdk`, add the following environment variables targeting your user:

Set `ANDROID_SDK_ROOT`

```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT',"$env:USERPROFILE\AppData\Local\Android\Sdk",[System.EnvironmentVariableTarget]::User)
```

Set `ANDROID_HOME`

```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME',"$env:USERPROFILE\AppData\Local\Android\Sdk",[System.EnvironmentVariableTarget]::User)
```

Now add the parth for the Android Virtual Devices (AVD), this folder contains your configured devices.

Set `ANDROID_AVD_HOME`

```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_AVD_HOME',"$env:USERPROFILE\.android\avd",[System.EnvironmentVariableTarget]::User)
```
## Add Android Studio tools on executables PATH

> INFO: For more details see [Command-line tools](https://developer.android.com/studio/command-line).

Add the following paths to your environment `PATH` variable:

Set `ANDROID_HOME/tools`

```powershell
$env:PATH += ";$env:ANDROID_HOME\tools"
```

Set `ANDROID_HOME/tools/bin`

```powershell
$env:PATH += ";$env:ANDROID_HOME\tools\bin"
 ```

Set `ANDROID_HOME/platform-tools`

```powershell
$env:PATH += ";$env:ANDROID_HOME\platform-tools"
```

Check the new paths

```powershell
$env:PATH
```

Persist the new paths in your `user` environment

```powershell
[System.Environment]::SetEnvironmentVariable('Path',$env:PATH,[System.EnvironmentVariableTarget]::User)
```

Check the `PATH` variable in your `user` environment

```powershell
[System.Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::User)
```

## Hardware Acceleration

> INFO: For more details read [Configure hardware acceleration for the Android Emulator](https://developer.android.com/studio/run/emulator-acceleration)

### Intel processor + enabled Hyper-V

For intel processors and necessity to run Windows feature hyper-v (required by WSL), go with HAXM:

[https://github.com/intel/haxm](https://github.com/intel/haxm)

- See [restrictions](https://developer.android.com/studio/run/emulator-acceleration#vm-accel-restrictions)
- See your [configuration](https://developer.android.com/studio/run/emulator-acceleration#vm-windows) for a different set-up

# Install Dependencies and Utilities

## Install Chocolatey

It is a streight foraward package manager sotware for Windows and it will be used in installation instructions that follows. Read the [installation instructions](https://chocolatey.org/install).

## Install Java OpenJDK 11

<details><summary>Using Chocolatey</summary>

See the available options:
```powershell
choco search openjdk11
```

Choose your desired version and install:
```powershell
choco install microsoft-openjdk11
```
</details>

<details><summary>Using winget</summary>

See the available options:
```powershell
winget search Microsoft.OpenJDK
```

Choose your desired version and install:
```powershell
winget install Microsoft.OpenJDK.11
```
</details>

The installed JDK should be found at `C:\Program Files\Microsoft\jdk-11.0.16.101-hotspot`.

## Configure JDK environment varible

Add `JAVA_HOME` to your environment varibales targeting your user:

```powershell
[System.Environment]::SetEnvironmentVariable('JAVA_HOME',"$env:ProgramFiles\Microsoft\jdk-11.0.16.101-hotspot",[System.EnvironmentVariableTarget]::User)
```

## Install Make

See more about [`make` tool](https://www.gnu.org/software/make/), an utility to help build software, and used in the build process of the wallet.

<details><summary>Install by Chocolatey</summary>
On windows you can install with Chocolatey:

```powershell
choco install make
```
</details>

## Install POEDIT

See more about [POEDIT](https://poedit.net/), an utility to manage and edit translations, see [TRANSLATING.md](./TRANSLATING.md)

<details><summary>Install by Chocolatey</summary>

On windows you can install with Chocolatey:

```powershell
choco install poedit
```

However the current available version is ****`2.4.2`,** while downloading from the website you get the most recent version.
</details>

- or instal by downaload

The installed POEDIT should be found at `C:\Program Files (x86)\Poedit`.

## Configure POEDIT executable PATH

POEDIT uses some software tools underneath, a major one is `GettextTools`, and its executable is required for i18n compilation script of the wallet.

Add the `GettextTools` executable to `PATH`:

```powershell
$env:PATH += ";${env:ProgramFiles(x86)}\Poedit\GettextTools\bin\;"
```

Persist the new `PATH` value in your `user` environment:

```powershell
[System.Environment]::SetEnvironmentVariable('Path',$env:PATH,[System.EnvironmentVariableTarget]::User)
```

After run the command above restart you PowerShell session, then verify running the following command:

```powershell
msgmerge --version
```

You should see a result like this:

```powershell
msgmerge.exe (GNU gettext-tools) 0.21
Copyright (C) 1995-2020 Free Software Foundation, Inc.
Licença GPLv3+: GNU GPL versão 3 ou posterior <https://gnu.org/licenses/gpl.html>
Este é um software livre: você é livre para alterá-lo e redistribuí-lo.
NÃO HÁ QUALQUER GARANTIA, na máxima extensão permitida em lei.
Escrito por Peter Miller.
C:\Program Files (x86)\Poedit\GettextTools\bin\msgmerge.exe: erro de escrita
```
## i18n compilation

Update the pot file at `locale\texts.pot`
```powershell
npm run locale-update-pot
```

Navigate to `locale` directory
```
cd locale
```

Merge a `pot` file to `po` file:
```powershell
msgmerge -D <any-subdirectory>\hathor-wallet-mobile\locale\ pt-br\texts.po texts.pot -o <any-subdirectory>\hathor-wallet-mobile\locale\pt-br\texts.po
```
for `pt-br`

```powershell
msgmerge -D <any-subdirectory>\hathor-wallet-mobile\locale\ da\texts.po texts.pot -o <any-subdirectory>\hathor-wallet-mobile\locale\da\texts.po
```
for `da`

```powershell
msgmerge -D <any-subdirectory>\hathor-wallet-mobile\locale\ ru-ru\texts.po texts.pot -o <any-subdirectory>\hathor-wallet-mobile\locale\ru-ru\texts.po
```
for `ru-ru`

Create the directory of compiled translations into `src\locale\<locale>` for each locale
```powershell
mkdir src\locale\pt-br || mkdir src\locale\da || mkdir src\locale\ru-ru
```

Run `i18n` function to compile translations for each locale

```powershell
make i18n
```

If you get an error like this:
```
make: *** [Makefile:34: src/locale/pt-br/texts.po.json] Error 1
```
then comment the line 34 from `Makefile` file and run again.

If you get an erro like this:
```
npx ttag po2json locale/pt-br/texts.po > src/locale/pt-br/texts.po.json
if [  = 1 ]; then \
        msgcmp locale/da/texts.po locale/texts.pot; \
else \
        msgcmp --use-untranslated locale/da/texts.po locale/texts.pot; \
fi
...
make: *** [Makefile:57: locale/da/texts.po] Error 255
```
then copy the file `src\pt-br\texts.po.json` to `src\da\` and `src\ru-ru\`, just to make the android build pass.

> NOTE: 

## Add a mobile device in the emulator

1. Open Android Studio
2. Open the Virtual Device Manager
3. Click in "Create device"
4. Select a phone definition, like "Pixel 6"
5. Choose an Android version and click on the icon of download besides the version name
6. After download, click next
7. Give a name for the ADV
8. Accept the default values and click finish

## Run

1. Open 2 terminals
2. On terminal (1) run `npm start`
3. On terminal (2) run `npm run android`

## Play with Hathor mobile wallet

After the android build:
1. open your device emulation
2. open the apps panel
3. touch on Hathor icon and start playing around