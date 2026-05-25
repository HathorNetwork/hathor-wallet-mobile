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

  // u64 values arrive as NSString (decimal) to avoid the precision loss that
  // would happen if JS Numbers (doubles) were marshaled directly. Anything > 2^53
  // would silently truncate; the String round-trip is exact for the full u64 range.
  private func parseU64(_ value: NSString) throws -> UInt64 {
    guard let v = UInt64(value as String) else {
      throw NSError(
        domain: "HathorCtCryptoModule", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "value '\(value)' is not a valid uint64"]
      )
    }
    return v
  }

  @objc func createShieldedOutput(
    _ value: NSString,
    recipientPubkey: [Any],
    tokenUid: [Any],
    fullyShielded: Bool,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputUniffi(
        value: try parseU64(value),
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
      // the RN bridge can't convert JS null into NSArray (warns and breaks the call).
      // Swift treats empty arrays as nil before forwarding to UniFFI.
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
      // value returned as String for non-lossy u64 marshaling back to JS BigInt.
      resolve([
        "value": String(result.value),
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

  @objc func deriveAssetTag(
    _ tokenUid: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try deriveAssetTagUniffi(tokenUid: toData(tokenUid))
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

  @objc func createCommitment(
    _ value: NSString,
    blindingFactor: [Any],
    generator: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createCommitmentUniffi(
        value: try parseU64(value),
        blindingFactor: toData(blindingFactor),
        generator: toData(generator)
      )
      resolve(toArray(result))
    } catch {
      reject("CRYPTO_ERROR", error.localizedDescription, error)
    }
  }

  @objc func generateRandomBlindingFactor(
    _ resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    // Dedicated UniFFI export — replaces the old "call createShieldedOutput
    // with dummy values and extract the blinding factor" hack that mobile
    // used before this export existed.
    let result = generateRandomBlindingFactorUniffi()
    resolve(toArray(result))
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
    _ value: NSString,
    recipientPubkey: [Any],
    tokenUid: [Any],
    fullyShielded: Bool,
    blindingFactor: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputWithBlindingUniffi(
        value: try parseU64(value),
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
    _ value: NSString,
    recipientPubkey: [Any],
    tokenUid: [Any],
    valueBlindingFactor: [Any],
    assetBlindingFactor: [Any],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try createShieldedOutputWithBothBlindingsUniffi(
        value: try parseU64(value),
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
    _ value: NSString,
    generatorBlindingFactor: [Any],
    inputs: [[String: Any]],
    otherOutputs: [[String: Any]],
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    do {
      // BlindingEntry's `value` is now String-marshaled too — uint64Value-on-Double
      // round-tripping is gone.
      let decodeEntry = { (entry: [String: Any]) throws -> BlindingEntry in
        let vStr = entry["value"] as? NSString ?? NSString(string: "\(entry["value"] ?? "0")")
        return BlindingEntry(
          value: try self.parseU64(vStr),
          vbf: self.toData(entry["vbf"] as! [Any]),
          gbf: self.toData(entry["gbf"] as! [Any])
        )
      }
      let inEntries = try inputs.map(decodeEntry)
      let outEntries = try otherOutputs.map(decodeEntry)
      let result = try computeBalancingBlindingFactorFullUniffi(
        value: try parseU64(value),
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
