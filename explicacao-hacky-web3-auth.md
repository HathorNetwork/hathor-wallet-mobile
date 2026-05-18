# Explicação — o `--hack` do rn-nodeify e por que ele quebra o Web3Auth

## O que é `rn-nodeify`

`rn-nodeify` é uma ferramenta que adapta projetos React Native para usar módulos core do Node.js (`crypto`, `stream`, `buffer`, etc.), que não existem no runtime do RN. Como o `bitcore-lib` e outras libs da Hathor foram escritas para Node, sem isso a wallet nem inicializa.

No script `setup` do projeto:

```
rn-nodeify --install stream,process,path,events,crypto,console,buffer,zlib --hack
```

Tem duas partes.

---

## Parte 1 — `--install <lista>`

Instala polyfills "browserify-style" para cada módulo Node listado:

- `crypto` → `react-native-crypto` + `react-native-randombytes`
- `stream` → `stream-browserify`
- `buffer` → `buffer`
- etc.

Também gera/atualiza o `shim.js` na raiz do projeto (o mesmo que está em uso) que faz `require('crypto')`, `require('buffer')` etc. globalmente, antes do app rodar.

---

## Parte 2 — `--hack` (a parte problemática)

Esse é o "modo agressivo". Para cada `package.json` dentro de `node_modules/` (de **todos** os pacotes, recursivamente), o rn-nodeify injeta dois campos:

```json
{
  "react-native": {
    "crypto": "react-native-crypto",
    "stream": "stream-browserify",
    "buffer": "buffer",
    ...
  },
  "browser": {
    "crypto": "react-native-crypto",
    ...
  }
}
```

O Metro bundler do React Native lê esses campos no resolve de módulos. Então quando **qualquer** código dentro daquele pacote faz `require('crypto')`, o Metro redireciona para `react-native-crypto` em vez de falhar com "module not found".

É força bruta: ao invés de adicionar um alias global de uma vez no `metro.config.js`, ele "tatua" todo o `node_modules`.

---

## Por que isso quebra o Web3Auth

Os pacotes do Web3Auth (`@toruslabs/*`, `@web3auth/*`) **já trazem implementações próprias de crypto** (via `@noble/curves`, `@toruslabs/eccrypto`, `elliptic`, etc.) e **não querem** o polyfill do browserify — eles esperam o `globalThis.crypto` da Web Crypto API ou suas próprias libs puras-JS.

Mas com o `--hack`, qualquer `require('crypto')` dentro desses pacotes vai parar no `react-native-crypto`, que:

- Tem uma API incompleta (sem `subtle`, sem `createHash` em alguns casos)
- Suas dependências (`brorand`, `hash.js`, `hmac-drbg`) também recebem o mesmo redirect, e algumas têm fallbacks frágeis
- O barrel export do `@web3auth/auth` (que carrega submódulos tipo `starkey`) crasha durante o load do módulo → `LOGIN_PROVIDER` vira `undefined`

Por isso o fix aplicado foi remover o campo `crypto` do `react-native`/`browser` dos 20 pacotes específicos do Web3Auth, deixando o `--hack` agir só no resto do `node_modules` (que **precisa** do polyfill, como o `bitcore-lib`, hathor lib, etc.).

---

## TL;DR

`--hack` = monkey-patch global em todos os `package.json` do `node_modules` para redirecionar `require('crypto')` (e outros core modules Node) para polyfills browserify. Necessário para o ecossistema antigo Hathor/bitcore, **fatal** para o ecossistema novo Web3Auth, que traz crypto próprio.

---

## Pacotes que precisam do crypto hack removido (20)

`@toruslabs/base-controllers`, `@toruslabs/broadcast-channel`, `@toruslabs/constants`, `@toruslabs/eccrypto`, `@toruslabs/ffjavascript`, `@toruslabs/http-helpers`, `@toruslabs/metadata-helpers`, `@toruslabs/react-native-web-browser`, `@toruslabs/secure-pub-sub`, `@toruslabs/session-manager`, `@toruslabs/starkware-crypto`, `@toruslabs/tweetnacl-js`, `@web3auth/auth`, `@web3auth/base`, `@web3auth/base-provider`, `@web3auth/react-native-sdk`, `elliptic`, `brorand`, `hash.js`, `hmac-drbg`.
