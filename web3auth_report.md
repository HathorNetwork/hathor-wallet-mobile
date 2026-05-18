# Web3Auth — Mudancas em node_modules

Este documento lista TODAS as mudancas feitas em `node_modules/` durante o debugging do Web3Auth.

**Status: AUTOMATIZADO.** As mudancas sao reaplicadas automaticamente pelo `npm run setup` via:
- `scripts/fix-web3auth-crypto-hack.js` (cleanup do crypto hack nos 20 pacotes Web3Auth)
- `patches/bitcore-lib+8.25.10.patch` (patches dos 3 callsites de `validate()`)

Este documento permanece como referencia historica do debugging. Para o motivo do `rn-nodeify --hack` e seu impacto no Web3Auth, ver `explicacao-hacky-web3-auth.md`.

---

## 1. Remocao do crypto hack do rn-nodeify (19 pacotes)

O `rn-nodeify --hack` (executado por `npm run setup`) injeta `"crypto": "react-native-crypto"` nos campos `react-native` e `browser` do `package.json` de TODOS os pacotes em `node_modules/`. Isso precisa ser removido dos pacotes do ecosistema Web3Auth para que o barrel export de `@web3auth/auth` nao crashe ao carregar.

### Pacotes afetados

| # | Pacote | Campo `react-native` | Campo `browser` |
|---|--------|---------------------|-----------------|
| 1 | `@toruslabs/base-controllers` | remover `"crypto"` | remover `"crypto"` |
| 2 | `@toruslabs/broadcast-channel` | remover `"crypto"` | remover `"crypto"` |
| 3 | `@toruslabs/constants` | remover `"crypto"` | remover `"crypto"` |
| 4 | `@toruslabs/eccrypto` | remover `"crypto"` | remover `"crypto"` |
| 5 | `@toruslabs/ffjavascript` | remover `"crypto"` | remover `"crypto"` |
| 6 | `@toruslabs/http-helpers` | remover `"crypto"` | remover `"crypto"` |
| 7 | `@toruslabs/metadata-helpers` | remover `"crypto"` | remover `"crypto"` |
| 8 | `@toruslabs/react-native-web-browser` | remover `"crypto"` | remover `"crypto"` |
| 9 | `@toruslabs/secure-pub-sub` | remover `"crypto"` | remover `"crypto"` |
| 10 | `@toruslabs/session-manager` | remover `"crypto"` | remover `"crypto"` |
| 11 | `@toruslabs/starkware-crypto` | remover `"crypto"` | remover `"crypto"` |
| 12 | `@toruslabs/tweetnacl-js` | remover `"crypto"` | remover `"crypto"` |
| 13 | `@web3auth/auth` | remover `"crypto"` | remover `"crypto"` |
| 14 | `@web3auth/base` | remover `"crypto"` | remover `"crypto"` |
| 15 | `@web3auth/react-native-sdk` | remover `"crypto"` | remover `"crypto"` |
| 16 | `elliptic` | remover `"crypto"` | remover `"crypto"` |
| 17 | `brorand` | remover `"crypto"` | remover `"crypto"` |
| 18 | `hash.js` | remover `"crypto"` | remover `"crypto"` |
| 19 | `hmac-drbg` | remover `"crypto"` | remover `"crypto"` |

### Script para reaplicar

```python
import json, os

targets_scoped = ['@toruslabs', '@web3auth']
targets_flat = ['elliptic', 'brorand', 'hash.js', 'hmac-drbg']

for scope in targets_scoped:
    base = f'node_modules/{scope}'
    if not os.path.isdir(base):
        continue
    for pkg in os.listdir(base):
        pjson = os.path.join(base, pkg, 'package.json')
        if not os.path.exists(pjson):
            continue
        with open(pjson) as f:
            d = json.load(f)
        changed = False
        for field in ['react-native', 'browser']:
            v = d.get(field, {})
            if isinstance(v, dict) and 'crypto' in v:
                del v['crypto']
                d[field] = v
                changed = True
        if changed:
            with open(pjson, 'w') as f:
                json.dump(d, f, indent=2)
                f.write('\n')
            print(f'Fixed: {scope}/{pkg}')

for target in targets_flat:
    pjson = f'node_modules/{target}/package.json'
    if not os.path.exists(pjson):
        continue
    with open(pjson) as f:
        d = json.load(f)
    changed = False
    for field in ['react-native', 'browser']:
        v = d.get(field, {})
        if isinstance(v, dict) and 'crypto' in v:
            del v['crypto']
            d[field] = v
            changed = True
    if changed:
        with open(pjson, 'w') as f:
            json.dump(d, f, indent=2)
            f.write('\n')
        print(f'Fixed: {target}')
```

