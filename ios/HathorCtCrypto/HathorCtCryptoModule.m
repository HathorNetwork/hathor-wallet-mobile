#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HathorCtCryptoModule, NSObject)

RCT_EXTERN_METHOD(createShieldedOutput:(NSString *)value
                  recipientPubkey:(NSArray *)recipientPubkey
                  tokenUid:(NSArray *)tokenUid
                  fullyShielded:(BOOL)fullyShielded
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(decryptShieldedOutput:(NSArray *)recipientPrivkey
                  ephemeralPubkey:(NSArray *)ephemeralPubkey
                  commitment:(NSArray *)commitment
                  rangeProof:(NSArray *)rangeProof
                  tokenUid:(NSArray *)tokenUid
                  assetCommitment:(NSArray *)assetCommitment
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deriveEcdhSharedSecret:(NSArray *)privkey
                  pubkey:(NSArray *)pubkey
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deriveTag:(NSArray *)tokenUid
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deriveAssetTag:(NSArray *)tokenUid
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createAssetCommitment:(NSArray *)tag
                  blindingFactor:(NSArray *)blindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createCommitment:(NSString *)value
                  blindingFactor:(NSArray *)blindingFactor
                  generator:(NSArray *)generator
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateRandomBlindingFactor:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createSurjectionProof:(NSArray *)codomainTag
                  codomainBlindingFactor:(NSArray *)codomainBlindingFactor
                  domain:(NSArray *)domain
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(computeBalancingBlindingFactor:(NSArray *)otherBlindingFactors
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createShieldedOutputWithBlinding:(NSString *)value
                  recipientPubkey:(NSArray *)recipientPubkey
                  tokenUid:(NSArray *)tokenUid
                  fullyShielded:(BOOL)fullyShielded
                  blindingFactor:(NSArray *)blindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createShieldedOutputWithBothBlindings:(NSString *)value
                  recipientPubkey:(NSArray *)recipientPubkey
                  tokenUid:(NSArray *)tokenUid
                  valueBlindingFactor:(NSArray *)valueBlindingFactor
                  assetBlindingFactor:(NSArray *)assetBlindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(computeBalancingBlindingFactorFull:(NSString *)value
                  generatorBlindingFactor:(NSArray *)generatorBlindingFactor
                  inputs:(NSArray *)inputs
                  otherOutputs:(NSArray *)otherOutputs
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
