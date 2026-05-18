---
name: Web3Auth Mobile Implementation
description: Status tracker for Web3Auth single-key wallet implementation on wallet-mobile
last_updated: 2026-04-17T17:30
---

# Web3Auth Mobile Implementation Status

## RFCs de referencia

| # | Tipo | Link | Escopo |
|---|------|------|--------|
| 0 | Foundation RFC | HathorNetwork/rfcs#106 | O que e Web3Auth + setup operacional |
| 1 | Design RFC | HathorNetwork/internal-rfcs#46 | wallet-lib single-key mode + mobile onboarding UI |
| 2 | PoC | HathorNetwork/hathor-wallet-lib#1062 | Implementacao na lib + testes |
| 3 | Design RFC | HathorNetwork/internal-rfcs#47 | Wallet-service support (stacked on #46) |

## Setup

- **Worktree:** `/Users/rauloliveira/git/hathor/wallet-mobile-web3auth` (branch `feat/web3auth`)
- **Wallet-lib PoC:** `/Users/rauloliveira/git/hathor/hathor-wallet-lib` (branch `feat/web3auth-single-key-poc`, yalc linked)
- **Design doc:** `docs/plans/2026-04-17-web3auth-mobile-design.md`
- **Implementation plan:** `docs/plans/2026-04-17-web3auth-mobile-implementation.md`

## Implementacao concluida (15 tasks)

Todas as tasks do plano de implementacao foram executadas por subagents:

| Task | Arquivo(s) | Status |
|------|-----------|--------|
| 1. Install deps | package.json | Done - `@web3auth/react-native-sdk@8.1.0`, `@web3auth/base@9.7.0`, `@toruslabs/react-native-web-browser@1.1.0` |
| 2. Constants/toggle | src/constants.js | Done - `WEB3AUTH_FEATURE_TOGGLE`, client ID/secret, storage keys, redirect URL |
| 3. Redux state | src/actions.js, src/reducers/reducer.js, src/selectors.js | Done - `walletType`, `web3authEmail`, `isSingleKeyWallet()` |
| 4. Store methods | src/store.js | Done - `initWeb3AuthStorage`, `getWeb3AuthPrivateKey`, `getWeb3AuthPublicKey` |
| 5. Web3Auth saga | src/sagas/web3auth.js | Done - login, key derivation, state mgmt |
| 6. startWallet saga | src/sagas/wallet.js | Done - web3auth branch, force-disable wallet-service, external signer |
| 7. Reset wallet | src/sagas/wallet.js | Done - `web3auth.logout()` + cleanup |
| 8. PinScreen | src/screens/PinScreen.js | Done - unlock/validatePin web3auth branch |
| 9. ChoosePinScreen | src/screens/ChoosePinScreen.js | Done - web3auth params, `initWeb3AuthStorage` |
| 10. InitialScreen | src/screens/InitWallet.js | Done - social login icons (G, @, A) |
| 11. ReceiveMyAddress | src/components/ReceiveMyAddress.js | Done - hide "New address" |
| 12. Settings/Security | src/screens/Settings.js, Security.js | Done - hide Reown, add "Sign out" |
| 13. App startup | src/App.js | Done - restore walletType/email from AsyncStorage |
| 14. Recovery screen | src/screens/Web3AuthRecoveryScreen.js, App.js | Done - placeholder |
| 15. URL schemes | android/AndroidManifest.xml, ios/Info.plist | Done - already existed |

## Dependencias adicionadas durante debugging

```bash
npm install react-native-encrypted-storage @web3auth/base-provider
```

- `react-native-encrypted-storage` — required como 2o argumento do constructor Web3Auth v8
- `@web3auth/base-provider` — `CommonPrivateKeyProvider` para chains non-EVM

## Correcoes feitas durante debugging (v7 -> v8 API)

| Problema | Correcao |
|----------|----------|
| `OPENLOGIN_NETWORK` nao existe na v8 | Trocado por `WEB3AUTH_NETWORK` de `@web3auth/react-native-sdk` |
| `LOGIN_PROVIDER` undefined de `@web3auth/react-native-sdk` | Import de `@web3auth/auth` (nao `@web3auth/base`, que nao exporta) |
| Constructor com 2 args | Corrigido para 3 args: `new Web3Auth(WebBrowser, EncryptedStorage, options)` |
| Falta `privateKeyProvider` | Adicionado `CommonPrivateKeyProvider` com `CHAIN_NAMESPACES.OTHER` |
| Falta `init()` antes de `login()` | Adicionado `await web3authInstance.init()` |
| `login()` retorna `{ privKey }` (v7) | Corrigido: v8 retorna `IProvider`, usar `provider.request({ method: 'private_key' })` |
| `userInfo` no resultado do login | Corrigido: v8 usa `web3auth.userInfo()` (metodo da instancia) |
| `redirectUrl` so no login | Movido para as options do constructor (required em v8) |
| Provider criado no top-level | Movido para lazy init dentro de `getWeb3AuthInstance()` |

## BLOCKER RESOLVIDO: "Invalid y value for curve"

### Sintoma
Ao clicar no icone Google no InitialScreen, o Web3Auth SDK crashava com:
```
Error: Invalid y value for curve.
TypeError: Cannot read property 'LOGIN_PROVIDER' of undefined
```

### Causa raiz (atualizada 2026-04-17)

**Duas causas independentes, ambas resolvidas:**