---

## 2. bitcore-lib/lib/crypto/point.js

### Motivo
`bitcore-lib` faz prototype pollution no `elliptic`: substitui `BasePoint.prototype.validate` (que retorna boolean) por uma versao que **throws**. Isso quebra o Web3Auth SDK porque `elliptic/ec/key.js:45` chama `pub.validate()` esperando boolean.

### Mudanca
Nos 2 callsites que chamam `point.validate()`, substituir por chamada explicita a `global.__bitcorePointValidate` (salvo pelo `shim.js`).

### Diff

```diff
--- a/node_modules/bitcore-lib/lib/crypto/point.js
+++ b/node_modules/bitcore-lib/lib/crypto/point.js
@@ -23,11 +23,15 @@ var Point = function Point(x, y, isRed) {
   } catch (e) {
     throw new Error('Invalid Point');
   }
-  point.validate();
+  // Use bitcore's strict validate if available (saved from prototype before restore)
+  var strictValidate = global.__bitcorePointValidate;
+  if (strictValidate) {
+    strictValidate.call(point);
+  } else {
+    point.validate();
+  }
   return point;
 };

@@ -50,7 +54,13 @@ Point.fromX = function fromX(odd, x){
   } catch (e) {
     throw new Error('Invalid X');
   }
-  point.validate();
+  var strictValidate = global.__bitcorePointValidate;
+  if (strictValidate) {
+    strictValidate.call(point);
+  } else {
+    point.validate();
+  }
   return point;
 };
```

---

## 3. bitcore-lib/lib/publickey.js

### Motivo
Mesmo que acima — `publickey.js` tambem chama `point.validate()` diretamente.

### Diff

```diff
--- a/node_modules/bitcore-lib/lib/publickey.js
+++ b/node_modules/bitcore-lib/lib/publickey.js
@@ -50,7 +50,13 @@ PublicKey = function PublicKey(data, extra) {
   var info = this._classifyArgs(data, extra);

   // validation
-  info.point.validate();
+  var strictValidate = global.__bitcorePointValidate;
+  if (strictValidate) {
+    strictValidate.call(info.point);
+  } else {
+    info.point.validate();
+  }

   JSUtil.defineImmutable(this, {
```

---

## 4. @toruslabs/eccrypto/dist/lib.esm/index.js (APENAS DEBUG — remover)

### Mudanca
Adicionado `console.log` na linha 6 para debug. **Deve ser removido** — nao e necessario para o fix.

### Diff

```diff
--- a/node_modules/@toruslabs/eccrypto/dist/lib.esm/index.js
+++ b/node_modules/@toruslabs/eccrypto/dist/lib.esm/index.js
@@ -3,6 +3,7 @@
 const ec = new ec$1("secp256k1");
 // eslint-disable-next-line @typescript-eslint/no-explicit-any, n/no-unsupported-features/node-builtins
 const browserCrypto = globalThis.crypto || globalThis.msCrypto || {};
+console.log('[ECCRYPTO] globalThis.crypto exists:', !!globalThis.crypto, 'createHash:', typeof browserCrypto.createHash, 'subtle:', typeof (browserCrypto.subtle || browserCrypto.webkitSubtle));
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
```

---

## 5. bitcore-lib/bitcore-lib.js (REVERTER)

### Mudanca
Tinha um patch de debug (Alert) na linha 27445. Existe um `.bak` do original.

### Como reverter

```bash
mv node_modules/bitcore-lib/bitcore-lib.js.bak node_modules/bitcore-lib/bitcore-lib.js
```

---

## Resumo de acoes — TODAS AUTOMATIZADAS

