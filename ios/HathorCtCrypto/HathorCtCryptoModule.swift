import Foundation
import React

@objc(HathorCtCryptoModule)
class HathorCtCryptoModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  private func toData(_ arr: [Any]) -> Data {
    Data(arr.compactMap { ($0 as? NSNumber)?.uint8Value })
  }

  private func toArray(_ data: Data) -> [NSNumber] {
    data.map { NSNumber(value: $0) }
  }

  @objc func createShieldedOutput(
    _ value: Double,
    recipientPubkey: [Any],
    tokenUid: [Any],
    fullyShielded: Bool,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputUniffi(
        value: UInt64(value),
        recipientPubkey: toData(recipientPubkey),
        tokenUid: toData(tokenUid),
        fullyShielded: fullyShielded
      )
      resolve([
        "ephemeralPubkey": toArray(result.ephemeralPubkey),
        "commitment": toArray(result.commitment),
        "rangeProof": toArray(result.rangeProof),
        "blindingFactor": toArray(result.blindingFactor),
        "assetCommitment": result.assetCommitment.map { toArray($0) } as Any,
        "assetBlindingFactor": result.assetBlindingFactor.map { toArray($0) } as Any,
      ])
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func decryptShieldedOutput(
    _ recipientPrivkey: [Any],
    ephemeralPubkey: [Any],
    commitment: [Any],
    rangeProof: [Any],
    tokenUid: [Any],
    assetCommitment: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      // JS callers pass [] (instead of null) for the absent parameter, since
      // the RN bridge can't marshal JS null → NSArray. Treat empty arrays as
      // nil before forwarding to UniFFI.
      // - tokenUid is empty for FullShielded (recovered from rangeproof message).
      // - assetCommitment is empty for AmountShielded (generator from tokenUid).
      let tuid: Data? = tokenUid.isEmpty ? nil : toData(tokenUid)
      let ac: Data? = assetCommitment.isEmpty ? nil : toData(assetCommitment)
      let result = try decryptShieldedOutputUniffi(
        recipientPrivkey: toData(recipientPrivkey),
        ephemeralPubkey: toData(ephemeralPubkey),
        commitment: toData(commitment),
        rangeProof: toData(rangeProof),
        tokenUid: tuid,
        assetCommitment: ac
      )
      resolve([
        "value": NSNumber(value: result.value),
        "blindingFactor": toArray(result.blindingFactor),
        "tokenUid": toArray(result.tokenUid),
        "assetBlindingFactor": result.assetBlindingFactor.map { toArray($0) } as Any,
        "outputType": result.outputType,
      ])
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func deriveEcdhSharedSecret(
    _ privkey: [Any],
    pubkey: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try deriveEcdhSharedSecretUniffi(privkey: toData(privkey), pubkey: toData(pubkey))
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func deriveTag(
    _ tokenUid: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try deriveTagUniffi(tokenUid: toData(tokenUid))
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func createAssetCommitment(
    _ tag: [Any],
    blindingFactor: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createAssetCommitmentUniffi(tag: toData(tag), blindingFactor: toData(blindingFactor))
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func createSurjectionProof(
    _ codomainTag: [Any],
    codomainBlindingFactor: [Any],
    domain: [[String: Any]],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let domainEntries = domain.map { entry -> SurjectionDomainEntry in
        SurjectionDomainEntry(
          generator: self.toData(entry["generator"] as! [Any]),
          tag: self.toData(entry["tag"] as! [Any]),
          blindingFactor: self.toData(entry["blindingFactor"] as! [Any])
        )
      }
      let result = try createSurjectionProofUniffi(
        codomainTag: toData(codomainTag),
        codomainBlindingFactor: toData(codomainBlindingFactor),
        domain: domainEntries
      )
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func computeBalancingBlindingFactor(
    _ otherBlindingFactors: [[Any]],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let bfs = otherBlindingFactors.map { toData($0) }
      let result = try computeBalancingBlindingFactorUniffi(otherBlindingFactors: bfs)
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func createShieldedOutputWithBlinding(
    _ value: Double,
    recipientPubkey: [Any],
    tokenUid: [Any],
    fullyShielded: Bool,
    blindingFactor: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputWithBlindingUniffi(
        value: UInt64(value),
        recipientPubkey: toData(recipientPubkey),
        tokenUid: toData(tokenUid),
        fullyShielded: fullyShielded,
        blindingFactor: toData(blindingFactor)
      )
      resolve([
        "ephemeralPubkey": toArray(result.ephemeralPubkey),
        "commitment": toArray(result.commitment),
        "rangeProof": toArray(result.rangeProof),
        "blindingFactor": toArray(result.blindingFactor),
        "assetCommitment": result.assetCommitment.map { toArray($0) } as Any,
        "assetBlindingFactor": result.assetBlindingFactor.map { toArray($0) } as Any,
      ])
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func createShieldedOutputWithBothBlindings(
    _ value: Double,
    recipientPubkey: [Any],
    tokenUid: [Any],
    valueBlindingFactor: [Any],
    assetBlindingFactor: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputWithBothBlindingsUniffi(
        value: UInt64(value),
        recipientPubkey: toData(recipientPubkey),
        tokenUid: toData(tokenUid),
        valueBlindingFactor: toData(valueBlindingFactor),
        assetBlindingFactor: toData(assetBlindingFactor)
      )
      resolve([
        "ephemeralPubkey": toArray(result.ephemeralPubkey),
        "commitment": toArray(result.commitment),
        "rangeProof": toArray(result.rangeProof),
        "blindingFactor": toArray(result.blindingFactor),
        "assetCommitment": result.assetCommitment.map { toArray($0) } as Any,
        "assetBlindingFactor": result.assetBlindingFactor.map { toArray($0) } as Any,
      ])
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func computeBalancingBlindingFactorFull(
    _ value: Double,
    generatorBlindingFactor: [Any],
    inputs: [[String: Any]],
    otherOutputs: [[String: Any]],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let inEntries = inputs.map { entry -> BlindingEntry in
        BlindingEntry(
          value: (entry["value"] as! NSNumber).uint64Value,
          vbf: self.toData(entry["vbf"] as! [Any]),
          gbf: self.toData(entry["gbf"] as! [Any])
        )
      }
      let outEntries = otherOutputs.map { entry -> BlindingEntry in
        BlindingEntry(
          value: (entry["value"] as! NSNumber).uint64Value,
          vbf: self.toData(entry["vbf"] as! [Any]),
          gbf: self.toData(entry["gbf"] as! [Any])
        )
      }
      let result = try computeBalancingBlindingFactorFullUniffi(
        value: UInt64(value),
        generatorBlindingFactor: toData(generatorBlindingFactor),
        inputs: inEntries,
        otherOutputs: outEntries
      )
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }
}
