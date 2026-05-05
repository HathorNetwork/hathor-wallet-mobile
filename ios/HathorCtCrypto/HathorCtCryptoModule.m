#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HathorCtCryptoModule, NSObject)

RCT_EXTERN_METHOD(createShieldedOutput:(double)value
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

RCT_EXTERN_METHOD(createAssetCommitment:(NSArray *)tag
                  blindingFactor:(NSArray *)blindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createSurjectionProof:(NSArray *)codomainTag
                  codomainBlindingFactor:(NSArray *)codomainBlindingFactor
                  domain:(NSArray *)domain
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(computeBalancingBlindingFactor:(NSArray *)otherBlindingFactors
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createShieldedOutputWithBlinding:(double)value
                  recipientPubkey:(NSArray *)recipientPubkey
                  tokenUid:(NSArray *)tokenUid
                  fullyShielded:(BOOL)fullyShielded
                  blindingFactor:(NSArray *)blindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createShieldedOutputWithBothBlindings:(double)value
                  recipientPubkey:(NSArray *)recipientPubkey
                  tokenUid:(NSArray *)tokenUid
                  valueBlindingFactor:(NSArray *)valueBlindingFactor
                  assetBlindingFactor:(NSArray *)assetBlindingFactor
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(computeBalancingBlindingFactorFull:(double)value
                  generatorBlindingFactor:(NSArray *)generatorBlindingFactor
                  inputs:(NSArray *)inputs
                  otherOutputs:(NSArray *)otherOutputs
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