| Acao | Mecanismo | Localizacao |
|------|-----------|-------------|
| Remocao do crypto hack dos 20 pacotes | Script Node | `scripts/fix-web3auth-crypto-hack.js` |
| Patches do bitcore-lib (3 callsites) | patch-package | `patches/bitcore-lib+8.25.10.patch` |
| Debug do eccrypto (secao 4) | Removido (nao automatizado, era so debug) | n/a |
| Reverter bitcore-lib.js bundle (secao 5) | Restaurado para pristine; rn-nodeify nao toca o bundle | n/a |

Tudo encadeado no `npm run setup` apos o `rn-nodeify --hack`.

### Mudancas no projeto (ja aplicadas, persistentes):

| Arquivo | Mudanca |
|---------|---------|
| `shim.js` | Prototype pollution fix + exposicao de `globalThis.crypto` methods |
| `metro.config.js` | Removido `resolveRequest` que bloqueava crypto para web3auth |
| `index.js` | Debug handler removido (limpo) |

---

## Como auditar este documento

### 1. Verificar os 19 pacotes com crypto hack

Apos um `npm install` + `npm run setup` limpo (ANTES de aplicar o fix), rodar:

```bash
python3 -c "
import json, os
for scope in ['@toruslabs', '@web3auth']:
    base = f'node_modules/{scope}'
    if not os.path.isdir(base): continue
    for pkg in sorted(os.listdir(base)):
        pjson = os.path.join(base, pkg, 'package.json')
        if not os.path.exists(pjson): continue
        with open(pjson) as f:
            d = json.load(f)
        for field in ['react-native', 'browser']:
            v = d.get(field, {})
            if isinstance(v, dict) and 'crypto' in v:
                print(f'{scope}/{pkg} [{field}]')
for t in ['elliptic','brorand','hash.js','hmac-drbg']:
    pjson = f'node_modules/{t}/package.json'
    if os.path.exists(pjson):
        with open(pjson) as f:
            d = json.load(f)
        for field in ['react-native', 'browser']:
            v = d.get(field, {})
            if isinstance(v, dict) and 'crypto' in v:
                print(f'{t} [{field}]')
"
```

A lista de saida deve bater exatamente com os 19 pacotes da secao 1.

### 2. Verificar os diffs do bitcore-lib

Comparar com a versao original do npm:

```bash
cd /tmp
npm pack bitcore-lib 2>/dev/null
tar xzf bitcore-lib-*.tgz
echo "=== point.js ==="
diff package/lib/crypto/point.js /Users/rauloliveira/git/hathor/wallet-mobile-web3auth/node_modules/bitcore-lib/lib/crypto/point.js
echo "=== publickey.js ==="
diff package/lib/publickey.js /Users/rauloliveira/git/hathor/wallet-mobile-web3auth/node_modules/bitcore-lib/lib/publickey.js
rm -rf package bitcore-lib-*.tgz
```

As unicas diferencas devem ser as substituicoes de `point.validate()` por `global.__bitcorePointValidate` — conforme os diffs das secoes 2 e 3.

### 3. Verificar que o shim.js complementa os patches

O `shim.js` e responsavel por salvar/restaurar o validate e expor crypto methods. Verificar:

```bash
grep -n "bitcorePointValidate\|nativeValidate\|bitcoreValidate\|globalThis.crypto" shim.js
```

Deve mostrar:
- Salvar validate nativo do elliptic
- Carregar bitcore-lib (que polui o prototype)
- Salvar validate do bitcore-lib em `global.__bitcorePointValidate`
- Restaurar validate nativo no prototype
- Expor methods do crypto polyfill em `globalThis.crypto`

### 4. Verificar debug residual (deve ser removido)

```bash
# Nao deve existir console.log nosso no eccrypto:
grep "ECCRYPTO" node_modules/@toruslabs/eccrypto/dist/lib.esm/index.js

# Nao deve existir .bak:
ls node_modules/bitcore-lib/bitcore-lib.js.bak 2>/dev/null && echo "REVERTER: mv .bak para .js"
```

### 5. Teste funcional

Apos aplicar todas as mudancas:
1. App deve carregar sem erros na tela de login (sem "Invalid y value", sem "LOGIN_PROVIDER undefined")
2. Clicar no Google deve avancar para o fluxo de login (ou mostrar erro esperado de autenticacao, NAO erro de crypto)