#### Causa 1: rn-nodeify crypto hack (LOGIN_PROVIDER)
O `rn-nodeify --hack` injeta `"crypto": "react-native-crypto"` nos `package.json` de TODOS os pacotes. Isso corrompe o barrel export de `@web3auth/auth` — submodulos como `starkey` dependem de `@toruslabs/starkware-crypto` → `elliptic` → `brorand`, que recebe o polyfill quebrado. O modulo inteiro falha ao carregar, resultando em `LOGIN_PROVIDER === undefined`.

**Fix:** Remover o hack de 19 pacotes (`@toruslabs/*`, `@web3auth/*`, `elliptic`, `brorand`, `hash.js`, `hmac-drbg`).

#### Causa 2: bitcore-lib prototype pollution (Invalid y value)
`bitcore-lib/lib/crypto/point.js` faz prototype pollution no `elliptic`:
```js
Point.prototype = Object.getPrototypeOf(ec.curve.point());  // shared prototype!
Point.prototype.validate = function() { /* THROWS instead of returning boolean */ };
```
Isso substitui `elliptic`'s `BasePoint.prototype.validate` (que retorna boolean) por uma versao que **throws**. Quando o Web3Auth SDK cria EC points internamente via `@toruslabs/session-manager` → `@toruslabs/eccrypto` → `elliptic`, o `elliptic/ec/key.js:45` chama `pub.validate()` esperando boolean, mas recebe a versao do bitcore-lib que throws.

**Fix:** Em `shim.js`, salvar o `validate` nativo do `elliptic`, deixar `bitcore-lib` carregar (poluindo o prototype), depois restaurar o nativo. O `validate` do bitcore e salvo em `global.__bitcorePointValidate` e chamado explicitamente nos 3 callsites internos do bitcore-lib.

### Detalhes da investigacao
Ver `debug_investigation.md` para o passo-a-passo completo da investigacao, incluindo como o prototype pollution foi identificado usando variaveis globais de debug.

### Fixes aplicados

1. **Remocao do crypto hack** — script Python que remove `"crypto": "react-native-crypto"` dos campos `react-native`/`browser` de 19 pacotes
2. **Restauracao do validate nativo** — em `shim.js`, apos `require('bitcore-lib')`, restaura `BasePoint.prototype.validate` do `elliptic`
3. **Validate explicito no bitcore-lib** — `point.js` e `publickey.js` chamam `global.__bitcorePointValidate` diretamente

### Permanencia dos fixes
**Automatizada via `npm run setup`.** A ordem do pipeline agora e:

```
npm install -> allow-scripts -> rn-nodeify --hack
  -> node scripts/fix-web3auth-crypto-hack.js   (limpa crypto hack dos 20 pacotes Web3Auth)
    -> npx patch-package                         (aplica bitcore-lib + outros 5 patches)
```

Arquivos:
- `scripts/fix-web3auth-crypto-hack.js` - cleanup data-driven dos pacotes Web3Auth
- `patches/bitcore-lib+8.25.10.patch` - patch dos 3 callsites de `validate()`

Ver `explicacao-hacky-web3-auth.md` para o motivo do hack e o impacto no Web3Auth.

### Proximo blocker
`RNEncryptedStorage is undefined` — o modulo nativo `react-native-encrypted-storage` nao esta linkado. Precisa de `pod install` e rebuild.

## Mudancas temporarias (reverter antes de merge)

| Arquivo | Mudanca | Reverter |
|---------|---------|----------|
| src/constants.js:204 | `WEB3AUTH_FEATURE_TOGGLE: true` | Mudar para `false` |
| src/screens/InitWallet.js:169-170 | `{true && (` hardcoded | Restaurar `{this.props.web3authEnabled && (` |
| src/screens/InitWallet.js:148 | `alert()` no catch | Remover ou trocar por log |
| src/screens/InitWallet.js:207-211 | `console.log` no mapStateToProps | Remover |
| index.js:10-11 | `LogBox.ignoreAllLogs(true)` | Remover |
| src/sagas/web3auth.js:55 | `SAPPHIRE_DEVNET` | Trocar para `SAPPHIRE_MAINNET` em prod |

## Skills criadas

| Skill | Path | Escopo |
|-------|------|--------|
| worktree-env-replication | `~/.claude/skills/worktree-env-replication/` | Global - replica .claude/settings do repo para worktrees |
| worktree-preparation | `hathor-wallet-mobile/.claude/skills/worktree-preparation/` | Projeto - steps para preparar worktree da wallet-mobile |

## Comandos uteis

```bash
# Atualizar wallet-lib
cd /Users/rauloliveira/git/hathor/hathor-wallet-lib && npm run build && yalc push

# Reiniciar Metro
cd /Users/rauloliveira/git/hathor/wallet-mobile-web3auth
lsof -ti:8081 | xargs kill -9; npx react-native start --reset-cache

# Verificar logs do simulador
xcrun simctl spawn booted log show --predicate 'process == "HathorMobile"' --last 30s --style compact | grep -iE "error|javascript"

# Limpar hacks do rn-nodeify nos pacotes web3auth
for pkg in $(find node_modules/@toruslabs node_modules/@web3auth -name "package.json" -maxdepth 2); do
  python3 -c "
import json
with open('$pkg', 'r') as f:
    d = json.load(f)
rn = d.get('react-native', {})
if isinstance(rn, dict) and 'crypto' in rn:
    del rn['crypto']
    d['react-native'] = rn
    with open('$pkg', 'w') as f:
        json.dump(d, f, indent=2)
    print('Fixed: $pkg')
"
done

# MCP mobile - device ID
# iPhone 16: D49EDFFA-658B-4023-9EC5-840AF31ACA7D
# App bundle: network.hathor.wallet
```
