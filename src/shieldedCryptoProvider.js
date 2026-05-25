/**
 * Mobile shielded crypto provider — extends AbstractShieldedProvider from
 * @hathor/ct-crypto-provider. Backed by the HathorCtCryptoModule RN
 * native module (UniFFI-generated Swift/Kotlin bindings over the shared
 * Hathor confidential-transaction crypto core).
 *
 * Per-platform marshaling:
 *   - bytes: Buffer ↔ Array<number> (RN bridge can't marshal Buffer directly)
 *   - u64 values: BigInt → decimal String → Swift UInt64 (non-lossy, avoids
 *     the old Double round-trip that silently truncated above 2^53)
 *   - optional tokenUid in decrypt: pass [] instead of null (RN bridge can't
 *     marshal JS null into NSArray)
 *
 * The abstract class handles:
 *   - Promise wrapping
 *   - tokenUid Buffer → hex at the rewind boundary
 *   - Composing openAmountShieldedCommitment / openFullShieldedCommitment
 *     from the lower-level primitives
 */
import { AbstractShieldedProvider } from '@hathor/ct-crypto-provider';
import { NativeModules } from 'react-native';

const { HathorCtCryptoModule } = NativeModules;

function bufToArr(buf) {
  return Array.from(buf);
}
function arrToBuf(arr) {
  return Buffer.from(arr);
}

class MobileShieldedProvider extends AbstractShieldedProvider {
  _encodeBytes(buf) {
    return bufToArr(buf);
  }
  _decodeBytes(raw) {
    return arrToBuf(raw);
  }

  /**
   * Override to keep the old `vbf` / `gbf` shorthand the RN bridge currently
   * expects in computeBalancingBlindingFactorFull. (The Swift module's
   * BlindingEntry decoder reads those keys.) Can be removed once the Swift
   * module's signature is updated to long-form too — separate change.
   *
   * Value field is marshaled as String for non-lossy u64 round-trip.
   */
  _encodeBlindingEntry(entry) {
    return {
      value: entry.value.toString(),
      vbf: this._encodeBytes(entry.valueBlindingFactor),
      gbf: this._encodeBytes(entry.generatorBlindingFactor),
    };
  }

  // ─── raw primitives ────────────────────────────────────────────────────

  async _rawGenerateRandomBlindingFactor() {
    // Dedicated native export (was missing pre-migration — mobile used to
    // call createShieldedOutput with dummy values and extract the bf from
    // the unused result; that workaround is gone now).
    return await HathorCtCryptoModule.generateRandomBlindingFactor();
  }

  async _rawCreateAmountShieldedOutput(value, recipientPubkey, tokenUid, valueBlindingFactor) {
    return await HathorCtCryptoModule.createShieldedOutputWithBlinding(
      value.toString(),
      recipientPubkey,
      tokenUid,
      false, // fullyShielded
      valueBlindingFactor
    );
  }

  async _rawCreateShieldedOutputWithBothBlindings(value, recipientPubkey, tokenUid, vbf, abf) {
    return await HathorCtCryptoModule.createShieldedOutputWithBothBlindings(
      value.toString(),
      recipientPubkey,
      tokenUid,
      vbf,
      abf
    );
  }

  async _rawRewindAmountShieldedOutput(
    privateKey,
    ephemeralPubkey,
    commitment,
    rangeProof,
    tokenUid
  ) {
    // Empty array instead of null for assetCommitment (RN bridge can't marshal
    // JS null into NSArray). Swift treats empty arrays as nil before forwarding
    // to UniFFI.
    const result = await HathorCtCryptoModule.decryptShieldedOutput(
      privateKey,
      ephemeralPubkey,
      commitment,
      rangeProof,
      tokenUid,
      []
    );
    return {
      value: BigInt(result.value), // String → BigInt
      blindingFactor: result.blindingFactor,
    };
  }

  async _rawRewindFullShieldedOutput(
    privateKey,
    ephemeralPubkey,
    commitment,
    rangeProof,
    assetCommitment
  ) {
    const result = await HathorCtCryptoModule.decryptShieldedOutput(
      privateKey,
      ephemeralPubkey,
      commitment,
      rangeProof,
      [], // tokenUid recovered from rangeproof message for FullShielded
      assetCommitment
    );
    return {
      value: BigInt(result.value),
      blindingFactor: result.blindingFactor,
      tokenUid: result.tokenUid, // abstract class hex-encodes this
      assetBlindingFactor: result.assetBlindingFactor,
    };
  }

  async _rawComputeBalancingBlindingFactor(
    value,
    generatorBlindingFactor,
    inputs,
    otherOutputs
  ) {
    // `inputs` and `otherOutputs` are already encoded via _encodeBlindingEntry,
    // which translates to { value: String, vbf, gbf } per the Swift module's
    // current expectation.
    const result = await HathorCtCryptoModule.computeBalancingBlindingFactorFull(
      value.toString(),
      generatorBlindingFactor,
      inputs,
      otherOutputs
    );
    return result;
  }

  async _rawDeriveTag(tokenUid) {
    return await HathorCtCryptoModule.deriveTag(tokenUid);
  }

  async _rawDeriveAssetTag(tokenUid) {
    return await HathorCtCryptoModule.deriveAssetTag(tokenUid);
  }

  async _rawCreateCommitment(value, blindingFactor, generator) {
    return await HathorCtCryptoModule.createCommitment(
      value.toString(),
      blindingFactor,
      generator
    );
  }

  async _rawCreateAssetCommitment(tag, blindingFactor) {
    return await HathorCtCryptoModule.createAssetCommitment(tag, blindingFactor);
  }

  async _rawCreateSurjectionProof(codomainTag, codomainBlindingFactor, domain) {
    return await HathorCtCryptoModule.createSurjectionProof(
      codomainTag,
      codomainBlindingFactor,
      domain
    );
  }

  async _rawDeriveEcdhSharedSecret(privateKey, peerPubkey) {
    return await HathorCtCryptoModule.deriveEcdhSharedSecret(privateKey, peerPubkey);
  }
}

export function createMobileShieldedCryptoProvider() {
  if (!HathorCtCryptoModule) {
    throw new Error('HathorCtCryptoModule native module not available');
  }
  return new MobileShieldedProvider();
}
